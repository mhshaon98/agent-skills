#!/usr/bin/env bash
# TEMPLATE (compliance-check). One-shot, idempotent setup for a scheduled service-role job
# when the session cannot apply migrations or deploy itself. Tested in production.
# Rename: REF, migration path,
# function name, vault secret name, cron name/schedule, verify URLs.
# Never prints the key. Aborts if only a non-JWT secret key exists.

# One-shot setup for the 90-day chat-image purge (audit M-5 follow-up).
# Idempotent: safe to re-run. Never prints the service-role key.
#   1. applies the service_role-only SQL helpers
#   2. deploys the purge-chat-images edge function
#   3. stores the service-role key in Vault (create or update)
#   4. schedules the daily cron call (04:47 UTC)
#   5. verifies: no-auth call is refused, service-role call returns ok
set -euo pipefail
set +x

REF="<PROJECT_REF>"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

step() { printf '\n== %s\n' "$1"; }
q() { supabase db query --linked "$1"; }

step "Link project"
if [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$REF" ]; then
  supabase link --project-ref "$REF"
fi

step "1/5 Apply SQL helpers"
supabase db query --linked -f supabase/migrations/20260912002000_chat_image_purge_helpers.sql

step "2/5 Deploy purge-chat-images"
supabase functions deploy purge-chat-images --project-ref "$REF"

step "3/5 Store service-role key in Vault"
KEY="$(supabase projects api-keys --project-ref "$REF" -o json | python3 -c '
import sys, json
for k in json.load(sys.stdin):
    if k.get("name") == "service_role" and (k.get("api_key") or "").startswith("eyJ"):
        print(k["api_key"]); break
')"
if [ -z "$KEY" ]; then
  echo "ABORT: no legacy JWT service_role key found (the function needs a JWT with role=service_role)." >&2
  exit 1
fi
case "$KEY" in *"'"*) echo "ABORT: unexpected key format" >&2; exit 1;; esac
q "do \$\$ begin
  if exists (select 1 from vault.secrets where name = 'purge_chat_images_key') then
    perform vault.update_secret((select id from vault.secrets where name = 'purge_chat_images_key'), '$KEY');
  else
    perform vault.create_secret('$KEY', 'purge_chat_images_key');
  end if;
end \$\$;" >/dev/null
echo "stored (value not shown)"

step "4/5 Schedule daily job"
q "select cron.schedule('purge-chat-images', '47 4 * * *', \$job\$
  select net.http_post(
    url := 'https://$REF.supabase.co/functions/v1/purge-chat-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'purge_chat_images_key')),
    body := '{}'::jsonb)
\$job\$);"
q "select jobname, schedule, active from cron.job order by jobid;"

step "5/5 Verify"
printf 'no-auth call (expect 401): '
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' \
  "https://$REF.supabase.co/functions/v1/purge-chat-images"
printf 'service-role call (expect {"ok":true,...}): '
curl -s -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $KEY" -d '{}' \
  "https://$REF.supabase.co/functions/v1/purge-chat-images"
echo
unset KEY
echo "Done."
