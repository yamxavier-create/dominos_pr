import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:audioplayers/audioplayers.dart';

class DominoTile extends StatelessWidget {
  final int? left;
  final int? right;
  final bool showPoints;
  final double size;
  final VoidCallback? onTap;
  final double rotation;
  final bool isPlayable;

  const DominoTile({
    this.left,
    this.right,
    this.showPoints = true,
    this.size = 1.0,
    this.onTap,
    this.rotation = 0.0,
    this.isPlayable = false,
  });

  Widget _buildDots(int? count) {
    if (!showPoints || count == null) return Container();

    List<List<Offset>> dotPatterns = [
      [],
      [Offset(0.5, 0.5)],
      [Offset(0.3, 0.3), Offset(0.7, 0.7)],
      [Offset(0.3, 0.3), Offset(0.5, 0.5), Offset(0.7, 0.7)],
      [Offset(0.3, 0.3), Offset(0.3, 0.7), Offset(0.7, 0.3), Offset(0.7, 0.7)],
      [
        Offset(0.3, 0.3),
        Offset(0.3, 0.7),
        Offset(0.7, 0.3),
        Offset(0.7, 0.7),
        Offset(0.5, 0.5)
      ],
      [
        Offset(0.3, 0.3),
        Offset(0.3, 0.5),
        Offset(0.3, 0.7),
        Offset(0.7, 0.3),
        Offset(0.7, 0.5),
        Offset(0.7, 0.7)
      ],
    ];

    return Container(
      width: 30 * size,
      height: 30 * size,
      child: Stack(
        children: dotPatterns[count].map((offset) {
          return Positioned(
            left: offset.dx * (30 * size) - (2.5 * size),
            top: offset.dy * (30 * size) - (2.5 * size),
            child: Container(
              width: 5 * size,
              height: 5 * size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Transform.rotate(
        angle: rotation,
        child: Container(
          width: 30 * size,
          height: 65 * size,
          decoration: BoxDecoration(
            color: Color(0xFFFFFDD0),
            border: Border.all(
              color: isPlayable ? Colors.green : Colors.black,
              width: isPlayable ? 3.0 : 1.0,
            ),
            borderRadius: BorderRadius.circular(4 * size),
          ),
          child: (left != null && right != null) && showPoints
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildDots(left),
                    Container(
                      width: 30 * size,
                      height: 2 * size,
                      color: Colors.black,
                    ),
                    _buildDots(right),
                  ],
                )
              : null,
        ),
      ),
    );
  }
}

class GameScreen extends StatefulWidget {
  final String gameMode;
  final List<String> playerNames;

  const GameScreen({required this.gameMode, required this.playerNames});

  @override
  _GameScreenState createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with TickerProviderStateMixin {
  List<List<Map<String, int>>> playerTiles = [];
  List<Map<String, dynamic>> boardTiles = [];
  int currentPlayer = 0;
  int? leftEnd;
  int? rightEnd;
  List<int> teamPoints = [0, 0];
  int consecutivePasses = 0;
  String? passMessage;
  late AnimationController _animationController;
  late Animation<double> _animation;
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 300),
    );
    _animation = Tween<double>(begin: 0, end: 1).animate(_animationController);
    startNewHand();
    _loadSound();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _loadSound() async {
    await _audioPlayer.setSource(AssetSource('sounds/click.mp3'));
  }

  void startNewHand() {
    List<Map<String, int>> allTiles = [];
    for (int i = 0; i <= 6; i++) {
      for (int j = i; j <= 6; j++) {
        allTiles.add({'left': i, 'right': j});
      }
    }

    allTiles.shuffle();

    playerTiles = [];
    for (int i = 0; i < 4; i++) {
      playerTiles.add(allTiles.sublist(i * 7, (i + 1) * 7));
    }

    boardTiles = [];
    leftEnd = null;
    rightEnd = null;
    consecutivePasses = 0;
    passMessage = null;

    // Buscar el doble más alto y establecer el turno, pero no jugar automáticamente
    for (int i = 6; i >= 0; i--) {
      for (int j = 0; j < 4; j++) {
        if (playerTiles[j].any((tile) => tile['left'] == i && tile['right'] == i)) {
          currentPlayer = j;
          // Si el Jugador 1 (tú) tiene el doble, no lo juegues automáticamente
          if (j != 0) {
            playTile(j, playerTiles[j].indexWhere((tile) => tile['left'] == i && tile['right'] == i));
          }
          return;
        }
      }
    }
  }

  bool canPlayTile(Map<String, int> tile) {
    final int? leftValue = tile['left'];
    final int? rightValue = tile['right'];
    if (leftValue == null || rightValue == null) return false;
    if (boardTiles.isEmpty) return true;
    return (leftEnd != null && (leftValue == leftEnd || rightValue == leftEnd)) ||
        (rightEnd != null && (leftValue == rightEnd || rightValue == rightEnd));
  }

  void playTile(int playerIndex, int tileIndex) {
    if (playerIndex != currentPlayer) return;

    final tile = playerTiles[playerIndex][tileIndex];
    final int? leftValue = tile['left'];
    final int? rightValue = tile['right'];
    if (leftValue == null || rightValue == null) return;

    bool canPlay = false;
    bool flip = false;
    bool connectToLeft = false;

    if (boardTiles.isEmpty) {
      canPlay = true;
    } else {
      if (leftEnd != null && (leftValue == leftEnd || rightValue == leftEnd)) {
        canPlay = true;
        connectToLeft = true;
        if (rightValue == leftEnd) {
          flip = true;
        }
      } else if (rightEnd != null && (leftValue == rightEnd || rightValue == rightEnd)) {
        canPlay = true;
        connectToLeft = false;
        if (leftValue == rightEnd) {
          flip = true;
        }
      }
    }

    if (canPlay) {
      setState(() {
        consecutivePasses = 0;
        passMessage = null;
        _animationController.reset();
        _animationController.forward();

        // Reproducir sonido al jugar ficha
        _audioPlayer.play(AssetSource('sounds/click.mp3'));

        // Determinar si la ficha es un doble
        bool isDouble = leftValue == rightValue;

        if (boardTiles.isEmpty) {
          boardTiles.add({
            'left': leftValue,
            'right': rightValue,
            'rotation': isDouble ? math.pi / 2 : 0.0, // Vertical si es doble
          });
          leftEnd = leftValue;
          rightEnd = rightValue;
        } else {
          if (connectToLeft) {
            if (flip) {
              boardTiles.insert(0, {
                'left': rightValue,
                'right': leftValue,
                'rotation': isDouble ? math.pi / 2 : 0.0, // Vertical si es doble
              });
              leftEnd = rightValue;
            } else {
              boardTiles.insert(0, {
                'left': leftValue,
                'right': rightValue,
                'rotation': isDouble ? math.pi / 2 : 0.0,
              });
              leftEnd = leftValue;
            }
          } else {
            if (flip) {
              boardTiles.add({
                'left': rightValue,
                'right': leftValue,
                'rotation': isDouble ? math.pi / 2 : 0.0,
              });
              rightEnd = leftValue;
            } else {
              boardTiles.add({
                'left': leftValue,
                'right': rightValue,
                'rotation': isDouble ? math.pi / 2 : 0.0,
              });
              rightEnd = rightValue;
            }
          }
          // Rotar solo si hay más de 5 fichas, pero mantener los dobles verticales
          if (boardTiles.length > 5) {
            for (int i = 0; i < boardTiles.length; i++) {
              if (boardTiles[i]['left'] != boardTiles[i]['right']) { // No rotar dobles
                boardTiles[i]['rotation'] = math.pi / 2; // Sentido contrario a las manecillas
              }
            }
          }
        }

        playerTiles[playerIndex].removeAt(tileIndex);

        if (playerTiles[playerIndex].isEmpty) {
          endHand(playerIndex);
        } else {
          advanceTurn();
        }
      });
    } else {
      setState(() {
        consecutivePasses++;
        passMessage = "Jugador ${currentPlayer + 1} pasa";
        Future.delayed(Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              passMessage = null;
            });
          }
        });

        if (consecutivePasses >= 4) {
          endHandWithTie();
        } else {
          advanceTurn();
        }
      });
    }
  }

  void advanceTurn() {
    setState(() {
      currentPlayer = (currentPlayer + 1) % 4;
      bool canPlay = false;
      for (var tile in playerTiles[currentPlayer]) {
        final int? leftValue = tile['left'];
        final int? rightValue = tile['right'];
        if (leftValue == null || rightValue == null) continue;
        if (boardTiles.isEmpty ||
            (leftEnd != null && (leftValue == leftEnd || rightValue == leftEnd)) ||
            (rightEnd != null && (leftValue == rightEnd || rightValue == rightEnd))) {
          canPlay = true;
          break;
        }
      }
      if (!canPlay) {
        consecutivePasses++;
        passMessage = "Jugador ${currentPlayer + 1} pasa";
        Future.delayed(Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              passMessage = null;
            });
          }
        });

        if (consecutivePasses >= 4) {
          endHandWithTie();
        } else {
          advanceTurn();
        }
      }
    });
  }

  void endHand(int winner) {
    int points = 0;
    List<List<Map<String, int>>> remainingTiles = [];
    for (int i = 0; i < 4; i++) {
      if (i != winner) {
        remainingTiles.add(playerTiles[i]);
        for (var tile in playerTiles[i]) {
          points += (tile['left'] ?? 0) + (tile['right'] ?? 0);
        }
      }
    }

    if (winner == 0 || winner == 2) {
      teamPoints[0] += points;
    } else {
      teamPoints[1] += points;
    }

    if (teamPoints[0] >= 200 || teamPoints[1] >= 200) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Juego Terminado"),
          content: Text(teamPoints[0] >= 200
              ? "¡Equipo 1 ha ganado con ${teamPoints[0]} puntos!"
              : "¡Equipo 2 ha ganado con ${teamPoints[1]} puntos!"),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                setState(() {
                  teamPoints = [0, 0];
                  startNewHand();
                });
              },
              child: Text("Jugar de Nuevo"),
            ),
          ],
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Mano Terminada"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Puntos ganados: $points"),
              SizedBox(height: 10),
              Text("Fichas restantes:"),
              for (var playerTiles in remainingTiles)
                for (var tile in playerTiles)
                  Text("${tile['left']}-${tile['right']}"),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                startNewHand();
              },
              child: Text("Continuar"),
            ),
          ],
        ),
      );
    }
  }

  void endHandWithTie() {
    int points = 0;
    List<List<Map<String, int>>> remainingTiles = [];
    for (int i = 0; i < 4; i++) {
      remainingTiles.add(playerTiles[i]);
      for (var tile in playerTiles[i]) {
        points += (tile['left'] ?? 0) + (tile['right'] ?? 0);
      }
    }

    if (teamPoints[0] <= teamPoints[1]) {
      teamPoints[0] += points;
    } else {
      teamPoints[1] += points;
    }

    if (teamPoints[0] >= 200 || teamPoints[1] >= 200) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Juego Terminado"),
          content: Text(teamPoints[0] >= 200
              ? "¡Equipo 1 ha ganado con ${teamPoints[0]} puntos!"
              : "¡Equipo 2 ha ganado con ${teamPoints[1]} puntos!"),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                setState(() {
                  teamPoints = [0, 0];
                  startNewHand();
                });
              },
              child: Text("Jugar de Nuevo"),
            ),
          ],
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Empate"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Puntos sumados: $points"),
              SizedBox(height: 10),
              Text("Fichas restantes:"),
              for (var playerTiles in remainingTiles)
                for (var tile in playerTiles)
                  Text("${tile['left']}-${tile['right']}"),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                startNewHand();
              },
              child: Text("Continuar"),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final double tileHeightAfterRotation = 65 * 0.5;

    return Scaffold(
      backgroundColor: Colors.green[100], // Fondo verde
      appBar: AppBar(
        title: Text("Juego - ${widget.gameMode}"),
        backgroundColor: Colors.grey[400],
      ),
      body: Stack(
        children: [
          // Fichas jugadas en el centro
          Positioned(
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            child: Center(
              child: boardTiles.isEmpty
                  ? SizedBox.shrink()
                  : SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: boardTiles.asMap().entries.map((entry) {
                          int idx = entry.key;
                          Map<String, dynamic> tile = entry.value;
                          double offsetX = 0.0;
                          double offsetY = 0.0;

                          // Determinar si la ficha actual es un doble
                          bool isDouble = tile['left'] == tile['right'];

                          if (idx > 0) {
                            Map<String, dynamic> previousTile = boardTiles[idx - 1];
                            int? previousRight = previousTile['right'];
                            int? currentLeft = tile['left'];
                            bool previousIsDouble = previousTile['left'] == previousTile['right'];

                            if (previousRight == currentLeft) {
                              if (previousIsDouble) {
                                // Si la anterior es un doble (vertical), conectar al centro
                                offsetX = -32.0 * 0.7; // Ajustado para conectar al centro del doble
                                offsetY = 0.0; // Centrar verticalmente con el doble
                              } else {
                                offsetX = -30.0 * 0.7; // Conexión horizontal normal
                                offsetY = 0.0;
                              }
                            }
                          }
                          if (idx < boardTiles.length - 1) {
                            Map<String, dynamic> nextTile = boardTiles[idx + 1];
                            int? nextLeft = nextTile['left'];
                            int? currentRight = tile['right'];
                            bool nextIsDouble = nextTile['left'] == nextTile['right'];

                            if (currentRight == nextLeft) {
                              if (isDouble) {
                                offsetX = 32.0 * 0.7; // Ajustar para conectar al centro del doble
                                offsetY = 0.0; // Centrar verticalmente
                              } else if (nextIsDouble) {
                                offsetX = 32.0 * 0.7; // Ajustar para conectar al centro del siguiente doble
                                offsetY = 0.0; // Centrar verticalmente
                              } else {
                                offsetX = 0.0;
                                offsetY = 0.0;
                              }
                            }
                          }

                          return AnimatedBuilder(
                            animation: _animation,
                            builder: (context, child) {
                              return Transform.translate(
                                offset: Offset(
                                  offsetX + (1 - _animation.value) * 50,
                                  offsetY + (1 - _animation.value) * 50,
                                ),
                                child: DominoTile(
                                  left: tile['left'],
                                  right: tile['right'],
                                  showPoints: true,
                                  size: 0.7,
                                  rotation: tile['rotation'] ?? 0.0,
                                ),
                              );
                            },
                          );
                        }).toList(),
                      ),
                    ),
            ),
          ),
          // Contador de puntos por equipo (arriba, a la derecha)
          Positioned(
            top: 10,
            right: 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  "Equipo 1: ${teamPoints[0]}",
                  style: TextStyle(fontSize: 16),
                ),
                Text(
                  "Equipo 2: ${teamPoints[1]}",
                  style: TextStyle(fontSize: 16),
                ),
              ],
            ),
          ),
          // Mensaje temporal al pasar (centrado)
          if (passMessage != null)
            Positioned(
              top: 100,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  color: Colors.black54,
                  child: Text(
                    passMessage!,
                    style: TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ),
              ),
            ),
          // Jugador 3 (arriba, al borde)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Padding(
              padding: const EdgeInsets.only(top: 9.0),
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: 0.0,
                runSpacing: 0.0,
                children: playerTiles[2].map((tile) {
                  return DominoTile(
                    left: tile['left'],
                    right: tile['right'],
                    showPoints: false,
                    size: 0.7,
                  );
                }).toList(),
              ),
            ),
          ),
          // Jugador 2 (izquierda, al borde)
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Padding(
              padding: const EdgeInsets.only(left: 15.0),
              child: Wrap(
                direction: Axis.vertical,
                spacing: 0.0,
                runSpacing: 0.0,
                alignment: WrapAlignment.center,
                children: playerTiles[1].map((tile) {
                  return Transform.rotate(
                    angle: math.pi / 2, // Sentido contrario a las manecillas
                    child: DominoTile(
                      left: tile['left'],
                      right: tile['right'],
                      showPoints: false,
                      size: 0.7,
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          // Jugador 4 (derecha, al borde)
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            child: Padding(
              padding: const EdgeInsets.only(right: 15.0),
              child: Wrap(
                direction: Axis.vertical,
                spacing: 0.0,
                runSpacing: 0.0,
                alignment: WrapAlignment.center,
                children: playerTiles[3].map((tile) {
                  return Transform.rotate(
                    angle: math.pi / 2, // Sentido contrario a las manecillas
                    child: DominoTile(
                      left: tile['left'],
                      right: tile['right'],
                      showPoints: false,
                      size: 0.7,
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          // Jugador 1 (abajo, al borde)
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(2.0),
              child: Wrap(
                spacing: 8.0,
                children: playerTiles[0].asMap().entries.map((entry) {
                  int idx = entry.key;
                  Map<String, int> tile = entry.value;
                  return DominoTile(
                    left: tile['left'],
                    right: tile['right'],
                    showPoints: true,
                    size: 0.93,
                    onTap: currentPlayer == 0 ? () => playTile(0, idx) : null,
                    isPlayable: currentPlayer == 0 && canPlayTile(tile),
                  );
                }).toList(),
              ),
            ),
          ),
          // Indicador de turno actual (abajo)
          Positioned(
            bottom: 70,
            left: 0,
            right: 0,
            child: Center(
              child: Text(
                "Turno: Jugador ${currentPlayer + 1}",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}