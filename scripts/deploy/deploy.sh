#!/usr/bin/env bash
#
# deploy.sh - deploy origin/main to the production box.
#
# Runs ON the prod box, from anywhere inside the repo checkout, as the user that
# owns the checkout and is in the docker group (ubuntu). The GitHub Actions
# workflow .github/workflows/deploy-production.yml runs it through AWS SSM Run
# Command; you can also run it by hand on the box.
#
# What it does (every abort happens before anything is pulled or built):
#   1. Refuse to run if tracked files have local edits (drift on the box).
#   2. git fetch, then work out which paths changed between HEAD and origin/main.
#   3. Refuse to run if the range touches database/migrations/ (migrations are
#      applied by hand and must land before the owning service is rebuilt) or
#      docker-compose.yml (service definitions changed; recreate by hand).
#   4. If / is over 80% full, prune Docker build cache and dangling images.
#   5. Fast-forward the checkout to the commit the plan was made for.
#   6. Rebuild each changed Java service ONE AT A TIME, waiting for it to report
#      healthy before the next build starts. The box has 3.7Gi of RAM, and
#      building every image at once has taken production down before.
#   7. Rebuild the frontend last.
# It never runs `docker compose down` and never recreates postgres.
#
# Usage: scripts/deploy/deploy.sh [options]
#   --dry-run             Print the plan and exit without pulling, building or
#                         restarting anything. Still runs `git fetch` (which only
#                         moves the origin/main tracking ref) unless --no-fetch.
#                         Exits with the same code a real run would.
#   --migrations-applied  The range contains migrations and you have ALREADY
#                         applied them to the prod database by hand; deploy anyway.
#   --no-fetch            Plan against the origin/main ref already on disk.
#   --base REV            (dry run only) Pretend the box is checked out at REV.
#   --target REV          (dry run only) Pretend origin/main points at REV.
#                         Together these replay any past range of history.
#   -h, --help            Show this help.
#
# Exit codes:
#   0  deployed, or nothing to deploy      4  manual deploy required (migrations,
#   1  a build, health check or git step       docker-compose.yml)
#      failed part-way                     5  checkout cannot fast-forward to origin/main
#   2  bad usage                           6  disk still too full after pruning
#   3  tracked files have local edits      7  another deploy is already running
#
# The last lines of output are machine-readable, for the workflow:
#   DEPLOY_RESULT=deployed|up-to-date|dry-run   DEPLOY_SHA=<commit>
#   DEPLOY_FRONTEND_BUNDLE=/assets/index-<hash>.js   (when the frontend answers locally)
#
# Output is kept short on purpose: SSM keeps only the first 24,000 characters of
# stdout, and the GitHub Actions log of this public repo is public. Full build
# output and container logs go to $DEPLOY_LOG_DIR (default ~/obhl-deploy-logs).

set -euo pipefail

readonly REMOTE=origin
readonly BRANCH=main
# Build order. api-gateway goes last because it fronts the other three.
readonly -a JAVA_SERVICES=(league-service game-service stats-service api-gateway)
# Dead file that has sat untracked on the box for a long time; not worth a warning.
readonly KNOWN_UNTRACKED='frontend/src/components/api.js'
# Base commit of a deploy that pulled but did not finish. While it exists, the
# next run plans from it, so services the failed run never rebuilt are not lost.
readonly PENDING_REF=refs/obhl-deploy/pending-base

