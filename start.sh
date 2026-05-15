#!/bin/bash
# Start both Grokon Dashboard servers
cd /Users/mac/grokon-dashboard

echo "Starting API server on :3001..."
/Users/mac/.bun/bin/bun run server/index.ts &
API_PID=$!

echo "Starting Vite on :5173..."
/Users/mac/.bun/bin/bun run dev &
VITE_PID=$!

echo ""
echo "  Dashboard → http://localhost:5173"
echo "  API       → http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $API_PID $VITE_PID 2>/dev/null; exit" INT TERM
wait
