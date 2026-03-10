import 'package:flutter/material.dart';
import 'game_screen.dart';

class LobbyScreen extends StatefulWidget {
  final String gameMode;

  const LobbyScreen({required this.gameMode});

  @override
  _LobbyScreenState createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  final List<TextEditingController> _controllers = List.generate(
    4,
    (index) => TextEditingController(),
  );

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  bool _areAllFieldsFilled() {
    return _controllers.every((controller) => controller.text.isNotEmpty);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[200],
      appBar: AppBar(
        title: Text("Sala - ${widget.gameMode}"),
        backgroundColor: Colors.grey[400],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _controllers[0],
              decoration: InputDecoration(
                labelText: 'Jugador 1',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() {}),
            ),
            SizedBox(height: 10),
            TextField(
              controller: _controllers[1],
              decoration: InputDecoration(
                labelText: 'Jugador 2',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() {}),
            ),
            SizedBox(height: 10),
            TextField(
              controller: _controllers[2],
              decoration: InputDecoration(
                labelText: 'Jugador 3',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() {}),
            ),
            SizedBox(height: 10),
            TextField(
              controller: _controllers[3],
              decoration: InputDecoration(
                labelText: 'Jugador 4',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() {}),
            ),
            SizedBox(height: 30),
            ElevatedButton(
              onPressed: _areAllFieldsFilled()
                  ? () {
                      final playerNames = _controllers.map((c) => c.text).toList();
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => GameScreen(
                            gameMode: widget.gameMode,
                            playerNames: playerNames,
                          ),
                        ),
                      );
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(horizontal: 40, vertical: 20),
                backgroundColor: _areAllFieldsFilled()
                    ? null
                    : Colors.grey,
              ),
              child: Text('Iniciar', style: TextStyle(fontSize: 20)),
            ),
          ],
        ),
      ),
    );
  }
}