readonly DISK_PRUNE_PCT=${DEPLOY_DISK_PRUNE_PCT:-80}
readonly DISK_ABORT_PCT=${DEPLOY_DISK_ABORT_PCT:-90}
readonly HEALTH_TIMEOUT=${DEPLOY_HEALTH_TIMEOUT:-420}
readonly FRONTEND_LOCAL_URL=${DEPLOY_FRONTEND_LOCAL_URL:-http://127.0.0.1:8080/}
readonly LOG_DIR=${DEPLOY_LOG_DIR:-$HOME/obhl-deploy-logs}
readonly LOGS_TO_KEEP=30

readonly EXIT_FAILED=1 EXIT_USAGE=2 EXIT_DIRTY=3 EXIT_MANUAL=4 EXIT_NOT_FF=5 EXIT_DISK=6 EXIT_LOCKED=7

DRY_RUN=0
MIGRATIONS_APPLIED=0
NO_FETCH=0
BASE_OVERRIDE=
TARGET_OVERRIDE=
LOG_FILE=/dev/null

HEAD_SHA=          # what the checkout is at (or pretends to be at)
BASE_SHA=          # diff base: HEAD_SHA, or an unfinished deploy's base
TARGET_SHA=        # what we are deploying
CHANGED=()         # paths changed in BASE_SHA..TARGET_SHA
MIGRATIONS=()
HOST_FILES=()      # deploy/** - host nginx etc., applied by hand
UNMAPPED=()        # backend/** paths that belong to no known service
BUILD_JAVA=()      # Java services to rebuild, in build order
BUILD_FRONTEND=0
COMPOSE_CHANGED=0
ENV_EXAMPLE_CHANGED=0
DONE=()            # services rebuilt so far in this run

# --------------------------------------------------------------------------- output

say()  { printf '%s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*"; }
short() { git rev-parse --short "$1"; }
subject() { git log -1 --format='%h %s' "$1"; }

die() {
  local code=$1
  shift
  printf '\nABORTED: %s\n' "$*"
  exit "$code"
}

usage() { sed -n '/^# Usage:/,/^# Exit codes:/{/^# Exit codes:/d; s/^# \{0,1\}//; p}' "$0"; }

# run CMD...: print the command; unless this is a dry run, run it with its output
# sent to the log file, and on failure show the tail of that output.
run() {
  printf '  $ %s\n' "$*"
  if ((DRY_RUN)); then return 0; fi
  local started=$SECONDS rc=0 mark
  printf '\n### %s  $ %s\n' "$(date -u +%FT%TZ)" "$*" >>"$LOG_FILE"
  mark=$(wc -l <"$LOG_FILE")
  "$@" >>"$LOG_FILE" 2>&1 || rc=$?
  if ((rc != 0)); then
    printf '    FAILED (exit %d) after %ds. Last lines of output:\n' "$rc" $((SECONDS - started))
    tail -n +$((mark + 1)) "$LOG_FILE" | tail -n 60 | sed 's/^/    | /'
    return "$rc"
  fi
  printf '    ok (%ds)\n' $((SECONDS - started))
}

# Container logs can contain member names and emails, and the Actions log of this
# repo is public, so they are saved on the box rather than printed.
save_container_logs() {
  docker compose logs --no-color --tail 300 "$1" >>"$LOG_FILE" 2>&1 || true
  say "    last 300 lines of '$1' container logs saved to $LOG_FILE on the box"
}

served_bundle() {
  curl -fsS --max-time 5 "$FRONTEND_LOCAL_URL" 2>/dev/null |
    grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -n 1 || true
}

contains() {
  local needle=$1 item
  shift
  for item in "$@"; do [[ $item == "$needle" ]] && return 0; done
  return 1
}

# --------------------------------------------------------------------------- steps

parse_args() {
  while (($#)); do
    case $1 in
      --dry-run) DRY_RUN=1 ;;
      --migrations-applied) MIGRATIONS_APPLIED=1 ;;
      --no-fetch) NO_FETCH=1 ;;
      --base | --target)
        if (($# < 2)); then usage; die "$EXIT_USAGE" "$1 needs a revision"; fi
        if [[ $1 == --base ]]; then BASE_OVERRIDE=$2; else TARGET_OVERRIDE=$2; fi
        shift
        ;;
      -h | --help) usage; exit 0 ;;
      *) usage; die "$EXIT_USAGE" "unknown option: $1" ;;
    esac
    shift
  done
  if [[ -n $BASE_OVERRIDE$TARGET_OVERRIDE ]] && ((!DRY_RUN)); then
    die "$EXIT_USAGE" "--base/--target replay a range of history and only work with --dry-run"
  fi
}

start_log_and_lock() {
  mkdir -p "$LOG_DIR"
  LOG_FILE=$LOG_DIR/deploy-$(date -u +%Y%m%dT%H%M%SZ).log
  : >"$LOG_FILE"
  # shellcheck disable=SC2012  # log names are ours: deploy-<timestamp>.log
  ls -1t "$LOG_DIR"/deploy-*.log 2>/dev/null | tail -n +$((LOGS_TO_KEEP + 1)) | xargs -r rm -f --
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOG_DIR/.deploy.lock"
    flock -n 9 || die "$EXIT_LOCKED" "another deploy is already running on this box"
  else
    warn "flock not installed; not guarding against a concurrent deploy"
  fi
  docker compose version >/dev/null 2>&1 || die "$EXIT_FAILED" "'docker compose' is not available to $(id -un)"
}

