# Deploy pipeline: one-time setup

Once this is done, every merge to `main` deploys itself after you approve it:

```
merge to main
  -> "Deploy production" workflow queues and waits for your approval (production environment)
  -> job gets a 1-hour AWS session through GitHub OIDC (no stored AWS keys)
  -> AWS SSM Run Command on the prod box, as ubuntu, in the repo checkout:
       git fetch; run scripts/deploy/deploy.sh as it exists on origin/main
  -> workflow prints the script's output and fails if it failed
  -> workflow checks the public site returns 200 and serves the new frontend bundle
```

Nothing connects inbound to the box: the SSM agent on the box polls AWS over outbound HTTPS. What the
script does on the box, and what it refuses to do (migrations, `docker-compose.yml`), is described at
the top of [`scripts/deploy/deploy.sh`](../scripts/deploy/deploy.sh). When a deploy still has to be
done by hand: [`.agent/workflows/deploy-production.md`](../.agent/workflows/deploy-production.md).

**Nothing deploys until step 7.** The workflow only runs when the repository variable
`PROD_DEPLOY_ENABLED` is `true`, so merging the pipeline itself is safe before any of this is done.

This repo is public. Keep the account ID, instance ID, role ARN and site URL out of it: they go in
GitHub environment secrets (step 4), and the JSON files below stay on your machine. The commands use
`<ACCOUNT_ID>` and `<INSTANCE_ID>` as placeholders. The region is `us-east-1`.

## 0. Before you start

On the box, as `ubuntu`, confirm the checkout is the one the pipeline expects and that `git fetch`
works without a prompt (the pipeline runs it non-interactively):

```bash
cd ~/obhl-hockey-league-2.0 && git status -sb && git remote -v && git fetch --dry-run origin main
```

It should be on `main`, with no modified tracked files, and fetching from an `https://` remote (or
an SSH remote whose key needs no passphrase). Run `scripts/deploy/deploy.sh --dry-run` there once the
pipeline PR has merged, for a preview of what the first automated deploy will do.

## 1. Register GitHub as an OIDC identity provider in IAM

Console: IAM > Identity providers > Add provider > OpenID Connect.

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

If a provider for that URL already exists in the account, reuse it. Or with the CLI:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

(If an old CLI version insists on `--thumbprint-list`, upgrade it or use the console. AWS verifies
GitHub's certificate itself for this provider.)

## 2. Create the deploy role

**Trust policy** (`trust-policy.json`). Only jobs that run in this repo's `production` environment
can assume the role. The match is exact (`StringEquals`), not a wildcard:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:SimmonsCS28/obhl-hockey-league-2.0:environment:production"
        }
      }
    }
  ]
}
```

That `sub` is GitHub's default subject format for a job with `environment: production`. Confirm the
repo still uses it; this printed `"use_default":true` and `"use_immutable_subject":false` on
2026-11-13. If either changes, the subject format changes and this condition must change with it.

```bash
gh api repos/SimmonsCS28/obhl-hockey-league-2.0/actions/oidc/customization/sub
```

**Permissions** (`permissions-policy.json`). Run Command with the `AWS-RunShellScript` document on
this one instance, and reading the result. `GetCommandInvocation` does not support resource-level
permissions, so it takes `*`; it can only read command output.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RunShellScriptOnProdOnly",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:us-east-1:<ACCOUNT_ID>:instance/<INSTANCE_ID>",
        "arn:aws:ssm:us-east-1::document/AWS-RunShellScript"
      ]
    },
    {
      "Sid": "ReadCommandResults",
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

```bash
aws iam create-role --role-name obhl-github-deploy \
  --assume-role-policy-document file://trust-policy.json
aws iam put-role-policy --role-name obhl-github-deploy \
  --policy-name obhl-ssm-deploy --policy-document file://permissions-policy.json
