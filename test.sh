#!/usr/bin/env bash
set -euo pipefail

# Parallel test runner — splits test files across N Jest processes.
# Usage: ./test.sh [-p N] [-t TOKEN] [-S] [--host PRESET] [jest args...]
# Examples:
#   ./test.sh                              # run all tests (1 process, summary only)
#   ./test.sh -S                           # run all tests, stream output
#   ./test.sh -p 4                         # split across 4 processes
#   ./test.sh -t mytoken -p 2 --selectProjects e2e
#   ./test.sh --host staging -p 2 --selectProjects e2e
#   ./test.sh --host local                 # http://localhost:8080
#   ./test.sh --host production            # https://api.pdfdancer.com

PARALLEL=1
STREAM=false

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p)
      PARALLEL="$2"
      shift 2
      ;;
    -t)
      export PDFDANCER_API_TOKEN="$2"
      shift 2
      ;;
    -S)
      STREAM=true
      shift
      ;;
    --host)
      case "$2" in
        local)      export PDFDANCER_BASE_URL="http://localhost:8080" ;;
        staging)    export PDFDANCER_BASE_URL="https://api-staging.pdfdancer.com" ;;
        production) export PDFDANCER_BASE_URL="https://api.pdfdancer.com" ;;
        *)
          echo "Unknown host preset: $2 (use local, staging, or production)"
          exit 1
          ;;
      esac
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

JEST_ARGS=("$@")

# Collect test files using Jest's own --listTests
mapfile -t FILES < <(npx jest --listTests "${JEST_ARGS[@]}" 2>/dev/null)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No test files found."
  exit 0
fi

TOTAL=${#FILES[@]}
# Default to localhost if no --host was given and env not already set
if [[ -z "${PDFDANCER_BASE_URL:-}" ]]; then
  export PDFDANCER_BASE_URL="http://localhost:8080"
fi
echo "Found $TOTAL test file(s), running with $PARALLEL process(es)."
echo "Host: $PDFDANCER_BASE_URL"

# Create temp dir for output files (kept on failure for inspection)
TMPDIR_OUT=$(mktemp -d)
KEEP_LOGS=false
cleanup() {
  if [[ "$KEEP_LOGS" == false ]]; then
    rm -rf "$TMPDIR_OUT"
  fi
}
trap cleanup EXIT

# Print progress line from jest output (PASS/FAIL lines)
print_progress() {
  local logfile="$1"
  local wid="$2"
  local prefix=""
  [[ -n "$wid" ]] && prefix="[W$wid] "
  # Tail the log and grep for PASS/FAIL lines as they appear
  tail -f "$logfile" 2>/dev/null | grep --line-buffered -E "^\s*(PASS|FAIL)" | while IFS= read -r line; do
    echo "${prefix}${line}"
  done
}

if [[ "$PARALLEL" -le 1 ]]; then
  if [[ "$STREAM" == true ]]; then
    npx jest "${JEST_ARGS[@]}"
    exit $?
  else
    OUTFILE="$TMPDIR_OUT/worker-1.log"
    echo "Log: $OUTFILE"
    # Run jest in background so we can tail progress
    npx jest "${JEST_ARGS[@]}" > "$OUTFILE" 2>&1 &
    JEST_PID=$!
    print_progress "$OUTFILE" "" &
    TAIL_PID=$!
    JEST_EXIT=0
    wait "$JEST_PID" || JEST_EXIT=$?
    kill "$TAIL_PID" 2>/dev/null; wait "$TAIL_PID" 2>/dev/null || true
    echo ""
    # Show summary (last lines starting from "Test Suites:")
    SUMMARY=$(grep -n "^Test Suites:" "$OUTFILE" 2>/dev/null | tail -1 | cut -d: -f1)
    if [[ -n "$SUMMARY" ]]; then
      tail -n +"$SUMMARY" "$OUTFILE"
    else
      tail -20 "$OUTFILE"
    fi
    if [[ "$JEST_EXIT" -ne 0 ]]; then
      KEEP_LOGS=true
      echo ""
      echo "Full output: $OUTFILE"
      exit 1
    fi
    exit 0
  fi
fi

# Split files into N groups and launch parallel jobs
PIDS=()
WORKER_IDS=()

for ((i = 0; i < PARALLEL; i++)); do
  GROUP=()
  for ((j = i; j < TOTAL; j += PARALLEL)); do
    GROUP+=("${FILES[$j]}")
  done

  if [[ ${#GROUP[@]} -eq 0 ]]; then
    continue
  fi

  WID=$((i + 1))
  OUTFILE="$TMPDIR_OUT/worker-$WID.log"
  echo "Worker $WID: ${#GROUP[@]} file(s)"

  if [[ "$STREAM" == true ]]; then
    npx jest "${GROUP[@]}" "${JEST_ARGS[@]}" &
  else
    echo "  Log: $OUTFILE"
    npx jest "${GROUP[@]}" "${JEST_ARGS[@]}" > "$OUTFILE" 2>&1 &
  fi
  PIDS+=($!)
  WORKER_IDS+=("$WID")
done

# Start progress tailers for non-streaming mode
TAIL_PIDS=()
if [[ "$STREAM" == false ]]; then
  for idx in "${!WORKER_IDS[@]}"; do
    WID=${WORKER_IDS[$idx]}
    OUTFILE="$TMPDIR_OUT/worker-$WID.log"
    print_progress "$OUTFILE" "$WID" &
    TAIL_PIDS+=($!)
  done
fi

# Wait for all workers, track failures
EXIT_CODE=0
for idx in "${!PIDS[@]}"; do
  if ! wait "${PIDS[$idx]}"; then
    EXIT_CODE=1
  fi
done

# Kill tailers
for PID in "${TAIL_PIDS[@]}"; do
  kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null || true
done

# Print summaries when not streaming
if [[ "$STREAM" == false ]]; then
  echo ""
  for idx in "${!WORKER_IDS[@]}"; do
    WID=${WORKER_IDS[$idx]}
    OUTFILE="$TMPDIR_OUT/worker-$WID.log"
    echo "=== Worker $WID ==="
    SUMMARY=$(grep -n "^Test Suites:" "$OUTFILE" 2>/dev/null | tail -1 | cut -d: -f1)
    if [[ -n "$SUMMARY" ]]; then
      tail -n +"$SUMMARY" "$OUTFILE"
    else
      tail -20 "$OUTFILE"
    fi
    echo ""
  done
  if [[ "$EXIT_CODE" -ne 0 ]]; then
    KEEP_LOGS=true
    echo "Full logs: $TMPDIR_OUT/worker-*.log"
  fi
fi

exit $EXIT_CODE
