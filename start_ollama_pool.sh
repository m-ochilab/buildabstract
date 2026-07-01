#!/bin/bash
# Start multiple Ollama instances for concurrent grading.
# Each instance handles one request at a time; the app distributes across all ports.
#
# Memory: glm-4.7-flash is ~19GB per instance
#   2 instances = 38GB   (safe minimum)
#   3 instances = 57GB   (recommended)
#   4 instances = 76GB   (maximum recommended on GB10 with 119GB)
#
# Usage:
#   ./start_ollama_pool.sh          # starts instances on ports 11434-11437
#   ./start_ollama_pool.sh 3        # starts 3 instances (11434-11436)
#   ./start_ollama_pool.sh stop     # kills all ollama processes

set -euo pipefail

PORTS=(11434 11435 11436 11437)
COUNT=${1:-3}

if [[ "$1" == "stop" ]]; then
    echo "Stopping all Ollama instances..."
    pkill -f "ollama serve" 2>/dev/null && echo "Done." || echo "No ollama processes found."
    exit 0
fi

if [[ "$COUNT" -lt 1 || "$COUNT" -gt 4 ]]; then
    echo "Instance count must be 1-4" >&2
    exit 1
fi

for i in $(seq 0 $((COUNT - 1))); do
    PORT=${PORTS[$i]}
    if curl -sf "http://127.0.0.1:${PORT}/api/tags" > /dev/null 2>&1; then
        echo "port ${PORT}: already running"
    else
        echo "port ${PORT}: starting..."
        OLLAMA_MODELS=/usr/share/ollama/.ollama/models OLLAMA_HOST="127.0.0.1:${PORT}" ollama serve >> "/tmp/ollama_${PORT}.log" 2>&1 &
        sleep 1
        if curl -sf "http://127.0.0.1:${PORT}/api/tags" > /dev/null 2>&1; then
            echo "port ${PORT}: OK"
        else
            echo "port ${PORT}: failed to start (check /tmp/ollama_${PORT}.log)"
        fi
    fi
done

echo ""
echo "Pool ready. Set environment variable:"
URLS=""
for i in $(seq 0 $((COUNT - 1))); do
    PORT=${PORTS[$i]}
    [[ -n "$URLS" ]] && URLS="${URLS},"
    URLS="${URLS}http://127.0.0.1:${PORT}"
done
echo "  export OLLAMA_URLS=\"${URLS}\""
echo ""
echo "Then restart the app:"
echo "  pkill -f 'uvicorn app:app'"
echo "  OLLAMA_URLS=\"${URLS}\" .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8001"
