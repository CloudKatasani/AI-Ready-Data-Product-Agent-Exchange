#!/bin/sh
# First start: seed the data volume from the image's template (seeded app DB, and warehouses if prebuilt).
# SESSION_SECRET must be provided (production refuses the default — invariant I11).
set -e
if [ ! -f /app/data/keystone.db ]; then
  cp -R /app/template-data/. /app/data/
  echo "keystone: data volume initialised from the image template"
fi
exec "$@"
