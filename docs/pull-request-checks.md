# Pull request checks

The `CI` workflow runs on PRs targeting main, pushes to main, merge queues, and manual dispatch. It does not deploy the application. CODEOWNERS requests reviews from `@SimmonsCS28` and `@LewisJor` once present on the PR's base branch; the PR author cannot review their own change, and draft requests wait until ready for review.

## Automated checks

| Job | Checks |
| --- | --- |
| Backend / each service | Java 21, validated Gradle wrapper, `test bootJar` for all four services; test reports retained seven days |
| Frontend | Node 22, `npm ci`, whole-project ESLint, Node's built-in test runner, Vite production build |
| Repository checks | actionlint for every workflow, PR whitespace validation, Python helper tests when that suite exists |
| CI / required | Always runs after all check jobs; fails for any failed, skipped, or cancelled dependency |

Actions are pinned to verified commit hashes. PR runs use read-only repository permissions and no deployment secrets, run on ephemeral GitHub-hosted runners, and cancel superseded runs. Dependabot proposes weekly dependency/action updates; those updates still require checks and review.

The frontend unit suite covers standings priorities, missing records, stable ties, immutable input, and rank labels. It is an initial utility test suite, not React/browser integration coverage. The stats service currently has no tests: its matrix job verifies compilation and packaging, and Gradle reports `NO-SOURCE` for tests. The other services run their existing JUnit suites. Python tests will run automatically when the recap helper suite lands.

The lint baseline has zero errors and 14 existing hook dependency warnings. CI caps warnings at 14 so new warnings fail; reduce that cap as warnings are fixed. Narrow, documented exceptions retain the existing provider/hook export pattern and intentional mount-time hydration/network effects. No global lint rule is disabled. Runtime cleanup removes unused code, redundant state, unnecessary escapes, and an already-overridden duplicate API method.

## Required owner setup to block merges

Adding a workflow does not itself prevent a merge. As of this change, the connected `LewisJor` account has write access but not repository administration access. An administrator (`SimmonsCS28`) must configure this rule; this PR does not claim the rule is already enforced.

After the first successful run, use **Settings → Rules → Rulesets** to create or update the active rule targeting `main`. Preserve existing rules if present:

1. Require a pull request before merging, with **one approving review**.
2. Require code-owner review, dismiss stale approvals after new commits, and require approval of the most recent reviewable push by someone other than its pusher.
3. Require conversations to be resolved.
4. Require the status check named **`CI / required`**, sourced from GitHub Actions. Require the branch to be up to date before merging. Select the actual completed check from this PR's run.
5. Block force pushes and deletion. Keep bypass permissions empty unless an explicitly documented emergency process requires them.

One code-owner approval satisfies the ownership requirement; CODEOWNERS does not require both named owners to approve. The separate one-review rule ensures a PR author needs another maintainer's approval. New rule settings are repository configuration and are not activated by merging this file.

Once merged, update existing feature branches from main to pick up CI and any lint cleanup before merging them. Keep #38 as a draft until its work is ready. Draft PRs still run CI, but code-owner requests wait until ready for review.

Acceptance check for the rule: use a disposable PR with a deliberately failing unit assertion, verify that `CI / required` fails and the merge control is blocked, then fix the assertion and confirm checks recover. A green CI run alone does not prove the repository rule has been enabled.

## Local equivalents

Use the Node version in `frontend/.nvmrc` and Java 21:

```sh
cd frontend
npm ci
npm run lint -- --max-warnings 14
npm test
npm run build
```

In each `backend/<service>` directory, run `bash ./gradlew --no-daemon test bootJar`. Run `actionlint` from the repository root to validate workflows. The CI workflow's pinned actionlint version is the reference version.

Browser/API integration tests, PostgreSQL migration checks, dependency vulnerability gating, and controlled releases are the next stages of the CI/CD strategy. They are not represented as completed checks by this initial workflow.

References: [code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
