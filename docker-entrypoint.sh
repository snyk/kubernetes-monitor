#!/bin/bash
set -e
set -o pipefail

if [[ -f config.${SERVICE_ENV}.json ]]; then
  cp config.${SERVICE_ENV}.json config.local.json
fi

exec "$@"
