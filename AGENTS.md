# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, etc.) working in this repo.

## What this is

`snyk/kubernetes-monitor` (published as the `snyk-monitor` container, also called
**Snyk Controller**) is a long-running daemon deployed inside a Kubernetes cluster.
It is **not a library** and has **no CLI entry point of its own** — it runs as a
single-replica Deployment distributed via a Helm chart (`snyk-monitor/`).

Two complementary responsibilities:

1. **Vulnerability scanning** — watches every workload (Pod, Deployment, StatefulSet,
   DaemonSet, ReplicaSet, ReplicationController, Job, CronJob, OpenShift
   DeploymentConfig, Argo Rollout). When a Pod becomes ready, it pulls the container
   image via Skopeo, scans it with `snyk-docker-plugin`, and ships results to Snyk's
   `kubernetes-upstream` API.
2. **Runtime-data enrichment (Sysdig integration)** — optionally polls a Sysdig Risk
   Spotlight endpoint and forwards loaded-packages data to Snyk's upstream, giving a
   runtime view of executing packages.

The monitor is **read-only** with respect to the cluster (`get`, `list`, `watch` verbs
only). No Kubernetes resources are ever mutated.

## Repo layout

```
src/
  index.ts                    Bootstrap & wiring (startup sequence)
  state.ts                    In-process LRU caches + global flags
  healthcheck.ts              60-second heartbeat timer
  common/
    config.ts                 Config loader & normaliser
    logger.ts                 Bunyan logger singleton (structured JSON)
    policy.ts                 Rego policy load & upload
    process.ts                Child-process exec wrapper (used by Skopeo)
    types.ts                  Config interface
  supervisor/                 Kubernetes watch loop
    cluster.ts                KubeConfig + typed API clients
    agent.ts                  Stable agentId from Deployment UID
    metadata-extractor.ts     Build IWorkload[] from a Pod
    workload-reader.ts        Per-kind API readers with LRU cache
    workload-sanitization.ts  Trim raw K8s objects to reduce memory
    kuberenetes-api-wrappers.ts  Retry + queue for K8s API calls
    types.ts                  WorkloadKind enum, K8s type aliases
    watchers/
      index.ts                beginWatchingWorkloads entry point
      internal-namespaces.ts  Excluded-namespace lists (kube-*, openshift-*)
      handlers/
        informer-config.ts    workloadWatchMetadata registry (central mapping)
        index.ts              setupNamespacedInformer / setupClusterInformer
        pod.ts                Pod ADD/UPDATE/DELETE handlers + scan queue push
        namespace.ts          trackNamespace(s) – namespace informer
        queue.ts              async.queue wrapping processWorkload
        error.ts              Restartable informer error handler
        pagination.ts         Paginated list helpers (page size 100)
        workload.ts           deleteWorkload helper
        <kind>.ts             deployment, replica-set, daemon-set, stateful-set,
                              job, cron-job, replication-controller,
                              deployment-config, argo-rollout (DELETE handlers)
  scanner/
    index.ts                  processWorkload – pull → scan → send pipeline
    types.ts                  IScanResult
    images/
      index.ts                pullImages / scanImages / removePulledImages
      skopeo.ts               Skopeo copy + inspect-raw; digest extraction
      credentials.ts          ECR token refresh via @aws-sdk/client-ecr
      docker-plugin-shim.ts   dep-graph → legacy DependencyTree conversion
      types.ts                IPullableImage, IScanImage
  transmitter/
    index.ts                  HTTP client: send/delete workloads, scan results, runtime data
    payload.ts                Payload constructors
    proxy.ts                  HTTP/HTTPS tunnel proxy agent builder
    types.ts                  Wire-format interfaces (IWorkload, Telemetry, …)
  data-scraper/
    index.ts                  Sysdig v2 scraping (cursor-paginated)
    scraping-v1.ts            Sysdig v1 scraping
snyk-monitor/                 Helm chart
  Chart.yaml
  values.yaml
  values.schema.json          JSON Schema for Helm values (validated at install time)
  templates/                  deployment, clusterrole, clusterrolebinding,
                              role, rolebinding, serviceaccount, configmap,
                              networkpolicy, pvc
test/
  unit/                       Jest unit tests (no cluster required)
  system/                     System tests — monitor runs in-process against KinD
  common/                     Shared test helpers
  fixtures/                   K8s YAML and sample data (load-bearing, do not modify)
  helpers/                    Integration test helpers
  setup/                      Test setup files
scripts/                      CI helper scripts (build-image, publish, etc.)
bin/start                     Shell entry point (exec node .)
Dockerfile                    Multi-stage: Go cred-helpers + Node/Alpine app
Dockerfile.ubi9               UBI9 variant
Tiltfile                      Live-reload debugging inside a real cluster
config.default.json           Default runtime config (loaded via snyk-config)
jest.config.js                Jest configuration
jest-environment-fail-fast.ts Custom Jest environment — aborts suite on first failure
tsconfig.json
package.json
```

