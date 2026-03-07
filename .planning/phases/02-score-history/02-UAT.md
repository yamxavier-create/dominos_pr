---
status: diagnosed
phase: 02-score-history
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md
started: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. No Regression — App Loads & Gameplay Works
expected: After the store changes in plan 01 (gameStore + uiStore extensions), the app starts normally and a game is playable with no crashes, console errors, or broken state. scoreHistory initializes to [] silently.
result: issue
reported: "Problema 1: Fichas demasiado pequeñas, pips difíciles de distinguir, tablero ocupa solo una pequeña parte de la pantalla — posible problema de escala/layout. Problema 2: Al iniciar siguiente juego, solo el host ve la nueva partida; los otros jugadores se quedan en la partida anterior sin transición."
severity: blocker

### 2. ScorePanel Backward Compat — Score Display Unchanged
expected: The score bar in-game still shows both teams' scores correctly. No visual changes to the ScorePanel are visible yet (the chevron only appears when onClick prop is wired up in plan 03, which hasn't run). Existing score display is unaffected.
result: pass

### 3. ScorePanel Chevron Appears on Score Bar
expected: After clicking the score bar at the top of the game screen, a small downward-pointing chevron is visible on the ScorePanel. NOTE: This requires plan 03 wiring — if not yet executed, skip this test.
result: skipped
reason: Plan 03 (wiring) not yet executed

### 4. Score History Panel Opens and Shows Entries
expected: Clicking the score bar toggles a collapsible history panel below it. Each completed hand shows a row with: hand number, team label (Nosotros / Ellos / Trancado), points scored that hand, and running totals. Newest hand appears at the top. NOTE: This requires plan 03 wiring — if not yet executed, skip this test.
result: skipped
reason: Plan 03 (wiring) not yet executed

### 5. Special Hand Badges Display Correctly
expected: When a hand was won by Capicu, Chuchazo, or ended Trancado (blocked), the history row shows a colored badge next to the team label. NOTE: This requires plan 03 wiring and at least one completed hand — skip if not yet executed.
result: skipped
reason: Plan 03 (wiring) not yet executed

## Summary

total: 5
passed: 1
issues: 1
pending: 0
skipped: 3

## Gaps

- truth: "Las fichas se muestran con tamaño adecuado, pips claramente visibles, tablero proporcional en pantalla"
  status: failed
  reason: "User reported: fichas demasiado pequeñas, puntos difíciles de distinguir, tablero ocupa solo una pequeña parte de la pantalla — posible problema de escala/layout/CSS"
  severity: major
  test: 1
  root_cause: "BoardTile.tsx usa TILE_H_W=52/TILE_H_H=26 pero el SVG viewBox es 80×40 — factor de escala 0.65× hace los pips ilegibles. Fix: subir a 80×40 (1:1) o 64×32 (0.8×). Secundario: GameBoard.tsx inicializa dims en {w:600,h:280} causando jitter en primer frame."
  artifacts:
    - path: "client/src/components/board/BoardTile.tsx"
      issue: "TILE_H_W=52, TILE_H_H=26, TILE_V_W=26, TILE_V_H=52 — demasiado pequeño vs viewBox 80×40. Subir a 80×40/40×80 o 64×32/32×64."
    - path: "client/src/components/board/GameBoard.tsx"
      issue: "Línea 184: useState({w:600,h:280}) — inicializar a {w:0,h:0} y no renderizar hasta que ResizeObserver dispare con dimensiones reales."
  missing:
    - "Aumentar TILE_H_W/TILE_H_H/TILE_V_W/TILE_V_H en BoardTile.tsx (todos los layout coords en GameBoard.tsx se actualizan automáticamente)"
    - "Posible bump de SNAKE_CAP de 560 a ~620 si se usan tiles de 80px"
    - "Inicializar dims a {w:0,h:0} en GameBoard.tsx para eliminar jitter en primer render"
  debug_session: ""

- truth: "Al iniciar siguiente juego (host), todos los jugadores transicionan automáticamente a la nueva partida"
  status: failed
  reason: "User reported: host ve la nueva partida pero los otros jugadores permanecen en la partida anterior sin ninguna transición"
  severity: blocker
  test: 1
  root_cause: "GameEndModal solo emite room:leave y navega al host a / — nunca emite un evento al servidor para iniciar nueva partida. El servidor no tiene handler game:next_game (game:next_hand rechaza phase=game_end en línea 365). Los otros 3 jugadores quedan bloqueados en el modal sin recibir ningún evento."
  artifacts:
    - path: "client/src/components/game/GameEndModal.tsx"
      issue: "Botón emite room:leave en vez de game:next_game. No hay lógica de waiting para non-hosts (a diferencia de RoundEndModal.tsx)."
    - path: "server/src/socket/gameHandlers.ts"
      issue: "Línea 365: guard phase !== round_end bloquea restart post-game. Falta handler game:next_game que resetee estado y llame broadcastState()."
  missing:
    - "Nuevo handler game:next_game en gameHandlers.ts que resetee game state y llame broadcastState()"
    - "GameEndModal: host emite game:next_game; non-hosts ven Waiting for host... (patrón de RoundEndModal)"
    - "useSocket: limpiar showGameEnd/gameEndData cuando llega game:state_snapshot con phase=playing"
  debug_session: ""
