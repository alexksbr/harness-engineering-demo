#!/usr/bin/env sh
set -eu

: "${SEMGREP_LOG_FILE:=/tmp/harness-engineering-demo-semgrep.log}"
: "${SEMGREP_SETTINGS_FILE:=/tmp/harness-engineering-demo-semgrep-settings.yml}"
export SEMGREP_ENABLE_VERSION_CHECK=0 SEMGREP_LOG_FILE SEMGREP_SETTINGS_FILE

if [ -z "${SSL_CERT_FILE:-}" ] && [ -f /opt/homebrew/etc/ca-certificates/cert.pem ]; then
  export SSL_CERT_FILE=/opt/homebrew/etc/ca-certificates/cert.pem
fi

exec semgrep scan \
  --no-git-ignore \
  --metrics=off \
  --disable-version-check \
  --disable-nosem \
  --config .semgrep/rules/unbounded-pagination-limits.yml \
  src \
  --error
