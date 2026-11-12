# OBHL CI/CD maturity plan

Assessment: November 12, 2026, against main `4cecb31` and the open feature PRs. This is a proposed rollout, not an enabled pipeline or production deployment.

## Current state

| Area | Evidence | Consequence |
| --- | --- | --- |
| Application CI | `.github/workflows` contains only Terraform plan/apply | PRs have no automated application build or test gate. |
| Backend | Four Java 21 Gradle services; main has 10 gateway test classes, 3 game-service classes, 1 league-service class, no stats-service tests | Existing tests can provide an immediate gate, but a green build does not establish coverage for every service. |
| Frontend | React/Vite; package scripts expose build/lint, no test runner | Add behavior tests for the flows we have been verifying manually. |
| Lint | Full local run: 22 errors and 14 warnings in 21 files; changed removal files have no errors | Resolve the existing errors before requiring whole-project lint. Do not hide the baseline with `continue-on-error`. |
| Containers | All backend Dockerfiles use `build -x test`; frontend uses mutable Node 20 base | Test separately before publishing images; choose and pin supported runtime versions. |
| Database | SQL files mounted into Postgres initialization; manual upgrades; Hibernate `update`/`validate` differs by service/profile | Fresh databases and upgrades can behave differently; make schema changes reproducible. |
| Deployment | Runbook describes Compose on one EC2 host and image builds on that host | Remove build load from production and retain a known previous release. Reconfirm the live topology before implementing CD. |
| Infrastructure | Terraform dev stack was deliberately destroyed; apply is manual | Do not recreate the unused stack as part of CI/CD. |
| GitHub policy | Repository rulesets API returned no rulesets | Confirm classic branch protection separately before changing policy. |

