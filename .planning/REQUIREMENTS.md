# Requirements: Dominos PR — Social Features Milestone

**Defined:** 2026-03-06
**Core Value:** Cuatro amigos pueden jugar dominó puertorriqueño juntos online, en tiempo real, desde cualquier dispositivo — sin fricción.

## v1 Requirements

### Bug Fixes (prerequisite)

- [ ] **BUG-01**: Animación de tile va al tile correcto cuando se juega en el extremo izquierdo del tablero (actualmente selecciona el último elemento del array en lugar del tile con mayor sequence)
- [ ] **BUG-02**: El indicador de host se determina correctamente desde el servidor, no asumiendo que seat 0 siempre es el host (fix para el modal "Siguiente Mano" y base para el flow de Revancha)
- [ ] **BUG-03**: `selectedTileId` se limpia cuando el turno cambia a otro jugador (previene conflicto con el input de chat)
- [ ] **BUG-04**: El `require()` dinámico en `roomHandlers.ts:36` se convierte a import estático (prerequisito para agregar lógica de reconexión a chat e historial)

### Score History

- [x] **SCORE-01**: Usuario puede ver el marcador acumulado por equipo desglosado mano a mano durante el juego
- [x] **SCORE-02**: El panel de historial se abre y cierra tocando el score bar durante la partida
- [x] **SCORE-03**: El historial se reinicia al inicio de cada nueva partida

### Rematch

- [ ] **REM-01**: Usuario ve un botón "Revancha" en el modal de fin de juego
- [ ] **REM-02**: La revancha requiere que los 4 jugadores acepten (el servidor gestiona el consenso)
- [ ] **REM-03**: Usuario ve un contador en vivo "X/4 listos" mientras espera que todos voten
- [ ] **REM-04**: La revancha reinicia los puntajes a 0-0 (juego completamente nuevo)
- [ ] **REM-05**: Los asientos y equipos se mantienen iguales en la revancha (sin barajar)
- [ ] **REM-06**: Si un jugador se desconecta durante la votación de revancha, la revancha se cancela y todos son notificados

### Chat

- [ ] **CHAT-01**: Usuario puede enviar mensajes de texto libre en la sala (máximo 200 caracteres)
- [ ] **CHAT-02**: Los mensajes aparecen en el panel de chat para todos los jugadores de la sala en tiempo real
- [ ] **CHAT-03**: Usuario puede enviar una reacción rápida con un click — opciones: "¡Capicú!", "¡Trancado!", "¡Buena jugada!", "¡Mala suerte!", "🔥", "🤡"
- [ ] **CHAT-04**: El botón de chat muestra un badge con el número de mensajes no leídos cuando el panel está cerrado
- [ ] **CHAT-05**: Al reconectarse, el usuario recibe el historial de los últimos 50 mensajes de la sala
- [ ] **CHAT-06**: El servidor aplica rate limiting: máximo 5 mensajes por jugador cada 10 segundos
- [ ] **CHAT-07**: Los mensajes son sanitizados en el servidor antes de ser retransmitidos (previene XSS)

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
| BUG-01 | Phase 1 | Pending |
| BUG-02 | Phase 1 | Pending |
| BUG-03 | Phase 1 | Pending |
| BUG-04 | Phase 1 | Pending |
| SCORE-01 | Phase 2 | Complete |
| SCORE-02 | Phase 2 | Complete |
| SCORE-03 | Phase 2 | Complete |
| REM-01 | Phase 3 | Pending |
| REM-02 | Phase 3 | Pending |
| REM-03 | Phase 3 | Pending |
| REM-04 | Phase 3 | Pending |
| REM-05 | Phase 3 | Pending |
| REM-06 | Phase 3 | Pending |
| CHAT-01 | Phase 4 | Pending |
| CHAT-02 | Phase 4 | Pending |
| CHAT-03 | Phase 4 | Pending |
| CHAT-04 | Phase 4 | Pending |
| CHAT-05 | Phase 4 | Pending |
| CHAT-06 | Phase 4 | Pending |
| CHAT-07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
