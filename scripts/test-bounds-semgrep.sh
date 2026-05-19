#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
rule_file="$repo_root/.semgrep/rules/unbounded-pagination-limits.yml"

: "${SEMGREP_LOG_FILE:=/tmp/harness-engineering-demo-semgrep.log}"
: "${SEMGREP_SETTINGS_FILE:=/tmp/harness-engineering-demo-semgrep-settings.yml}"
export SEMGREP_ENABLE_VERSION_CHECK=0 SEMGREP_LOG_FILE SEMGREP_SETTINGS_FILE

if [ -z "${SSL_CERT_FILE:-}" ] && [ -f /opt/homebrew/etc/ca-certificates/cert.pem ]; then
  export SSL_CERT_FILE=/opt/homebrew/etc/ca-certificates/cert.pem
fi

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/bounds-semgrep.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

mkdir -p "$tmp_dir/src"

run_rule() {
  (cd "$tmp_dir" && semgrep scan \
    --no-git-ignore \
    --metrics=off \
    --disable-version-check \
    --disable-nosem \
    --config "$rule_file" \
    . \
    --error)
}

cat > "$tmp_dir/src/failing.controller.ts" <<'TS'
import { DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';

export class FailingController {
  @Get('top')
  async top(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return limit;
  }
}
TS

if run_rule > "$tmp_dir/failing.out" 2>&1; then
  echo "FAIL: expected the unbounded fixture to be flagged, but Semgrep exited 0." >&2
  cat "$tmp_dir/failing.out" >&2
  exit 1
fi

if ! grep -q "unbounded-pagination-limits" "$tmp_dir/failing.out"; then
  echo "FAIL: Semgrep failed, but not with the expected unbounded-pagination-limits rule." >&2
  cat "$tmp_dir/failing.out" >&2
  exit 1
fi

echo "PASS: unbounded @Query('limit') fixture fails as expected."

rm "$tmp_dir/src/failing.controller.ts"

cat > "$tmp_dir/src/passing.controller.ts" <<'TS'
import { DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';

export class PassingController {
  @Get('top')
  async top(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return Math.min(limit, 100);
  }
}
TS

if ! run_rule > "$tmp_dir/passing.out" 2>&1; then
  echo "FAIL: expected the clamped fixture to pass, but Semgrep reported a finding." >&2
  cat "$tmp_dir/passing.out" >&2
  exit 1
fi

echo "PASS: clamped @Query('limit') fixture succeeds as expected."
echo "Semgrep bounds smoke test passed."
