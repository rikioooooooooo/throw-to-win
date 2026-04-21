#!/bin/bash
# Create custom Workers usage alert at 50% threshold
# Only run this if default 75%/90% alerts are insufficient
set -euo pipefail

: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"
: "${NOTIFY_EMAIL:?Set NOTIFY_EMAIL}"

curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/alerting/v3/policies" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg email "${NOTIFY_EMAIL}" \
    '{
      name: "Workers Early Warning (50%)",
      description: "Notify at 50% of free tier daily limits",
      enabled: true,
      alert_type: "workers_daily_limit_exceeded",
      mechanisms: {
        email: [{id: $email}]
      },
      filters: {}
    }')" \
  | jq
