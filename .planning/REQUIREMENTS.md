# Requirements: Dominos PR — Social Features Milestone

**Defined:** 2026-03-06
**Core Value:** Cuatro amigos pueden jugar dominó puertorriqueño juntos online, en tiempo real, desde cualquier dispositivo — sin fricción.

## v1 Requirements

### Game Flow Bugs (fixed 2026-03-08)

- [x] **BUG-05**: El segundo juego no puede comenzar — `game:next_game` siempre buscaba el 6-6 en vez de usar el ganador del juego anterior como primer jugador libre
- [x] **BUG-06**: El jugador incorrecto comenzaba la siguiente mano/juego — `game.handStarterIndex` no se actualizaba cuando un jugador ganaba tirando su última ficha (`played_out`); solo se actualizaba en tranques
- [x] **BUG-07**: Tablero no responsivo — fichas se salían del área visible en ventanas pequeñas, móviles y tablets; el board ahora escala con `transform: scale()` para caber en cualquier tamaño
- [x] **BUG-08**: Ficha seleccionada pero no se podía colocar en tablero vacío — cuando el tablero está vacío no existen badges de extremo para clickear; ahora se juega directamente al 'right' sin requerir selección de extremo

### Bug Fixes (prerequisite)

- [x] **BUG-01**: Animación de tile va al tile correcto cuando se juega en el extremo izquierdo del tablero (actualmente selecciona el último elemento del array en lugar del tile con mayor sequence)
- [x] **BUG-02**: El indicador de host se determina correctamente desde el servidor, no asumiendo que seat 0 siempre es el host (fix para el modal "Siguiente Mano" y base para el flow de Revancha)
- [x] **BUG-03**: `selectedTileId` se limpia cuando el turno cambia a otro jugador (previene conflicto con el input de chat)
- [x] **BUG-04**: El `require()` dinámico en `roomHandlers.ts:36` se convierte a import estático (prerequisito para agregar lógica de reconexión a chat e historial)

### Score History

- [x] **SCORE-01**: Usuario puede ver el marcador acumulado por equipo desglosado mano a mano durante el juego
- [x] **SCORE-02**: El panel de historial se abre y cierra tocando el score bar durante la partida
- [x] **SCORE-03**: El historial se reinicia al inicio de cada nueva partida

### Rematch

- [x] **REM-01**: Usuario ve un botón "Revancha" en el modal de fin de juego
- [x] **REM-02**: La revancha requiere que los 4 jugadores acepten (el servidor gestiona el consenso)
- [x] **REM-03**: Usuario ve un contador en vivo "X/4 listos" mientras espera que todos voten
- [x] **REM-04**: La revancha reinicia los puntajes a 0-0 (juego completamente nuevo)
- [x] **REM-05**: Los asientos y equipos se mantienen iguales en la revancha (sin barajar)
- [x] **REM-06**: Si un jugador se desconecta durante la votación de revancha, la revancha se cancela y todos son notificados

### Chat

- [x] **CHAT-01**: Usuario puede enviar mensajes de texto libre en la sala (máximo 200 caracteres)
- [x] **CHAT-02**: Los mensajes aparecen en el panel de chat para todos los jugadores de la sala en tiempo real
- [x] **CHAT-03**: Usuario puede enviar una reacción rápida con un click — opciones: "¡Capicú!", "¡Trancado!", "¡Buena jugada!", "¡Mala suerte!", "🔥", "🤡"
- [x] **CHAT-04**: El botón de chat muestra un badge con el número de mensajes no leídos cuando el panel está cerrado
- [x] **CHAT-05**: Al reconectarse, el usuario recibe el historial de los últimos 50 mensajes de la sala
- [x] **CHAT-06**: El servidor aplica rate limiting: máximo 15 mensajes por jugador cada 10 segundos
- [x] **CHAT-07**: Los mensajes son sanitizados en el servidor antes de ser retransmitidos (previene XSS)

### Two-Player Mode with Boneyard

- **TWO-01**: Si hay 2 jugadores en la sala, el juego inicia en modo 2 jugadores automáticamente (sin selección manual)
- **TWO-02**: Cada jugador recibe 7 fichas; las 14 restantes forman el boneyard (fichas en la mesa)
- **TWO-03**: Cuando un jugador no puede tirar, roba fichas del boneyard una por una hasta encontrar una jugable; si el boneyard se vacía sin encontrar ficha jugable, pasa el turno
- **TWO-04**: El scoring es individual (sin equipos) — el ganador de la mano gana los pips del oponente
- **TWO-05**: Los modos de puntuación existentes (Modo 200 / Modo 500) funcionan en modo 2 jugadores con las mismas reglas de bonificación
- **TWO-06**: El layout visual muestra al jugador local abajo y al oponente arriba; las posiciones izquierda y derecha se ocultan o adaptan
- **TWO-07**: El juego se bloquea cuando ambos jugadores pasan consecutivamente (boneyard vacío y ninguno puede tirar)

## v2 Requirements

### Chat avanzado

- **CHAT-V2-01**: Animaciones por asiento cuando un jugador envía una reacción rápida (aparece sobre su ficha)
- **CHAT-V2-02**: Exportar historial de chat al finalizar la partida

### Score avanzado

- **SCORE-V2-01**: Desglose detallado por mano: quién ganó, cuántos puntos, cómo (capicú, trancado, etc.)
- **SCORE-V2-02**: Contador de revanchas ganadas por equipo en la sesión

### Social

- **SOC-V2-01**: Video llamada entre jugadores (WebRTC + STUN/TURN) — próximo milestone
- **SOC-V2-02**: Modo espectador (requiere cambios en asignación de asientos)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video llamada (WebRTC) | Alta complejidad — milestone separado después de estabilizar features sociales |
| Persistencia de chat entre sesiones | Requiere base de datos; in-memory es suficiente para juego casual |
| Cuentas / login | No parte del diseño actual; jugadores identificados por nombre |
| App móvil nativa | Web-first; browser móvil es aceptable |
| Charts de puntaje | Tabla de texto es suficiente; librería de charts es peso innecesario |
| Moderación de chat | Sala privada por código — no hay extraños |

## Traceability

Actualizado durante la creación del roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-05 | Phase 0.5 | Complete |
| BUG-06 | Phase 0.5 | Complete |
| BUG-07 | Phase 0.5 | Complete |
| BUG-08 | Phase 0.5 | Complete |
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| BUG-03 | Phase 1 | Complete |
| BUG-04 | Phase 1 | Complete |
| SCORE-01 | Phase 2 | Complete |
| SCORE-02 | Phase 2 | Complete |
| SCORE-03 | Phase 2 | Complete |
| REM-01 | Phase 3 | Complete |
| REM-02 | Phase 3 | Complete |
| REM-03 | Phase 3 | Complete |
| REM-04 | Phase 3 | Complete |
| REM-05 | Phase 3 | Complete |
| REM-06 | Phase 3 | Complete |
| CHAT-01 | Phase 4 | Complete |
| CHAT-02 | Phase 4 | Complete |
| CHAT-03 | Phase 4 | Complete |
| CHAT-04 | Phase 4 | Complete |
| CHAT-05 | Phase 4 | Complete |
| CHAT-06 | Phase 4 | Complete |
| CHAT-07 | Phase 4 | Complete |
| TWO-01 | Phase 7 | Pending |
| TWO-02 | Phase 7 | Pending |
| TWO-03 | Phase 7 | Pending |
| TWO-04 | Phase 7 | Pending |
| TWO-05 | Phase 7 | Pending |
| TWO-06 | Phase 7 | Pending |
| TWO-07 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
