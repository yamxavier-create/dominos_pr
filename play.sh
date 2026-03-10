#!/bin/bash

# ─── Dominó PR — Arranque completo ───────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "🎲  Dominó PR — Iniciando..."
echo ""

# Matar procesos viejos
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null
lsof -ti tcp:5173 | xargs kill -9 2>/dev/null
pkill -f ngrok 2>/dev/null
sleep 1s

# Arrancar servidor + cliente
cd "$PROJECT_DIR"
npm run dev > /tmp/dominos_dev.log 2>&1 &
DEV_PID=$!

# Esperar a que Vite esté listo
echo "⏳  Iniciando servidores..."
for i in $(seq 1 15); do
  sleep 1s
  if lsof -ti tcp:5173 > /dev/null 2>&1; then
    break
  fi
done

# Arrancar ngrok
ngrok http 5173 --log=stdout > /tmp/ngrok.log 2>&1 &
sleep 4s

# Obtener URL pública
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels \
  | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('tunnels',[]); [print(x['public_url']) for x in t if x.get('proto')=='https']" 2>/dev/null)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅  ¡Todo listo!"
echo ""
if [ -n "$PUBLIC_URL" ]; then
  echo "🔗  Link para tus amistades:"
  echo "    $PUBLIC_URL"
else
  echo "⚠️   No se pudo obtener el link de ngrok."
  echo "    Abre http://localhost:4040 para verlo."
fi
echo ""
echo "🖥️   Local: http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Presiona Ctrl+C para apagar todo."
echo ""

# Mantener script vivo; al salir matar todo
trap "echo ''; echo '🛑 Apagando...'; kill $DEV_PID 2>/dev/null; pkill -f ngrok 2>/dev/null; exit 0" INT TERM

wait $DEV_PID