aws iam get-role --role-name obhl-github-deploy --query Role.Arn --output text   # for step 4
```

Leave the role's maximum session at the default hour. The workflow keeps the whole deploy, polling
included, inside it (`EXECUTION_TIMEOUT_SECONDS` in the workflow).

Be clear about what this role is: `AWS-RunShellScript` runs any command as root on the box. What
stands between a GitHub user and that is the trust policy above, the environment's branch rule and
required reviewer (step 4), and branch protection on `main` (step 5).

## 3. Let SSM manage the instance

Check whether the instance already has an instance profile:

```bash
aws ec2 describe-instances --instance-ids <INSTANCE_ID> \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' --output text
```

**If it prints a profile ARN**, attach the managed policy to that profile's role (IAM > Instance
profiles shows which role it holds):

```bash
aws iam attach-role-policy --role-name <EXISTING_ROLE> \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
```

**If it prints `None`**, create a role and profile and attach it. This does not restart the
instance:

```bash
cat > ec2-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" }
  ]
}
EOF
aws iam create-role --role-name obhl-prod-ec2 --assume-role-policy-document file://ec2-trust.json
aws iam attach-role-policy --role-name obhl-prod-ec2 \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name obhl-prod-ec2
aws iam add-role-to-instance-profile --instance-profile-name obhl-prod-ec2 --role-name obhl-prod-ec2
aws ec2 associate-iam-instance-profile --instance-id <INSTANCE_ID> \
  --iam-instance-profile Name=obhl-prod-ec2
```

Canonical's Ubuntu AMIs ship the SSM agent as a snap. On the box, make sure it is there and restart
it so it picks up the new credentials straight away:

```bash
sudo snap list amazon-ssm-agent || sudo snap install amazon-ssm-agent --classic
sudo snap restart amazon-ssm-agent
```

Then confirm AWS sees it as **Online** (it can take a minute or two):

```bash
aws ssm describe-instance-information \
  --filters Key=InstanceIds,Values=<INSTANCE_ID> \
  --query 'InstanceInformationList[0].PingStatus' --output text
```

Optional smoke test from your own CLI, checking that the command path works and that `ubuntu` is in
the `docker` group:

```bash
aws ssm send-command --instance-ids <INSTANCE_ID> --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo -H -u ubuntu id","sudo -H -u ubuntu git -C /home/ubuntu/obhl-hockey-league-2.0 status -sb"]' \
  --query Command.CommandId --output text
aws ssm get-command-invocation --instance-id <INSTANCE_ID> --command-id <COMMAND_ID> \
  --query '[Status,StandardOutputContent]' --output text
```

## 4. Create the `production` environment in GitHub

Do this before step 7. If a workflow names an environment that does not exist, GitHub creates it with
no protection at all.

Settings > Environments > New environment > `production`:

- **Required reviewers:** `SimmonsCS28`. Leave "Prevent self-review" off: you are the only reviewer,
  and with it on you could never approve a deploy of a merge you made yourself.
- **Deployment branches and tags:** "Selected branches and tags", add the branch rule `main`. The
  trust policy only checks the environment name, so this rule is what stops a workflow on some other
  branch using the production role.
- **Environment secrets:**

  | Secret | Value |
  | --- | --- |
  | `AWS_DEPLOY_ROLE_ARN` | the role ARN from step 2 |
  | `PROD_INSTANCE_ID` | the instance ID (`i-...`) |
  | `PROD_SITE_URL` | the public site's `https://` URL. Use the domain, not the IP: the IP only redirects |

The same with `gh`, if you prefer (`gh api user --jq .id` gives your numeric user ID):

```bash
gh api -X PUT repos/SimmonsCS28/obhl-hockey-league-2.0/environments/production --input - <<'EOF'
{
  "reviewers": [{ "type": "User", "id": <YOUR_USER_ID> }],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
EOF
gh api -X POST repos/SimmonsCS28/obhl-hockey-league-2.0/environments/production/deployment-branch-policies \
  -f name=main -f type=branch
gh secret set AWS_DEPLOY_ROLE_ARN --env production   # each one prompts for its value
gh secret set PROD_INSTANCE_ID --env production
gh secret set PROD_SITE_URL --env production
```

## 5. Protect `main`

