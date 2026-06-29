#!/bin/sh

# Default compose file
COMPOSE_FILES="-f compose.yaml"

# Parse arguments (POSIX-compliant)
while [ "$#" -gt 0 ]; do
  case "$1" in
    --gpu)
      COMPOSE_FILES="$COMPOSE_FILES -f compose.gpu.yaml"
      shift
      ;;
    --ui)
      COMPOSE_FILES="$COMPOSE_FILES -f compose.ui.yaml"
      shift
      ;;
    *)
      # Unknown option
      echo "Unknown option: $1"
      echo "Usage: $0 [--gpu] [--ui]"
      exit 1
      ;;
  esac
done

echo "Starting Ollama services with: docker compose $COMPOSE_FILES up -d"
docker compose $COMPOSE_FILES up -d
