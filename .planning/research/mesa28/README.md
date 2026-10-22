# Referencia visual: Mesa28

Mesa28 – Dominó Boricua (LSN Digital Labs, `com.mesa28native`, iOS y Android) es un dominó boricua 2v2 online. Se usa como referencia de **estilo**, no para copiar assets ni código.

- Play Store: https://play.google.com/store/apps/details?id=com.mesa28native
- App Store: https://apps.apple.com/us/app/mesa28-puerto-rican-domino/id6759813290
- Web: https://mesa28.com

## Screenshots (`screens/`)

| Archivo | Pantalla |
|---|---|
| `00-main-menu.png` | Main menu (tab **Jugar**), captura de Yamir del 2026-10-15 |
| `01-partida-clasica.jpg` | Partida con paño verde y HUD |
| `02-capicu.jpg` | Animación de capicú a pantalla completa |
| `03-matchmaking.jpg` | Buscando jugadores, con **Empezar con bots** |
| `04-vs-equipos.jpg` | Pantalla VS: Nosotros contra Ellos |
| `05-quick-chat.jpg` | Panel de chat rápido y emotes |
| `06-mesa-arena.jpg` | Mesa temática de arena con fichas verdes |
| `07-mesa-sandwiches.jpg` | Mesa temática: bandeja de sándwiches de mezcla |
| `08-ranking-tabbar.jpg` | Ranking: podio y tab bar |
| `09-fin-de-mano.jpg` | Resumen de fin de mano |

## Main menu: qué tomar y qué no

Veredicto de Yamir: le gusta el estilo, pero la pantalla tiene demasiadas cosas.

### Tomar (el estilo)

1. **Botones gruesos con efecto 3D.** Llevan un borde inferior más oscuro y, al presionarlos, bajan 2–3 px.
2. **Contorno dorado** en el CTA y las tarjetas importantes, sobre un fondo oscuro.
3. **Tipografía redonda y pesada** en los títulos, con un subtítulo más liviano.
4. **CTA con el modo pegado.** La tarjeta `100 Clásica` con ↻ junto a **Jugar** cambia el modo sin salir del menú.
5. **Identidad arriba:** avatar grande con un banner tipo escudo y el nombre debajo.
6. **Decoración de temporada** flotando en el fondo (ahora Halloween).
7. **Animaciones:** bonus con rayos que giran, resplandor en la ruleta, adornos que flotan y un tab activo elevado.

### No tomar (lo que sobra)

XP, coronas, chavitos, ruleta, misiones, anuncios, calendario y club. Es economía de retención que dominos_pr no tiene.

## Propuesta para `client/src/components/lobby/MainMenu.tsx`

Estado actual: hero DOMINÓ PR con 3 fichas, **JUGAR** (sala rápida, siempre `modo200`), 3 tarjetas (**CREAR**, **CÓDIGO**, **AMIGOS**) y un link chico "📊 Estadísticas y Ranking".

```
┌─────────────────────────────────┐
│ (Y) Yam                     ⚙   │  perfil y ajustes
│                                 │
│      ╔═ DOMINÓ PR ═╗            │  banner tipo escudo
│          ( avatar )             │  más chico que el hero actual
│      👻      🎃      👻         │  temporada, flotando
│                                 │
│ ┌──────┐┌────────────────────┐  │
│ │ 200  ││      JUGAR         │  │  CTA 3D con borde dorado
│ │Clásica↻│ Sala rápida       │  │  ↻ rota 200 → 500 → Torneo
│ └──────┘└────────────────────┘  │
│ ┌──────────────┐┌─────────────┐ │
│ │ Unirse ####  ││ Crea tu mesa│ │  2 botones en vez de 3
│ └──────────────┘└─────────────┘ │
├─────────────────────────────────┤
│ Perfil  Amigos  [Jugar]  Ranking│  tab bar con lo que ya existe
└─────────────────────────────────┘
```

Decisiones de UI:

- **Selector de modo pegado a JUGAR.** Corrige que la sala rápida siempre cree `modo200`.
- **Tab bar.** Reemplaza el link de estadísticas y la tarjeta **AMIGOS**.

**Paleta (decidido 2026-10-15):** se mantiene el verde y dorado de dominos_pr. De Mesa28 solo se toma el lenguaje de botones y la estructura; el violeta no, para no parecer copia.

## Ideas de la partida (para después)

- Marcador fijo arriba: **NOSOTROS** en verde y **ELLOS** en rojo, con el nombre de la mesa, los puntos y el número de mano.
- Barritas de fichas restantes debajo de cada jugador.
- Animación de capicú, tranque y pase a pantalla completa.
- Burbujas de chat rápido pegadas al avatar o la cámara.
- Mesas temáticas con un escenario boricua alrededor.
- Píldora "Tu turno 28s" con timer.
- Ojo: un usuario se queja de que las fichas de colores cansan la vista. La ficha blanca queda como default.