check_working_tree() {
  step "1. Working tree"
  local dirty untracked
  dirty=$(git status --porcelain --untracked-files=no)
  if [[ -n $dirty ]]; then
    say "$dirty" | sed 's/^/  /'
    die "$EXIT_DIRTY" "tracked files on the box have local edits (listed above). Production has been
hand-edited before; a deploy would either fail to pull or silently keep the edit.
Find out why they are there, then commit them through a PR or discard them
(git checkout -- <file>), and re-run."
  fi
  say "  no tracked changes"
  untracked=$(git status --porcelain --untracked-files=normal |
    sed -n 's/^?? //p' | grep -vxF "$KNOWN_UNTRACKED" || true)
  if [[ -n $untracked ]]; then
    # Counted, not listed: the Actions log is public. `git status` on the box names them.
    warn "$(wc -l <<<"$untracked" | tr -d ' ') untracked path(s) besides $KNOWN_UNTRACKED; a pull fails if it would overwrite one"
  fi
}

resolve_range() {
  step "2. Fetch"
  if [[ -n $TARGET_OVERRIDE ]]; then
    say "  skipped: replaying history (--target)"
    TARGET_SHA=$(git rev-parse --verify -q "$TARGET_OVERRIDE^{commit}") ||
      die "$EXIT_USAGE" "--target: unknown revision $TARGET_OVERRIDE"
  else
    if ((NO_FETCH)); then
      say "  skipped (--no-fetch)"
    else
      say "  $ git fetch $REMOTE $BRANCH"
      git fetch --quiet "$REMOTE" "+refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH" ||
        die "$EXIT_FAILED" "git fetch failed"
    fi
    TARGET_SHA=$(git rev-parse --verify -q "$REMOTE/$BRANCH^{commit}") ||
      die "$EXIT_FAILED" "no $REMOTE/$BRANCH ref"
  fi

  if [[ -n $BASE_OVERRIDE ]]; then
    HEAD_SHA=$(git rev-parse --verify -q "$BASE_OVERRIDE^{commit}") ||
      die "$EXIT_USAGE" "--base: unknown revision $BASE_OVERRIDE"
    BASE_SHA=$HEAD_SHA
  else
    local branch pending
    branch=$(git symbolic-ref --short -q HEAD || echo '(detached HEAD)')
    [[ $branch == "$BRANCH" ]] ||
      die "$EXIT_NOT_FF" "the checkout is on '$branch', not '$BRANCH'"
    HEAD_SHA=$(git rev-parse HEAD)
    BASE_SHA=$HEAD_SHA
    pending=$(git rev-parse -q --verify "$PENDING_REF^{commit}" || true)
    if [[ -n $pending && $pending != "$HEAD_SHA" ]]; then
      if git merge-base --is-ancestor "$pending" "$HEAD_SHA"; then
        warn "the deploy from $(short "$pending") pulled but did not finish; planning from there so"
        say "         the services it never rebuilt are rebuilt now"
        BASE_SHA=$pending
      else
        warn "ignoring $PENDING_REF: $(short "$pending") is not an ancestor of HEAD"
      fi
    fi
  fi

  if ! git merge-base --is-ancestor "$HEAD_SHA" "$TARGET_SHA"; then
    die "$EXIT_NOT_FF" "HEAD $(short "$HEAD_SHA") is not an ancestor of $REMOTE/$BRANCH $(short "$TARGET_SHA").
The box has commits that are not on $BRANCH, or $BRANCH was rewritten. Sort it out by hand."
  fi
}

