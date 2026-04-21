#!/bin/bash
set -euo pipefail

# Required environment variables
: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"

echo "=== Existing Notification Policies ==="
curl -sS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/alerting/v3/policies" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.result[] | { id, name, alert_type, enabled, mechanisms }'

echo ""
echo "=== Available Notification Types ==="
curl -sS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/alerting/v3/available_alerts" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.result | to_entries[] | {product: .key, types: [.value[] | .alert_type]}'
