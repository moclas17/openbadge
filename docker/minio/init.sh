#!/bin/bash
set -e

# Wait for MinIO to be ready
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo "Waiting for MinIO to be ready..."
  sleep 2
done

# Create default bucket
mc mb local/openbadge --ignore-existing

# Allow public read access for the media prefix (badge images, etc.)
mc anonymous set download local/openbadge/media

echo "MinIO initialisation complete."