classify_changes() {
  step "3. Changes"
  say "  deployed: $(subject "$HEAD_SHA")"
  [[ $BASE_SHA == "$HEAD_SHA" ]] || say "  base:     $(subject "$BASE_SHA")  (unfinished deploy)"
  say "  target:   $(subject "$TARGET_SHA")"

  # --no-renames, so a file moved out of a watched directory still counts.
  local diff status path svc
  local -A wanted=()
  # Captured first rather than read from a process substitution, so a git failure
  # aborts instead of looking like "nothing changed".
  diff=$(git diff --name-status --no-renames "$BASE_SHA" "$TARGET_SHA") || die "$EXIT_FAILED" "git diff failed"
  while IFS=$'\t' read -r status path; do
    [[ -n $path ]] || continue
    CHANGED+=("$path")
    case $path in
      database/migrations/*) MIGRATIONS+=("$status $path") ;;
      docker-compose.yml) COMPOSE_CHANGED=1 ;;
      .env.example) ENV_EXAMPLE_CHANGED=1 ;;
      frontend/*) BUILD_FRONTEND=1 ;;
      deploy/*) HOST_FILES+=("$path") ;;
      backend/*)
        svc=${path#backend/}
        svc=${svc%%/*}
        if contains "$svc" "${JAVA_SERVICES[@]}"; then wanted[$svc]=1; else UNMAPPED+=("$path"); fi
        ;;
    esac
  done <<<"$diff"
  for svc in "${JAVA_SERVICES[@]}"; do
    [[ -z ${wanted[$svc]:-} ]] || BUILD_JAVA+=("$svc")
  done
  ((${#CHANGED[@]})) || return 0

  local count
  count=$(git rev-list --count "$BASE_SHA..$TARGET_SHA")
  say "  $count commit(s):"
  git log --max-count=25 --format='    %h %s' "$BASE_SHA..$TARGET_SHA"
  ((count <= 25)) || say "    ... and $((count - 25)) more"
  say "  ${#CHANGED[@]} changed path(s), by area:"
  printf '%s\n' "${CHANGED[@]}" | awk -F/ '
    { key = (NF > 2) ? $1 "/" $2 "/" : (NF == 2 ? $1 "/" : "(top-level files)"); n[key]++ }
    END { for (k in n) printf "    %-44s %4d\n", k, n[k] }' | sort
}

print_plan() {
  step "4. Plan"
  local rebuild=("${BUILD_JAVA[@]}")
  ((BUILD_FRONTEND)) && rebuild+=(frontend)
  if ((${#rebuild[@]})); then
    say "  rebuild, one at a time: ${rebuild[*]}"
  else
    say "  rebuild: nothing (no frontend/ or backend/<service>/ changes)"
  fi
  ((!BUILD_FRONTEND)) || say "  (rebuilding frontend also recreates api-gateway, through depends_on)"
  say "  migrations (A=added M=edited D=deleted): ${#MIGRATIONS[@]}"
  ((${#MIGRATIONS[@]} == 0)) || printf '    %s\n' "${MIGRATIONS[@]}"

  ((!ENV_EXAMPLE_CHANGED)) ||
    warn ".env.example changed: check the box's .env has every variable docker-compose.yml needs"
  if ((${#HOST_FILES[@]})); then
    warn "host-level files changed; the pipeline does not apply these, do it by hand:"
    printf '  %s\n' "${HOST_FILES[@]}"
  fi
  if ((${#UNMAPPED[@]})); then
    warn "backend paths that belong to no known service (not rebuilt):"
    printf '  %s\n' "${UNMAPPED[@]}"
  fi
}

check_manual_steps() {
  local blocked=0
  if ((${#MIGRATIONS[@]})); then
    if ((MIGRATIONS_APPLIED)); then
      warn "deploying past ${#MIGRATIONS[@]} migration(s) because --migrations-applied says they are"
      say "         already applied to the prod database"
    else
      blocked=1
      say ""
      say "MANUAL STEP NEEDED: this range adds or changes database migrations."
      say "  Migrations are applied by hand, and must land BEFORE the service that owns the"
      say "  table is rebuilt: league-service validates the schema at startup and will refuse"
      say "  to boot, and api-gateway, game-service and stats-service (ddl-auto=update) would"
      say "  invent their own version of the schema instead. Nothing has been pulled or built."
      say "  1. Apply each new one, in order, straight from the target commit:"
      local entry status file
      for entry in "${MIGRATIONS[@]}"; do
        status=${entry%% *}
        file=${entry#* }
        if [[ $status == A ]]; then
          say "       git show $(short "$TARGET_SHA"):$file | docker exec -i obhl-postgres psql -v ON_ERROR_STOP=1 -U obhl_admin -d obhl_db"
        else
          say "       $file was $( [[ $status == D ]] && echo deleted || echo edited ), not added: decide by hand what that means for prod"
        fi
      done
      say "  2. Re-run this deploy with --migrations-applied. From GitHub: Actions >"
      say "     Deploy production > Run workflow, and tick 'migrations applied'."
    fi
  fi
  if ((COMPOSE_CHANGED)); then
    blocked=1
    say ""
    say "MANUAL STEP NEEDED: docker-compose.yml changed."
    say "  A compose change can alter any service, postgres included, and path-based"
    say "  rebuilds would not apply it. Deploy this range by hand with"
    say "  .agent/workflows/deploy-production.md, recreating each affected service on its own."
  fi
  if ((blocked)); then
    die "$EXIT_MANUAL" "manual deploy required (see above). Nothing was pulled or built."
  fi
}

# Percentage of / in use, as a bare number.
disk_pct() {
  local pct
  pct=$(df --output=pcent / | tail -n 1 | tr -dc '0-9')
  [[ $pct =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$pct"
}

check_disk() {
  step "5. Disk"
  local pct
  pct=$(disk_pct) || die "$EXIT_FAILED" "could not read disk usage from df"
  say "  / is ${pct}% full (prune at ${DISK_PRUNE_PCT}%, abort at ${DISK_ABORT_PCT}%)"
  ((pct >= DISK_PRUNE_PCT)) || return 0
  run docker builder prune -f || die "$EXIT_FAILED" "docker builder prune failed"
  run docker image prune -f || die "$EXIT_FAILED" "docker image prune failed"
  if ((DRY_RUN)); then
    say "  (a real run re-checks here and aborts if / is still at ${DISK_ABORT_PCT}% or more)"
    return 0
  fi
  pct=$(disk_pct) || die "$EXIT_FAILED" "could not read disk usage from df"
  say "  / is ${pct}% full after pruning"
  if ((pct >= DISK_ABORT_PCT)); then
    die "$EXIT_DISK" "/ is still ${pct}% full. Postgres lives on this disk too, so a build that fills it
takes the database down. Free space by hand (docker system df; docker builder prune -af) and re-run."
  fi
}

update_checkout() {
  step "6. Update checkout"
  # Remember where this deploy started until it finishes, so a failure part-way
  # does not lose the services it had not rebuilt yet.
  if ((!DRY_RUN)) && [[ $BASE_SHA == "$HEAD_SHA" ]]; then
    git update-ref "$PENDING_REF" "$BASE_SHA"
  fi
  # `git pull --ff-only`, split in two: the fetch already happened in step 2, and
  # merging the exact commit that was planned means a push that lands mid-deploy
  # (possibly with a migration) is left for the next run instead of slipping in.
  run git merge --ff-only --quiet "$TARGET_SHA" || die "$EXIT_FAILED" "fast-forward failed; nothing was built"
}

fail_deploy() {
  say ""
  say "DEPLOY FAILED: $*"
  say "  The checkout is at $(short "$TARGET_SHA"). Rebuilt and healthy this run: ${DONE[*]:-nothing}."
  say "  The next run plans from $(short "$BASE_SHA") again, so a fix-forward merge rebuilds"
  say "  everything this run skipped. To roll back instead, follow 'If it goes wrong' in"
  say "  .agent/workflows/deploy-production.md (previous commit: $(short "$BASE_SHA"))."
  say "  Full output: $LOG_FILE"
  exit "$EXIT_FAILED"
}

wait_healthy() {
  local svc=$1 cid state started=$SECONDS
  say "  waiting for $svc to report healthy (up to ${HEALTH_TIMEOUT}s)"
  if ((DRY_RUN)); then return 0; fi
  cid=$(docker compose ps -a -q "$svc")
  if [[ -z $cid ]]; then
    say "    no $svc container"
    return 1
  fi
  while :; do
    state=$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid") ||
      return 1
    case $state in
      running/healthy | running/no-healthcheck)
        say "    $state after $((SECONDS - started))s"
        return 0
        ;;
      running/starting) ;;
      *)
        say "    $svc is $state"
        save_container_logs "$svc"
        return 1
        ;;
    esac
    if ((SECONDS - started >= HEALTH_TIMEOUT)); then
      say "    still $state after ${HEALTH_TIMEOUT}s"
      save_container_logs "$svc"
      return 1
    fi
    sleep 5
  done
}

# The frontend image has no HEALTHCHECK; instead, poll it until it serves index.html.
wait_frontend() {
  local started=$SECONDS
  say "  waiting for the frontend to serve index.html on the box (up to 120s)"
  if ((DRY_RUN)); then return 0; fi
  until curl -fsS --max-time 5 -o /dev/null "$FRONTEND_LOCAL_URL"; do
    if ((SECONDS - started >= 120)); then
      save_container_logs frontend
      return 1
    fi
    sleep 3
  done
  say "    serving after $((SECONDS - started))s"
}

deploy_services() {
  local svc
  step "7. Java services"
  ((${#BUILD_JAVA[@]})) || say "  none"
  for svc in "${BUILD_JAVA[@]}"; do
    say "  -- $svc"
    run docker compose build "$svc" || fail_deploy "building $svc"
    # --no-deps: start only this service. Without it compose would also reconcile
    # postgres, and recreate it if its definition had drifted.
    run docker compose up -d --no-deps "$svc" || fail_deploy "starting $svc"
    wait_healthy "$svc" || fail_deploy "$svc did not become healthy"
    DONE+=("$svc")
  done

  step "8. Frontend"
  if ((!BUILD_FRONTEND)); then
    say "  no frontend changes"
    return 0
  fi
  if ! contains api-gateway "${BUILD_JAVA[@]}"; then
    # `up --build frontend` also builds api-gateway (its depends_on), in parallel with
    # the npm build. Normally that is a cache hit, but after step 5 pruned the cache it
    # would be a full Gradle build running alongside npm. Building it first, alone,
    # makes the parallel one a cache hit either way.
    say "  -- api-gateway image (so the depends_on build below is a cache hit)"
    run docker compose build api-gateway || fail_deploy "building api-gateway"
  fi
  say "  -- frontend"
  run docker compose up -d --build frontend || fail_deploy "building frontend"
  wait_healthy api-gateway || fail_deploy "api-gateway did not become healthy after the frontend deploy"
  DONE+=(frontend)
  wait_frontend || fail_deploy "the frontend is not serving on the box"
}

finish() {
  local result=$1
  if ((!DRY_RUN)); then
    git update-ref -d "$PENDING_REF" 2>/dev/null || true
    step "Status"
    docker compose ps --format 'table {{.Service}}\t{{.Status}}' 2>/dev/null || docker compose ps || true
    free -h 2>/dev/null | sed -n '1,2p' || true
    say "  log: $LOG_FILE"
  fi
  say ""
  say "DEPLOY_RESULT=$result"
  say "DEPLOY_SHA=$TARGET_SHA"
  local bundle
  bundle=$(served_bundle)
  [[ -z $bundle ]] || say "DEPLOY_FRONTEND_BUNDLE=$bundle"
}

# --------------------------------------------------------------------------- main

main() {
  exec 2>&1 # one ordered stream: SSM returns stdout and stderr separately
  parse_args "$@"

  local repo
  repo=$(git rev-parse --show-toplevel 2>/dev/null) || die "$EXIT_USAGE" "run this from inside the repo checkout"
  cd "$repo"
  [[ -f docker-compose.yml ]] || die "$EXIT_USAGE" "$repo has no docker-compose.yml"

  say "OBHL production deploy, $(date -u '+%F %T UTC')"
  if ((DRY_RUN)); then
    say "DRY RUN: nothing will be pulled, built or restarted."
    [[ -z $BASE_OVERRIDE$TARGET_OVERRIDE ]] || say "Replaying history: ${BASE_OVERRIDE:-HEAD}..${TARGET_OVERRIDE:-$REMOTE/$BRANCH}"
  else
    start_log_and_lock
  fi

  check_working_tree
  resolve_range
  classify_changes

  if [[ $BASE_SHA == "$TARGET_SHA" ]]; then
    say "  already at $(short "$TARGET_SHA"); nothing to deploy"
    finish up-to-date
    return 0
  fi

  print_plan
  check_manual_steps
  if ((${#BUILD_JAVA[@]} + BUILD_FRONTEND > 0)); then
    check_disk
  fi
  update_checkout
  deploy_services

  if ((DRY_RUN)); then
    finish dry-run
  else
    finish deployed
  fi
}

# Bash parses this whole block before running it, and `exit` stops it reading any
# further, so the fast-forward in step 6 rewriting this file underneath a by-hand
# run cannot derail it.
{
  main "$@"
  exit
}
