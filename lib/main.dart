import 'package:flutter/material.dart';
import 'selection_screen.dart';
import 'lobby_screen.dart';
import 'game_screen.dart';

void main() {
  runApp(DominosPRApp());
}

class DominosPRApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      initialRoute: '/',
      routes: {
        '/': (context) => MenuScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/selection') {
          final String gameMode = settings.arguments as String;
          return MaterialPageRoute(
            builder: (context) => SelectionScreen(gameMode: gameMode),
          );
        } else if (settings.name == '/lobby') {
          final String gameMode = settings.arguments as String;
          return MaterialPageRoute(
            builder: (context) => LobbyScreen(gameMode: gameMode),
          );
        }
        return null;
      },
    );
  }
}

class MenuScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[200],
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              onPressed: () {
                Navigator.pushNamed(context, '/selection', arguments: 'Modo 200');
              },
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(horizontal: 40, vertical: 20),
              ),
              child: Text('Modo 200', style: TextStyle(fontSize: 20)),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pushNamed(context, '/selection', arguments: 'Modo 500');
              },
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(horizontal: 40, vertical: 20),
              ),
              child: Text('Modo 500', style: TextStyle(fontSize: 20)),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                // Acción para Opciones (por ahora vacía)
              },
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(horizontal: 40, vertical: 20),
              ),
              child: Text('Opciones', style: TextStyle(fontSize: 20)),
            ),
          ],
        ),
      ),
    );
  }
}