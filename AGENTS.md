# AGENTS.md

Single source of truth for AI coding agents working on this project. Read this before making any changes.

`CLAUDE.md` intentionally delegates here — update this file, not the pointer.

`snyk-monitor` (kubernetes-monitor) is a controller Snyk deploys into a Kubernetes cluster via a Helm chart. It has **read-only** access to cluster workloads, discovers running container images, and reports them to Snyk for vulnerability scanning. It supports whole-cluster or single-namespace scope, public and private registries (GCR/ECR/ACR credential helpers), an optional Sysdig runtime integration, HTTP forwarding proxies, and custom CA certificates.

## Scope

These rules cover the TypeScript source under `src/`, its tests under `test/`, and the Helm chart under `snyk-monitor/`.

## Architecture

The service is a layered pipeline by responsibility: **`supervisor`** watches the cluster (informers, one handler per workload kind) → **`scanner`** scans discovered images (skopeo + `snyk-docker-plugin`) → **`transmitter`** sends results upstream over HTTP. `src/common/` holds cross-cutting singletons (config, logger, policy) and `src/data-scraper/` handles Sysdig runtime data. There is no inbound HTTP API beyond `src/healthcheck.ts`.

### Hard rules

Every item is a blocking gate — a PR that violates any of these must not merge.

