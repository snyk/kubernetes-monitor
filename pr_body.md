## Summary

**Base branch:** `staging` (this PR is one commit on top of current `origin/staging`).

Restores **distro-packaged skopeo** on Alpine and UBI9 (drops the static lework binary and the extra `containers-common` copy stage). OS packages bring `/etc/containers` trust defaults, so the image stays smaller and easier to patch via `apk`/`dnf` upgrades.

Audits **`.snyk`**: removes ignores that no longer match the dependency graph (current `package-lock.json` already satisfies fixed versions), fixes an incorrect reason on a Go/container finding, renews expired Red Hat–related entries, and documents when the `'*'` path wildcard is appropriate versus removing a rule.

## `.snyk` review (what changed and why)

### Removed (no longer needed — verified against Snyk advisories + `npm ls`)

| Rule | Rationale |
|------|-----------|
| `SNYK-JS-BRACES-6838727` | Fixed in `braces@3.0.3+`; tree resolves to `3.0.3`. |
| `SNYK-JS-TOUGHCOOKIE-5672873` | Fixed in `tough-cookie@4.1.3+`; lockfile overrides to `4.1.3` under `@kubernetes/client-node`. |
| `SNYK-JS-GLOB-14040952` | Affects `glob` **10.x / 11.x CLI** only; app uses `glob@6.x` / `7.x` as a **library** (not the vulnerable CLI path). |
| `SNYK-JS-FASTXMLPARSER-15155603` | Affected `>=5.0.9 <5.3.4`; transitive `fast-xml-parser@5.5.8` is **≥ 5.3.4**. |
| `SNYK-JS-TAR-15307072`, `15416075`, `15456201` | Require `tar` **≥ 7.5.8 / 7.5.10 / 7.5.11** respectively; tree has **`tar@7.5.12`**. |
| `SNYK-JS-MINIMATCH-15309438`, `15353389` | 3.x line fixed at **`>=3.1.3`**; tree has **`minimatch@3.1.5`**. |

### Kept / updated

- **RHEL9 OS (`SNYK-RHEL9-*`)** — Still no acceptable fix in UBI channels for several `tar` / `gnupg2` / `libarchive` / `libxml2` findings, or vendor assessment for `PYTHON3PIPWHEEL`. **Expiry unified to `2026-09-30`** for a single review date; **`'*'`** retained because `.snyk` does not support per-RPM paths for these image scans.
- **`SNYK-GOLANG-GITHUBCOMCONTAINERSSTORAGE-8230413`** — Reason corrected (was wrongly labeled “devDependency”). Scoped to **container / skopeo stack**; **`'*'`** retained for SBOM-on-binary semantics.
- **`SNYK-GOLANG-GOOGLEGOLANGORGGRPC-15691172`** — **Critical**; kept as **last resort** after confirming distro skopeo still embeds **grpc v1.72.2**. **Shorter expiry (`2026-06-22`)** than RHEL rules. **`'*'`** retained: container Go-module paths are not expressed as stable filesystem paths in `.snyk` for this project.

### Wildcard (`'*'`) policy

- **OS / container image findings**: `'*'` is the usual scope when the finding is attributed to the **image layer** or **compiled binary**, not a single `package.json` dependency path.
- **npm**: prefer **deleting** ignores when versions are already patched; avoid `'*'` for SCA where a precise `package.json > …` path could be used (none of the removed rules needed replacement paths because the vuln is not applicable to current versions).

## Commit message (squashed vs `staging`)

```
fix(security): hardening and Snyk policy (vs staging)

Single commit for review against origin/staging.

Containers:
- Alpine: apk update/upgrade; distro skopeo; npm 10.9.7
- UBI9: dnf upgrade; skopeo from UBI repos (no static lework binary or containers-common copy stage)

Dependencies: package.json / package-lock.json SCA remediation.

Snyk (.snyk): drop obsolete npm ignores; fix containers/storage reason;
refresh RHEL9 expiries; time-bound grpc-in-skopeo ignore; document '*' usage.

See pr_body.md for reviewer notes.
```

## Test plan

- [ ] `docker build` Alpine and UBI9 images (with CI secrets for private `go install` where required).
- [ ] Runtime smoke: `skopeo copy` (or equivalent) as in pipeline.
- [ ] `snyk test` / container scan: confirm removed rules do not re-open npm issues; confirm remaining ignores still apply.
- [ ] Before **2026-06-22**, re-check whether skopeo RPM/apk ships grpc **≥ 1.79.3** and remove or renew the grpc ignore.
