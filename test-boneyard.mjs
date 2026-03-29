// Test script: simulates a 2-player game to reproduce the boneyard draw bug
import { io } from "socket.io-client";

const URL = "http://localhost:3001";

function connect(name) {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ["websocket"] });
    s.on("connect", () => {
      console.log(`[${name}] connected: ${s.id}`);
      resolve(s);
    });
  });
}

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, (data) => resolve(data));
  });
}

async function runGame(gameNum) {
  const p1 = await connect("P1");
  const p2 = await connect("P2");

  // P1 creates room
  const createPromise = waitFor(p1, "room:created");
  p1.emit("room:create", { playerName: "Player1", gameMode: "modo200" });
  const { roomCode } = await createPromise;
  console.log(`Room created: ${roomCode}`);

  // P2 joins
  const joinPromise = waitFor(p2, "room:joined");
  p2.emit("room:join", { roomCode, playerName: "Player2" });
  await joinPromise;
  console.log("Player2 joined");

  // Track game states for each player
  let p1State = null;
  let p2State = null;
  let moveCount = 0;

  p1.on("game:state_snapshot", ({ gameState }) => { p1State = gameState; });
  p2.on("game:state_snapshot", ({ gameState }) => { p2State = gameState; });
  p1.on("game:started", ({ gameState }) => { p1State = gameState; });
  p2.on("game:started", ({ gameState }) => { p2State = gameState; });
  p1.on("game:player_passed", (d) => console.log(`  [PASS] ${d.playerName} passed`));
  p2.on("game:player_passed", (d) => {}); // suppress duplicate
  p1.on("game:round_ended", (d) => console.log(`  [ROUND ENDED] winner team scores: ${JSON.stringify(d.scores)}`));
  p2.on("game:round_ended", (d) => {});

  // Start game
  const p1Started = waitFor(p1, "game:started");
  const p2Started = waitFor(p2, "game:started");
  p1.emit("game:start", { roomCode });
  await Promise.all([p1Started, p2Started]);
  console.log("Game started!");

  // Game loop
  for (let turn = 0; turn < 100; turn++) {
    await new Promise((r) => setTimeout(r, 100)); // let state settle

    // Find whose turn it is
    const myState = p1State?.isMyTurn ? p1State : p2State?.isMyTurn ? p2State : null;
    const mySocket = p1State?.isMyTurn ? p1 : p2;
    const myName = p1State?.isMyTurn ? "P1" : "P2";

    if (!myState) {
      console.log(`  Turn ${turn}: No one's turn? p1.isMyTurn=${p1State?.isMyTurn} p2.isMyTurn=${p2State?.isMyTurn}`);
      console.log(`  p1: awaitingBoneyardDraw=${p1State?.awaitingBoneyardDraw} validPlays=${p1State?.validPlays?.length} boneyard=${p1State?.boneyardCount}`);
      console.log(`  p2: awaitingBoneyardDraw=${p2State?.awaitingBoneyardDraw} validPlays=${p2State?.validPlays?.length} boneyard=${p2State?.boneyardCount}`);

      // THIS IS THE BUG - someone should have a turn
      if (p1State?.boneyardCount > 0 || p2State?.boneyardCount > 0) {
        console.log("\n🐛 BUG FOUND! Nobody's turn but boneyard has tiles!");
        console.log("P1 full state:", JSON.stringify({
          isMyTurn: p1State?.isMyTurn,
          awaitingBoneyardDraw: p1State?.awaitingBoneyardDraw,
          validPlays: p1State?.validPlays?.length,
          boneyardCount: p1State?.boneyardCount,
          currentPlayerIndex: p1State?.currentPlayerIndex,
          myPlayerIndex: p1State?.myPlayerIndex,
        }));
        console.log("P2 full state:", JSON.stringify({
          isMyTurn: p2State?.isMyTurn,
          awaitingBoneyardDraw: p2State?.awaitingBoneyardDraw,
          validPlays: p2State?.validPlays?.length,
          boneyardCount: p2State?.boneyardCount,
          currentPlayerIndex: p2State?.currentPlayerIndex,
          myPlayerIndex: p2State?.myPlayerIndex,
        }));
      }
      break;
    }

    // Check for boneyard draw situation
    if (myState.awaitingBoneyardDraw) {
      console.log(`  Turn ${turn} [${myName}]: BONEYARD DRAW (boneyard=${myState.boneyardCount})`);
      const statePromise = waitFor(mySocket, "game:state_snapshot");
      mySocket.emit("game:draw_from_boneyard", { roomCode });
      await statePromise;
      continue;
    }

    // Check if player has valid plays
    if (myState.validPlays.length === 0) {
      console.log(`\n🐛 BUG FOUND! ${myName}'s turn but NO valid plays and awaitingBoneyardDraw=${myState.awaitingBoneyardDraw}`);
      console.log(`  boneyardCount=${myState.boneyardCount}`);
      console.log(`  currentPlayerIndex=${myState.currentPlayerIndex}`);
      console.log(`  myPlayerIndex=${myState.myPlayerIndex}`);
      const tiles = myState.players[myState.myPlayerIndex]?.tiles;
      console.log(`  hand: ${tiles?.map(t => t.id).join(", ")}`);
      console.log(`  board leftEnd=${myState.board?.leftEnd} rightEnd=${myState.board?.rightEnd}`);
      p1.disconnect(); p2.disconnect();
      return 'BUG';
    }

    // Play first valid move
    const play = myState.validPlays[0];
    console.log(`  Turn ${turn} [${myName}]: play ${play.tileId} on ${play.targetEnd} (validPlays=${myState.validPlays.length}, boneyard=${myState.boneyardCount})`);

    const nextState = waitFor(mySocket, "game:state_snapshot");
    mySocket.emit("game:play_tile", { roomCode, tileId: play.tileId, targetEnd: play.targetEnd });
    await nextState;
    moveCount++;
  }

  // Wait a bit then disconnect
  await new Promise((r) => setTimeout(r, 200));
  p1.disconnect();
  p2.disconnect();
  return 'OK';
}

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      const result = await runGame(i);
      if (result === 'BUG') {
        console.log(`\n🐛 Bug reproduced on game ${i}!`);
        process.exit(1);
      }
    } catch(e) {
      console.error(`Game ${i} error:`, e.message);
    }
  }
  console.log("\n✅ 20 games completed without bug");
  process.exit(0);
}
main();
