#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_VENV_BIN="$BACKEND_DIR/.venv/bin"
UVICORN_BIN="$BACKEND_VENV_BIN/uvicorn"

cleanup() {
  echo
  echo "Shutting down dev servers..."
  [[ "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}

trap cleanup SIGINT SIGTERM EXIT

if [[ ! -x "$UVICORN_BIN" ]]; then
  echo "Missing backend venv or uvicorn. Run: cd \"$BACKEND_DIR\" && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Warning: frontend node_modules missing. Run: cd \"$FRONTEND_DIR\" && npm install"
fi

echo "Starting backend (uvicorn main:app --reload --port 8000)..."
(cd "$BACKEND_DIR" && source "$BACKEND_VENV_BIN/activate" && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

echo "Starting frontend (npm run dev)..."
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

echo
echo "Dev servers running:"
echo "  Backend: http://127.0.0.1:8000    (PID $BACKEND_PID)"
echo "  Frontend: http://127.0.0.1:3000  (PID $FRONTEND_PID)"
echo "Press Ctrl+C to stop both."

wait
