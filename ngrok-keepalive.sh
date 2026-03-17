#!/bin/bash
# Auto-restarts ngrok if it dies
PORT=${1:-3001}

while true; do
  echo "$(date): Starting ngrok on port $PORT..."
  ngrok http "$PORT" --log=stdout > /dev/null 2>&1 &
  NGROK_PID=$!
  sleep 3

  # Print the URL
  URL=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null)
  echo "$(date): Tunnel active → $URL"

  # Wait for ngrok to die
  wait $NGROK_PID
  echo "$(date): ngrok died, restarting in 5s..."
  sleep 5
done
