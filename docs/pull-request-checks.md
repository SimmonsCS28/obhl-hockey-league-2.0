# Pull request checks

The `CI` workflow runs on PRs targeting main, pushes to main, merge queues, and manual dispatch. `Deploy lint` checks PRs and merge queues separately. These validation workflows do not deploy; the separate production workflow handles merges to main as described in [the deployment guide](deploy-pipeline-setup.md).

CODEOWNERS requests reviews from both `@SimmonsCS28` and `@LewisJor` for ordinary paths. The later owner-only rules override that default: `.github/workflows/`, `.github/CODEOWNERS`, `scripts/deploy/`, and `docs/deploy-pipeline-setup.md` require `@SimmonsCS28`. The PR author cannot approve their own PR; draft review requests wait until ready for review.

## Automated checks

| Job | Checks |
| --- | --- |
| Backend / each service | Java 21, validated Gradle wrapper, `test bootJar` for all four services; test reports retained seven days |
| Frontend | Node 22, `npm ci`, whole-project ESLint, Node's built-in test runner, Vite production build |
| Repository checks | PR whitespace validation and Python recap-helper tests |
| CI / required | Always runs after the backend, frontend, and repository jobs; fails for any failed, skipped, or cancelled dependency |
| deploy-lint | Shellcheck for `scripts/deploy/*.sh` and actionlint for every workflow, including workflow shell commands |

**Require both `CI / required` and `deploy-lint`.** The CI aggregator cannot include a job from another workflow; a green CI result alone does not establish that deployment scripts passed shellcheck. Workflow linting runs only in `deploy-lint`, using its SHA-256-verified pinned release binaries.

Actions are pinned to verified commit hashes. Validation runs use read-only repository permissions and no deployment secrets, on ephemeral GitHub-hosted runners. Only superseded PR runs are cancelled; non-PR CI runs get their own concurrency group so successive main commits do not cancel each other. Dependabot groups weekly minor/patch updates per ecosystem; major upgrades remain separate proposals, and all updates still require checks and review.

The frontend unit suite covers standings priorities, missing records, stable ties, immutable input, rank labels, and Central game-date formatting including explicit timezone offsets. It is a utility suite, not React/browser integration coverage. Backend jobs run each service's JUnit suite when present; a service with no tests reports `NO-SOURCE` and verifies only compilation/packaging. Repository checks run `scripts/tests/test_generate_season_recap.py` through unittest discovery.

The warning budget is defined once in the `lint` script in `frontend/package.json`. Both local development and CI run `npm run lint`; reduce the budget as existing hook dependency warnings are fixed. Narrow, documented exceptions retain intentional provider/hook exports and mount-time hydration/network effects. No global lint rule is disabled.

## Required owner setup to block merges

Adding a workflow does not itself prevent a merge. A repository administrator must configure the protections in GitHub. Use [deployment setup §5](deploy-pipeline-setup.md#5-protect-main) for the existing classic-rule option and its admin-bypass rationale. For rulesets, use the following two active branch rulesets targeting `main` so an ownership exception does not also bypass CI:

1. **Checks and branch integrity:** require both `CI / required` and `deploy-lint`, sourced from GitHub Actions, and require branches to be up to date. Block force pushes and deletion. Keep this ruleset's bypass list empty.
2. **PR review:** require a pull request with one approving review, code-owner review, dismissal of stale approvals after new commits, and resolved conversations. Leave **Require approval of the most recent reviewable push** off: if the reviewer updates the author's branch, a two-maintainer team otherwise has no eligible approver until the author pushes again. Add only the repository administrator role to this review ruleset's bypass list, with **For pull requests only**.

The review bypass is needed for a PR authored by SimmonsCS28 that touches an owner-only path: the author cannot approve it, and LewisJor's approval does not satisfy that ownership rule. Request the other maintainer's review and document why the ownership bypass is used. The independent checks ruleset still requires green CI and deploy lint. Do not grant bypass to the write role or use it to skip a failing check.

For ordinary paths, one eligible owner's approval satisfies code ownership; both owners are not required. For owner-only paths, SimmonsCS28's approval is required unless the documented admin PR bypass applies. Inspect existing classic rules and other rulesets before adding these settings: GitHub enforces all applicable rules, so a conflicting last-push or ownership rule elsewhere can still block the intended workflow. Repository settings do not change just because this guide is merged.

Update existing feature branches from main to pick up CI and lint cleanup. Draft PRs still run CI, but code-owner requests wait until ready for review.

Acceptance checks: use a disposable PR with a failing unit assertion, verify `CI / required` and merging fail, then fix it. Separately introduce a shellcheck violation in a disposable deploy-script change and verify `deploy-lint` blocks merging even when CI passes. Verify a reviewer can approve after updating the author's branch, and that an owner-authored deploy-path PR can use the review bypass only after both checks pass. Green runs alone do not prove the repository rules are enabled.

## Local equivalents

Use the Node version in `frontend/.nvmrc` and Java 21:

```sh
cd frontend
npm ci
npm run lint
npm test
npm run build
```

In each `backend/<service>` directory, run `bash ./gradlew --no-daemon test bootJar`. From the repository root, run `python3 -m unittest discover -s scripts/tests -v`, `shellcheck -S style scripts/deploy/*.sh`, and `actionlint`. Use the pinned tool versions in `.github/workflows/deploy-lint.yml`; that workflow is the single source of truth for workflow/shell lint tooling.

Browser/API integration tests, PostgreSQL migration checks, and dependency vulnerability gating remain follow-up coverage. Production delivery has a separate [setup and operating guide](deploy-pipeline-setup.md).

References: [code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks), [layered rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [PR-only bypass](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).
