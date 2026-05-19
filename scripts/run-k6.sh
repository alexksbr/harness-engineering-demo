#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/run-k6.sh <script.js>" >&2
  exit 2
fi

script="$1"

if [ ! -f "$script" ]; then
  echo "K6 script not found: $script" >&2
  exit 2
fi

run_local() {
  if ! command -v k6 >/dev/null 2>&1; then
    echo "k6 is not installed. Install Docker or a local k6 binary to run performance sensors." >&2
    exit 127
  fi

  exec k6 run "$script"
}

run_docker() {
  exec docker run --rm -i \
    --add-host=host.docker.internal:host-gateway \
    -e K6_BASE_URL="${K6_BASE_URL:-http://host.docker.internal:3000}" \
    -e PERF_USER \
    -e PERF_PASS \
    -e PERF_MAX_LIMIT \
    grafana/k6 run - < "$script"
}

case "${K6_RUNNER:-auto}" in
  docker)
    if ! command -v docker >/dev/null 2>&1; then
      echo "Docker is not installed. Set K6_RUNNER=local or install Docker." >&2
      exit 127
    fi
    run_docker
    ;;
  local)
    run_local
    ;;
  auto)
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      run_docker
    else
      run_local
    fi
    ;;
  *)
    echo "Unsupported K6_RUNNER=${K6_RUNNER}. Use auto, docker, or local." >&2
    exit 2
    ;;
esac
