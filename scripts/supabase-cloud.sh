#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

project_ref=yawvflmnqsbwzzvnuqui
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/spendy"
token_file="$config_dir/supabase-access-token"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

cloud() {
  SUPABASE_NO_KEYRING=1 SUPABASE_ACCESS_TOKEN="$token" supabase "$@"
}

check() {
  cloud functions list --remote="$project_ref"
}

[[ $# == 1 ]] || fail "Usage: bash scripts/supabase-cloud.sh {setup|check|deploy}"
action=$1

case "$action" in
  setup)
    if ! IFS= read -r -s -p "Paste the scoped Spendy Supabase token: " token </dev/tty; then
      fail "Run setup in Terminal to enter the token privately."
    fi
    printf '\n' >&2
    [[ "$token" =~ ^sbp_fc[[:alnum:]_-]+$ ]] || fail "Use a scoped Supabase personal access token (starts with sbp_fc)."
    check || fail "Token not saved. Check that it has Edge Functions read/write access to Spendy."
    mkdir -p "$config_dir"
    pending=$(mktemp "$config_dir/supabase-access-token.XXXXXXXX")
    trap 'rm -f -- "$pending"' EXIT
    printf '%s\n' "$token" >"$pending"
    mv -f -- "$pending" "$token_file"
    printf 'Spendy credential saved. Keychain was not used.\n'
    exit
    ;;
  check|deploy) ;;
  *) fail "Usage: bash scripts/supabase-cloud.sh {setup|check|deploy}" ;;
esac

token=${SPENDY_SUPABASE_ACCESS_TOKEN:-}
if [[ -z "$token" && -f "$token_file" && -r "$token_file" ]]; then
  token=$(<"$token_file")
fi
[[ "$token" =~ ^sbp_[[:alnum:]_-]+$ ]] ||
  fail "Missing or invalid Spendy credential. Run: bash scripts/supabase-cloud.sh setup"

if [[ "$action" == check ]]; then
  check
else
  repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
  stage=$(mktemp -d "${TMPDIR:-/tmp}/spendy-supabase.XXXXXXXX")
  trap 'rm -rf -- "$stage"' EXIT
  mkdir -p "$stage/supabase/functions"
  cp -R "$repo_dir/supabase/functions/create-transaction" "$stage/supabase/functions/"
  # Isolate this deploy from local-stack settings unsupported by newer CLIs.
  cat >"$stage/supabase/config.toml" <<'EOF'
project_id = "spendy"

[functions.create-transaction]
verify_jwt = false
EOF
  cloud functions deploy create-transaction \
    --workdir "$stage" --remote="$project_ref" --use-api --yes
fi
