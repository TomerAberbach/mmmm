#!/bin/bash
# Restores the newest staging dump into a new database on the local Postgres
# from compose.yaml, to prove the backups work. Runs the tools in a postgres:18
# container, so it needs only Docker
set -euo pipefail

: "${AGE_IDENTITY_FILE:?Set AGE_IDENTITY_FILE to a file with the backup age identity}"
: "${BACKUP_BUCKET:?Set BACKUP_BUCKET to the Tigris bucket}"
: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID to a Tigris key that can read the bucket}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"

database="mmmm_restore_$(date -u +%Y%m%d%H%M%S)"
container=$(docker compose ps -q postgres)

docker compose exec -T postgres createdb -U mmmm "$database"
docker run --rm --network "container:$container" \
  -v "$(realpath "$AGE_IDENTITY_FILE"):/identity:ro" \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_REGION=auto \
  -e AWS_ENDPOINT_URL=https://fly.storage.tigris.dev \
  -e BUCKET="$BACKUP_BUCKET" \
  -e DATABASE_URL="postgresql://mmmm:mmmm@localhost:5432/$database" \
  postgres:18 bash -euo pipefail -c '
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends age awscli > /dev/null
    key=$(aws s3 ls "s3://$BUCKET/staging/" | sort | tail -n 1 | awk "{ print \$4 }")
    echo "Restoring staging/$key"
    aws s3 cp "s3://$BUCKET/staging/$key" - \
      | age --decrypt --identity /identity \
      | pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL"
    echo "Educators: $(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM \"Educator\"")"
  '
echo "Restored into $database. Drop it with: docker compose exec postgres dropdb -U mmmm $database"