For the complete CI/review policy, see [Pull request checks](pull-request-checks.md#required-owner-setup-to-block-merges).
That guide recommends separate rulesets for mandatory checks and PR review so the owner can bypass
an impossible self-review without bypassing tests. The classic-rule examples below retain admin
bypass across the whole rule; admins must still wait for both checks and seek the other maintainer's
review. Do not enable the last-push approval requirement for this two-maintainer workflow.

If using classic branch protection instead of the recommended rulesets, configure a rule targeting
`main` in Settings > Branches with:

- One required approving review, code-owner review, stale approval dismissal, and resolved conversations.
- Both **`CI / required`** and **`deploy-lint`** as required checks, with branches required to be up to date.
  `deploy-lint` checks deployment shell scripts and all workflows without a PR path filter. GitHub
  offers a check in the selector after it has run.
- Force pushes and branch deletion disabled.
- **Require approval of the most recent reviewable push** off, so the reviewer can approve after
  helping update a two-maintainer PR.
- **Do not allow bypassing the above settings** off. SimmonsCS28 alone owns the workflow,
  deployment-script, CODEOWNERS, and deployment-guide paths. An owner-authored PR cannot satisfy
  its own code-owner approval, even if LewisJor approves. This requires the admin exception;
  ordinary changes should still receive the other maintainer's review. Classic protection cannot
  restrict this exception to review alone, which is why the separate rulesets are preferred.

The classic equivalent below replaces the whole rule. Inspect and preserve any additional existing
protections before applying it:

```bash
gh api -X PUT repos/SimmonsCS28/obhl-hockey-league-2.0/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "contexts": ["CI / required", "deploy-lint"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false
  },
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": null
}
EOF
```

## 6. Retire the old AWS keys

The repo-level secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` belong to the destroyed
Terraform dev stack. Nothing in the deploy pipeline uses them.

```bash
gh secret delete AWS_ACCESS_KEY_ID
gh secret delete AWS_SECRET_ACCESS_KEY
```

Deleting the GitHub secret does **not** revoke the key. In IAM, find the user the key belongs to
(IAM > Users > Security credentials, where "last used" helps), then deactivate the key and, once
nothing has complained, delete it:

```bash
aws iam list-access-keys --user-name <USER>
aws iam update-access-key --user-name <USER> --access-key-id <KEY_ID> --status Inactive
aws iam delete-access-key --user-name <USER> --access-key-id <KEY_ID>
```

The Terraform plan/apply workflows that used those secrets have been removed: the stack they managed
is gone (see `terraform/environments/dev/DESTROYED_STACK_RECORD.md`). The `terraform/` code is still
in the repo. If Terraform comes back, give it its own OIDC role rather than new keys.

## 7. Turn it on

Settings > Secrets and variables > Actions > Variables > New repository variable:
`PROD_DEPLOY_ENABLED` = `true`. Or `gh variable set PROD_DEPLOY_ENABLED --body true`.

Then do a dry run: Actions > Deploy production > Run workflow, tick **Dry run**, and approve it when
asked. The log should show the plan from the box ("DRY RUN: nothing will be pulled, built or
restarted") and a passing public-site check. That exercises OIDC, the role, SSM and the script
without changing anything. The next merge to `main` deploys for real.

To pause deploys, for a manual deploy say, set `PROD_DEPLOY_ENABLED` to `false`.

## Day to day

- **Merging** queues a run that waits for your approval. Approve it from the run page or the
  notification. Runs never overlap. If several merges queue up, the newest waiting run replaces the
  older waiting ones; nothing is lost, because the script always deploys the tip of `main`.
- **A run that stops on purpose** exits non-zero with the reason at the end of its output, before
  anything is pulled or built: migrations in the range, a `docker-compose.yml` change, local edits on
  the box, or a disk still over 90% after pruning. See the runbook for each.
- **Migrations:** apply them by hand (the failed run prints the exact commands), then Run workflow
  with **migrations applied** ticked.
- **A run that fails part-way** (build error, a service that never turns healthy) says which services
  it finished. The box remembers where that deploy started, so the next run, whether a re-run or the
  fix-forward merge, rebuilds everything the failed one skipped.
- **Logs:** the full build output and any container logs are on the box in `~/obhl-deploy-logs`
  (last 30 runs). The Actions log only gets a summary, because it is public.
- **Workflow or script changes** (`.github/workflows/deploy-production.yml`, `scripts/deploy/`)
  change what runs as root on prod. Review them with that in mind.