Open PRs add security hardening (#38, still draft), player statistics (#39), polls (#40), and persisted recaps (#41). Each has local validation; that is not yet an automated CI result. Bring their tests into the common pipeline as they merge.

## 1. Establish a dependable PR gate

Deliver this first, in a focused CI PR. Run on every PR to main and every push to main using GitHub-hosted ephemeral runners.

- Backend matrix: `bash ./gradlew --no-daemon test bootJar` in each service with Java 21. Publish JUnit XML and failure reports. Report services with no tests explicitly.
- Frontend: reproducible `npm ci`, full ESLint after baseline cleanup, and production build. Pin a supported Node LTS version compatible with Vite in CI, local tooling, and Docker together. Keep the bundle-size warning visible; introduce a budget after measuring normal output.
- Include Python helper tests after #41 lands. Validate portable skill metadata without relying on a developer's home directory.
- Validate workflow syntax and shell scripts. Validate the Gradle wrapper before running it.
- Create one stable required check, `CI / required`, that runs even when dependencies fail or are cancelled and fails unless every required job succeeds. Initially run all services: this repository is small enough to favor simplicity over path-based optimizations.
- Use read-only default token permissions, pinned action commit SHAs, job timeouts, and cancellation of superseded PR runs. PR jobs get no production secrets or AWS credentials. Never execute untrusted PR code in a privileged `pull_request_target` job.
- Once the gate is demonstrably reliable, require it on main alongside one review and resolved conversations. Restrict force pushes and keep any emergency bypass documented and narrow.

Acceptance: introduce a deliberately failing test on a throwaway PR and verify the merge is blocked; fix it and verify the gate recovers. Target PR feedback under 10 minutes, measured rather than promised. Cache dependencies, not prior test results.

GitHub warns that workflow-level path filtering can leave required checks pending; an always-running gate avoids that trap. [Required-check behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 2. Add tests around league behavior and data boundaries

| Layer | Priority scenarios | Execution |
| --- | --- | --- |
| Unit tests | Points/standings, goalie denominators and zero games, deterministic leaderboard ties, pagination boundaries, playoff seeding, penalty rules, recap selection | Every PR; JUnit for Java, Vitest for frontend utilities |
| React component tests | Season selection persists; points/goalie views; pagination resets on filters; loading/empty/error states; signed-out polling prompt and duplicate submission | Every PR; Testing Library with controlled API responses |
| API/database integration | Anonymous/member/admin authorization, inactive users, one vote under concurrent requests, transaction rollback, recap regeneration, season isolation, stat updates after score correction | Every PR; disposable PostgreSQL matching production's major version |
| Browser smoke | Login, archived season switch, points pagination, member vote, admin recap generation, scorekeeper saves a fictional game, retired tournament redirects | Every PR on a small deterministic fixture; Playwright against the built application |
| Extended checks | Other supported browsers, wider role matrix, accessibility, larger roster performance | Scheduled and before release; keep the blocking PR suite small |

Use real PostgreSQL for constraints, concurrency, and SQL behavior; H2 can remain useful for fast existing tests. Use disposable users and synthetic league data, fixed clocks where dates matter, and a stub mail service. Never copy production personal data or send real emails during tests. Retain browser traces/screenshots on failures with short retention and no credentials in artifacts.

Add JaCoCo and frontend coverage reports first. Establish a baseline, then ratchet coverage for changed business logic (proposed initial target: 80% changed-line coverage, tuned after the baseline). Do not chase a whole-repository percentage with trivial tests. Authorization denial, concurrent voting, scoring invariants, and failed transactions must have explicit tests regardless of the percentage. A flaky test gets an owner and a repair deadline; retries should expose, not conceal, instability.

## 3. Make database upgrades and release artifacts reproducible

- Inventory the real schema and migration history before selecting a baseline. Adopt one versioned migration runner, such as Flyway, with checksums and a single owner for the shared schema. Do not blindly replay every legacy script against production.
- Fix the existing shell runner before using it as any interim gate: it lacks `psql -v ON_ERROR_STOP=1`, and `((migration_count++))` returns failure when the initial value is zero under `set -e`. Initialization scripts alone do not upgrade existing volumes.
- Test both empty-database initialization and upgrading a synthetic previous-release schema. Start all services against the resulting schema. Transition every production profile to schema validation only after migration parity is proven.
- Build the frontend and four service images once for a green main commit on CI. Publish immutable digests with the commit SHA, scan images/dependencies, and generate an SBOM. A release manifest records all five digests plus migration version; never deploy by a moving `latest` tag.
- Prioritize new critical/high vulnerabilities; triage existing findings with an owner and expiry so a legacy backlog neither disappears nor permanently blocks every release. Add CodeQL, dependency update PRs, and secret scanning/push protection where available.

Acceptance: one clean checkout and disposable database produce the same application release manifest and pass the integration suite. The same image digests are tested and promoted.

## 4. Introduce controlled delivery to the existing Compose host

Keep the existing hosting model initially. Use an isolated CI Compose stack for automated acceptance; add a persistent staging host only if its cost and operational value justify it. The old Terraform dev environment is not the staging plan.

1. Select a green release manifest; verify its commit and test results. Deploy it to isolated staging with synthetic data and run smoke tests.
2. Request production approval through a protected GitHub environment, restricted to approved main/release refs. Serialize deployments; do not cancel a deployment mid-migration.
3. Authenticate to AWS using short-lived OIDC credentials with a narrowly scoped deployment role and repository/environment trust. Verify this repository's actual subject-claim format before configuring the trust policy. Keep runtime secrets on the host or in an approved secret store, out of images and build logs.
4. Check disk space, service health, drift, and database backup freshness. Take a verified pre-migration backup; stop if a prerequisite fails.
5. Apply reviewed additive migrations, pull the exact image digests, and replace services in their documented compatibility order. No builds on production. A single host may still need a maintenance window; do not claim zero downtime.
6. Run health and read-only public/auth smoke checks; verify the displayed release SHA. Record the deployment and its migration version.
7. On application failure, restore the previous compatible image manifest. Roll forward schema fixes where possible. Never automatically restore an old database backup and discard new writes; data recovery is a separate controlled procedure.

Acceptance: rehearse both a successful deployment and application rollback in staging. Prove backup restoration into an isolated database before relying on it for recovery.

GitHub supports environment approvals and branch restrictions; OIDC avoids storing long-lived AWS keys. [Deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [AWS OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

## 5. Maintain operational confidence

Add external uptime checks, API latency/error monitoring, database/disk/container health, and backup-age alerts with a named owner. Notify on actionable failures and deployment results, not every unchanged poll. Keep a short incident/rollback runbook and rehearse restores quarterly.

Track PR check time, flaky-test rate, failed deployments, recovery time, and time from merge to release. Review dependency upgrades weekly. Introduce heavier infrastructure only when measured load or recovery requirements justify it; RDS migration (#1) should have a separate cost, backup, and cutover decision.

Recommended implementation order: **PR gate and lint cleanup → behavior/database tests → migration baseline and immutable images → approved deployment and rollback → monitoring and recovery drills.** Keep production deploys manual until the earlier stages are proven.

Workflow security choices follow GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use). This document does not create cloud resources, alter repository protection, or enable production deployments.
