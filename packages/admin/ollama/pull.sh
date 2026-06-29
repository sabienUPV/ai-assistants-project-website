#!/bin/sh

# Default values
OLLAMA_HOST="localhost:11434"
MODEL_NAME="ministral-3:8b"

# Parse arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      OLLAMA_HOST="$2"
      shift 2
      ;;
    --model)
      MODEL_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--host <ollama_host>] [--model <model_name>]"
      exit 1
      ;;
  esac
done

echo "Pulling model '$MODEL_NAME' from Ollama at '$OLLAMA_HOST'..."

# Execution using curl with streaming flags:
#  -s: hides curl's progress bar to let Ollama's output shine
#  -N: disables buffering so lines print immediately
curl -s -N -X POST "http://$OLLAMA_HOST/api/pull" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$MODEL_NAME\"}"

# Check curl's exit status
if [ $? -ne 0 ]; then
    echo "\nFailed to pull model '$MODEL_NAME'."
    exit 1
fi

echo "\nModel '$MODEL_NAME' pulled successfully."