#!/bin/sh

# Default values
OLLAMA_HOST="localhost:11434"
MODEL_NAME="ministral-3:8b"
PROMPT_TEXT=""
SYSTEM_TEXT=""

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
    --prompt)
      PROMPT_TEXT="$2"
      shift 2
      ;;
    --system)
      SYSTEM_TEXT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--host <ollama_host>] [--model <model_name>] --prompt <text> [--system <text>]"
      exit 1
      ;;
  esac
done

# Validation: The prompt is required for generation
if [ -z "$PROMPT_TEXT" ]; then
    echo "Error: --prompt is required."
    echo "Usage: $0 [--host <ollama_host>] [--model <model_name>] --prompt <text> [--system <text>]"
    exit 1
fi

echo "Generating text with model '$MODEL_NAME' from Ollama at '$OLLAMA_HOST'..."

# Construct the JSON payload.
# Note: Ollama's /api/generate endpoint uses "model", not "name" (unlike /api/pull).
if [ -n "$SYSTEM_TEXT" ]; then
    JSON_PAYLOAD="{\"model\": \"$MODEL_NAME\", \"prompt\": \"$PROMPT_TEXT\", \"system\": \"$SYSTEM_TEXT\"}"
else
    JSON_PAYLOAD="{\"model\": \"$MODEL_NAME\", \"prompt\": \"$PROMPT_TEXT\"}"
fi

# Execution using curl with streaming flags
#  -s: hides curl's progress bar
#  -N: disables buffering so lines print immediately
curl -s -N -X POST "http://$OLLAMA_HOST/api/generate" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD"

# Check curl's exit status
if [ $? -ne 0 ]; then
    echo "\nFailed to generate text with model '$MODEL_NAME'."
    exit 1
fi

echo "\n\nText generated successfully with model '$MODEL_NAME'."