## Setup

- **Node 22** (`.nvmrc`: `22`). Use `nvm use` to activate. CI runs `cimg/node:22.15`.
  Note: `.tool-versions` says `nodejs lts-gallium` — this is stale; Node 22 is authoritative.
- `npm ci` — install dependencies from the public npm registry. No auth needed for local install.
- `npm run build` — compiles TypeScript to `dist/` via `tsc`. Required before running the process.
- **System tests** need Skopeo. On Linux it is installed automatically; on macOS install manually
  (`brew install skopeo`). They also need a KinD cluster (created automatically by the test script).
- **Integration tests** additionally need KinD, `kubectl`, and Helm (or raw YAML manifests).
  Set `KUBECONFIG` to point at a valid kubeconfig when running unit tests to silence spurious
  Kubernetes client noise.

## Commands

Use these exact scripts — do not invent new ones.

| Task                             | Command                                      |
| -------------------------------- | -------------------------------------------- |
| Build (TypeScript → `dist/`)     | `npm run build`                              |
| Lint (all three checks)          | `npm run lint`                               |
| Lint (ESLint only)               | `npm run lint:eslint`                        |
| Lint (commitlint)                | `npm run lint:commit`                        |
| Lint (circular deps via fadge)   | `npm run lint:circular`                      |
| Format (write)                   | `npm run format`                             |
| Format (check only)              | `npm run format:check`                       |
| Unit tests                       | `npm run test:unit`                          |
| System tests                     | `npm run test:system`                        |
| Integration tests (KinD + Helm)  | `npm run test:integration:kind:helm`         |
| Integration tests (KinD + YAML)  | `npm run test:integration:kind:yaml`         |
| Integration tests (KinD + Proxy) | `npm run test:integration:kind:proxy`        |
| Watch + auto-restart (dev)       | `npm run dev`                                |
| Watch + debugger break (debug)   | `npm run debug`                              |
| Local testing helper             | `npm run local`                              |

> **Do not run `npm test`** for a quick inner loop. The `pretest` hook runs
> `./scripts/docker/build-image.sh` and then the full integration suite — it is slow and
> requires Docker credentials. Use `npm run test:unit` for fast feedback, and
> `npm run test:system` when you need Kubernetes API coverage.

## Testing rules

- All tests are **Jest** (preset `ts-jest`) with the `.spec.ts` suffix. Match pattern:
  `test/**/*.spec.ts`.
- Jest config: `jest.config.js` (root). Custom environment: `jest-environment-fail-fast.ts` —
  the suite aborts on the first failure (`bail: true`).
- Default test timeout: **15 minutes** (to accommodate integration tests polling the upstream).
- Use **`nock`** for outbound HTTP mocking in unit tests.
- Unit tests (`test/unit/`) — fast, no cluster required. Some tests reach the Kubernetes client
  library; set `KUBECONFIG` to a valid kubeconfig to avoid noise.
- System tests (`test/system/`) — run the monitor code in-process against a real KinD cluster.
  Require Skopeo + a running Docker daemon. A KinD cluster is created automatically.
- Integration tests (`test/integration/kubernetes.spec.ts`) — full cluster round-trip. Controlled
  by env vars: `DEPLOYMENT_TYPE` (`Helm`/`YAML`/`Proxy`), `TEST_PLATFORM` (`kind`/`eks`/`aks`),
  `CREATE_CLUSTER` (`true`/`false`).
- See `test/README.md` for the authoritative guide to test requirements and env vars.

## Debugging

- All logging goes through a single **Bunyan** logger (`src/common/logger.ts`). Set
  `LOG_LEVEL=debug` for verbose output.
