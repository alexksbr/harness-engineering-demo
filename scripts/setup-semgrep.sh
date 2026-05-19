#!/usr/bin/env sh
set -eu

# The preferred npm package, @semgrep/cli, is not published in the npm registry.
# The unscoped npm package named semgrep is an old placeholder and does not
# provide a usable Semgrep CLI. Use the official Homebrew formula instead.
: "${SEMGREP_LOG_FILE:=/tmp/harness-engineering-demo-semgrep.log}"
: "${SEMGREP_SETTINGS_FILE:=/tmp/harness-engineering-demo-semgrep-settings.yml}"
export SEMGREP_ENABLE_VERSION_CHECK=0 SEMGREP_LOG_FILE SEMGREP_SETTINGS_FILE

if [ -z "${SSL_CERT_FILE:-}" ] && [ -f /opt/homebrew/etc/ca-certificates/cert.pem ]; then
  export SSL_CERT_FILE=/opt/homebrew/etc/ca-certificates/cert.pem
fi

if command -v semgrep >/dev/null 2>&1; then
  semgrep --version
  exit 0
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required to install Semgrep on this project."
  echo "Install Homebrew first, then rerun scripts/setup-semgrep.sh."
  exit 1
fi

brew install semgrep
semgrep --version