- **The monitor has read-only access to the cluster and must never mutate or interfere with other workloads.** This is the product's core safety guarantee — code that writes to or disrupts cluster resources is out of bounds.
- **System tests must exercise the real Kubernetes API — never mock or bypass it — and must cover core functionality end to end.** Reference: [`test/README.md`](test/README.md)
- **When remediating vulnerabilities with npm `overrides`, keep every bump within its current major version and raise the declared range so a fresh install cannot resolve back to a vulnerable version. Never bundle a risky major-version upgrade (e.g. `@kubernetes/client-node` 1.x) into a vuln sweep — leave it open and track it separately.** (see #1744, #1720)
- **After any dependency change, regenerate `package-lock.json` with the npm version CI uses, then verify with a clean `npm ci` plus a `tsc` build and unit tests before landing.** (see #1744, #1721)
- **In both Dockerfiles, install devDependencies before compiling (`npm ci --include=dev`, because `NODE_ENV=production` silently omits them) and prune with `--omit=dev` afterward so the shipped image stays production-only.** (see #1729)
- **Never log skopeo command lines or error output that can contain credentials (`--src-creds user:pass`); scrub `message` only for skopeo child-process errors, and preserve it for non-skopeo errors so ECR/IRSA failures stay debuggable.** (see #1689)
- **`snyk-monitor` supports HTTP forwarding proxies only and must never route Kubernetes API-server traffic through the proxy; `no_proxy` matches exact hostnames only — no wildcards or CIDR.**
- **`clusterName` must match `^[a-zA-Z0-9_:() \.\-]{0,62}$`** — at most 62 characters, with at least one non-space character.

### Conventions

- New per-workload-kind support goes in one file under `src/supervisor/watchers/handlers/`, exporting `paginatedNamespacedList` / `paginatedClusterList` helpers plus a `*WatchHandler`. Reference: [`src/supervisor/watchers/handlers/deployment.ts`](src/supervisor/watchers/handlers/deployment.ts)
- Dependencies are module-level singletons (config, logger, k8s API) imported directly — there is no DI container; `src/common/config.ts` mutates the exported config object at import time. Reference: [`src/common/config.ts`](src/common/config.ts)
- Throw native `Error`s (no custom subclasses); at boundaries, wrap logic in try/catch and log via bunyan with a structured context object — `logger.error({ error, ...context }, 'message')` — rather than rethrowing. Match retryable network errors by code/message list. Reference: [`src/transmitter/index.ts`](src/transmitter/index.ts)
- Keep npm `overrides` scoped to the dependency path that needs them, not forced globally, so other consumers (e.g. the AWS SDK) aren't broken. Keep the `fast-xml-parser` override at `>=5.7.2` — 5.7.0/5.7.1 break STS XML parsing and silently fail IRSA-backed ECR auth. (see #1698, #1696)
- The final container images ship only the node runtime — remove `npm`/`npx`/`corepack`/`yarn` after the build so they don't surface in the container scan. (see #1721, #1725)
- Every `.snyk` ignore cites the specific upstream advisory reason (e.g. Red Hat "Not affected", no fix available) and carries an expiry date so it is re-evaluated when a fix ships. Delete resolved/expired ignores and dead code outright — never comment them out. (see #1689, #1611)
- System tests assert the transmission contract (workloads detected → scanned → transmitted) with `arrayContaining`, not `snyk-docker-plugin` internals or strict array equality, so plugin changes don't break them; prefer a blackbox approach. (see #1679)

### Directory layout

| Directory | Purpose |
|-----------|---------|
| `src/common/` | Cross-cutting singletons: config, logger, policy, shared types |
| `src/supervisor/` | Cluster watching, workload-metadata extraction, cluster/agent identity |
| `src/supervisor/watchers/handlers/` | One handler per workload kind (deployment, cron-job, daemon-set, …) |
| `src/scanner/` | Image-scan orchestration; `images/` holds credentials, skopeo, docker-plugin shim |
| `src/transmitter/` | Outbound HTTP to Snyk upstream — payloads, proxy, retry |
| `src/data-scraper/` | Sysdig runtime data scraping |
| `snyk-monitor/` | Helm chart (Chart.yaml, values.yaml, templates) for deployment |
| `test/` | Unit, system, and integration suites plus fixtures/helpers |

### Danger zone

- npm transitive-dependency `overrides` in `package.json` / `package-lock.json` — the most frequently patched area (vuln remediation); small range changes have wide blast radius. (see #1744, #1742, #1720 and others)
- `.snyk` ignore policy for unfixable RHEL9/UBI base-image vulns (vim-minimal, glibc, gnutls, tar). (see #1739, #1689, #1724)
- `Dockerfile` / `Dockerfile.ubi9` base-image bumps and image hardening. (see #1744, #1725)
- skopeo version/error handling in the images (gRPC CVEs, credential scrubbing). (see #1699, #1689)

Treat these areas as high-risk: prefer the smallest possible change, add tests before modifying, and ask a human reviewer before landing.

## Code conventions

### Style and formatting

Prettier is enforced as ESLint errors (so `npm run lint` fails on formatting), and a `fadge` circular-dependency check and a `gitleaks` pre-commit hook also run — beyond the usual `@typescript-eslint` + strict `tsconfig`.
Formatting and linting are enforced by tooling — run `npm run lint` / `npm run format` instead of reasoning about style; they are authoritative.

### Patterns

- Filenames are kebab-case, all lowercase (e.g. `daemon-set.ts`, `workload-sanitization.ts`).
- Co-locate types/interfaces in a per-module `types.ts`; interface names use an `I` prefix (`IWorkloadMetadataPayload`) by convention (not linter-enforced). Config keys and shared constants are `UPPER_SNAKE_CASE`.

### Best practices for new code

Apply these principles when writing **new** code. Do not refactor existing code to comply unless explicitly asked.

When you touch a file that has existing violations:
1. Write your new code correctly.
2. Leave the surrounding violation untouched.
3. Emit: "⚠️ Legacy debt: [file:line] — [which principle], left alone to avoid scope creep."

- **Single Responsibility Principle (SRP)**
- **Avoid Hasty Abstractions (AHA)**

## Testing

> **Note:** No automated coverage enforcement found in CI or config. Consider adding a coverage threshold.

| Command | What it runs |
|---------|--------------|
| `npm run test:unit` | Unit tests (Jest; may require `KUBECONFIG` set to a valid kubeconfig) |
| `npm run test:system` | System tests — spins up a local KinD cluster; requires Skopeo |
| `npm run test:integration:kind:helm` | Integration tests against a KinD cluster via the Helm chart |

System tests need Skopeo (auto-installed on Linux, manual on macOS) and a Kubernetes cluster; they must not mock the Kubernetes API.

### AI agent testing protocol

**AI agent addendum:** The protocol below supplements the project's own testing guide. Where they conflict, the project guide takes precedence.

**1. Test-first: fail before pass.**

Before writing implementation, write a test that exercises the new behavior. Run it — it **must
fail** first. A test that passes before the change is testing the wrong thing; discard it and write
another. Implement, then run again. This cycle counts as one attempt; you have **3 attempts** total.
If fail-then-pass cannot be achieved, stop and warn: "Warning: could not achieve
fail-before/pass-after for [test name] — [reason]."

If writing a test before implementation is genuinely not feasible (e.g., the change is in test
scaffolding itself), document the reason explicitly.

**2. Do not add tests for pre-existing untested code you touch.**

When modifying existing code that has no tests, report it: "Warning: [file/function] has no
existing test coverage. This change is unverified." Do **not** add tests for it — that is out of
scope and may introduce incorrect assumptions about existing behavior. Do write tests for any
**new** behavior you add, even if it lives in an existing file.

## Local development

- Requires Node 22 and npm; install with `npm install`.
- Debug in-cluster with Tilt: `tilt up` deploys via the published Helm chart, `tilt down` tears it down. If Tilt fails with `EROFS: read-only file system`, remove `readOnlyRootFilesystem: true` from `snyk-monitor/templates/deployment.yaml` (debugging only — do not commit).

## Commits and PRs

**Commit format:** Conventional Commits, enforced by commitlint. Type required, subject line ≤ 100 chars, body needs a leading blank line.
Allowed types: feat, fix, docs, chore, refactor, test, revert.
Example: `fix(deps): update snyk-docker-plugin to 9.20.1`
Branch naming (inferred): conventional prefix with slash (`fix/...`, `chore/...`) or Jira-ticket-prefixed (`CN-1563-...`). Default branch is `staging`.
**PR description sections:** What this does, Notes for the reviewer, Screenshots. PR titles are validated by a semantic-PR-title CI check.

## Before you finish

Before presenting any change, verify each item below. Do not report work as complete until every applicable item passes.

- [ ] `npm run test:unit` passes
- [ ] `npm run lint` passes (eslint + commitlint + circular-dependency check)
- [ ] `npm run format` run and output committed
- [ ] Commit and PR title follow Conventional Commits (`type(scope): subject`, ≤ 100 chars)
- [ ] If dependencies changed: `package-lock.json` regenerated with CI's npm version and verified with a clean `npm ci`
- [ ] New behavior (and every bug fix) has test coverage
- [ ] Container images still pass the `prodsec/container_scan` gate

---

## Human review checklist

This file was generated by `/create-agents-md:create-agents-md` as a starting point. Complete these items to finish it:

- [ ] Confirm the inferred purpose and scope are accurate.
- [ ] Add a "When in doubt" note with the team contact / Slack channel for questions.
- [ ] Confirm coverage enforcement: add a CI coverage threshold, or note that coverage is intentionally unenforced.
- [ ] Remove this section once all items above are resolved.