- `npm run debug` — starts `tsc-watch` and launches `node --inspect-brk .` so you can attach
  VS Code or Chrome DevTools.
- **Tilt** (`tilt up`) — deploys the monitor via the same Helm chart used in production,
  enabling live-reload and step-through debugging inside a real cluster. See `test/README.md`
  for the `readOnlyRootFilesystem` workaround needed for Tilt.
- Run `tilt down` to clean up the Tilt session.

## CI

**CircleCI** (`.circleci/config.yml`) — no build/test GitHub Actions (the only GH workflow is
`pr-title-check.yml` for PR title validation).

Workflows:

| Workflow           | Triggered on               | Jobs included                                                         |
| ------------------ | -------------------------- | --------------------------------------------------------------------- |
| `PR_TO_STAGING`    | PRs targeting `staging`    | `lint`, `unit_tests`, `build_image`                                   |
| `MERGE_TO_STAGING` | Merge to `staging`         | `lint`, `unit_tests`, `system_tests`, `build_image`, `publish`        |
| `MERGE_TO_MASTER`  | Merge to `master`          | `tag_and_push`, `deploy_to_prod`, `security-scans`                    |

Node image: `cimg/node:22.15`. Two images are built per release: Alpine (`Dockerfile`) and
UBI9 (`Dockerfile.ubi9`). Failures on `staging`/`master` notify Slack `#team-container-pipeline-info`.

## Commit & PR conventions

- **Conventional commits**, enforced by commitlint (`.commitlintrc.json`).
  Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `revert`.
  Header max length: **100 characters**. `body-leading-blank` is required; `type-empty`
  is forbidden.
  Example: `fix(scanner): handle empty layer in OCI archive`.
- PR titles are independently validated by `.github/workflows/pr-title-check.yml` — use
  the same conventional format.
- CODEOWNERS: `* @snyk/infrasec_container @snyk/container_container` — both teams review
  everything by default.
- See `CONTRIBUTING.md` for the contribution agreement and branching model.

## Things not to touch

- `dist/` — generated by `tsc`, gitignored; never hand-edit.
- `test/fixtures/` — load-bearing K8s YAML and sample data; do not regenerate or tidy
  without a clear reason.
- `snyk-monitor/values.schema.json` — validates user-supplied Helm values at install time;
  changes here affect every deployment.
- `snyk-monitor/templates/clusterrole.yaml` and `role.yaml` — RBAC is intentionally
  read-only (`get`, `list`, `watch` only). Do **not** add write/mutate verbs.
- Go binaries compiled in Docker stage 1 (`docker-credential-ecr-login`,
  `docker-credential-acr-env`) — built inside the Dockerfile; do not check in pre-built
  binaries.
- Rego policy mount path `/tmp/policies/workload-events.rego` — user-provided via
  ConfigMap; do not hardcode alternative paths.

## Style

- **TypeScript** (`target: es2021`, `module: commonjs`, `strict: true`,
  `noImplicitAny: false`) — see `tsconfig.json`.
- **Prettier** (`singleQuote: true`, `trailingComma: 'all'`, `arrowParens: 'always'`,
  `htmlWhitespaceSensitivity: 'ignore'`) — run `npm run format` before sending changes.
- **ESLint** with `@typescript-eslint` — run `npm run lint:eslint`.
- When adding support for a new workload kind, mirror the existing per-kind layout under
  `src/supervisor/watchers/handlers/` (one file per kind, DELETE handler only; ADD/UPDATE
  logic lives in `pod.ts`) and register the new kind in `informer-config.ts`.

## When in doubt

- **Bootstrap & wiring**: `src/index.ts` — the startup sequence in full.
- **Watch loop registry**: `src/supervisor/watchers/handlers/informer-config.ts` —
  central mapping from `WorkloadKind` to API endpoint + verb handlers.
- **Pod scan flow**: `src/scanner/index.ts` (`processWorkload`) — pull → scan → send.
- **Upstream HTTP surface**: `src/transmitter/index.ts` + `src/transmitter/payload.ts`.
- **Owner-chain resolution**: `src/supervisor/metadata-extractor.ts` +
  `src/supervisor/workload-reader.ts`.
- **Global state & caches**: `src/state.ts`.
- **Helm chart values**: `snyk-monitor/values.yaml`.
