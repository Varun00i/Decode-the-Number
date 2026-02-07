const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── Production Middleware ───────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), rooms: rooms.size, players: io.engine.clientsCount });
});

// ─── Game State Storage ──────────────────────────────────────────
const rooms = new Map();       // roomCode -> room object
const playerRooms = new Map(); // socketId -> roomCode

// ─── Player Stats Storage ────────────────────────────────────────
const STATS_FILE = path.join(__dirname, 'player-stats.json');
let playerStats = new Map(); // playerName -> { gamesPlayed, wins, losses, winStreak, bestStreak, lastPlayed }

// Load stats from file on startup
try {
  if (fs.existsSync(STATS_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    playerStats = new Map(Object.entries(data));
    console.log(`Loaded stats for ${playerStats.size} players.`);
  }
} catch (e) { console.log('No existing stats file, starting fresh.'); }

function saveStats() {
  try {
    const obj = Object.fromEntries(playerStats);
    fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) { console.error('Failed to save stats:', e.message); }
}

function getOrCreateStats(name) {
  if (!playerStats.has(name)) {
    playerStats.set(name, {
      gamesPlayed: 0, wins: 0, losses: 0,
      winStreak: 0, bestStreak: 0, lastPlayed: null
    });
  }
  return playerStats.get(name);
}

function recordWin(winnerName, loserName) {
  const ws = getOrCreateStats(winnerName);
  ws.gamesPlayed++;
  ws.wins++;
  ws.winStreak++;
  ws.bestStreak = Math.max(ws.bestStreak, ws.winStreak);
  ws.lastPlayed = Date.now();

  const ls = getOrCreateStats(loserName);
  ls.gamesPlayed++;
  ls.losses++;
  ls.winStreak = 0;
  ls.lastPlayed = Date.now();

  saveStats();
}

// ─── Stats API ───────────────────────────────────────────────────
app.get('/api/stats/:name', (req, res) => {
  const name = req.params.name;
  const stats = playerStats.get(name);
  if (!stats) return res.json({ gamesPlayed: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0, winRate: 0 });
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  res.json({ ...stats, winRate });
});

app.get('/api/leaderboard', (req, res) => {
  const entries = [];
  for (const [name, stats] of playerStats) {
    entries.push({ name, ...stats, winRate: stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0 });
  }
  entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
  res.json(entries.slice(0, 20));
});

app.get('/api/online', (req, res) => {
  res.json({ online: io.engine.clientsCount, rooms: rooms.size });
});

// ─── Helper: Validate a secret number ────────────────────────────
function validateNumber(numStr, length) {
  if (numStr.length !== length) return false;
  if (!/^\d+$/.test(numStr)) return false;
  const digits = numStr.split('');
  return new Set(digits).size === digits.length; // no repeats
}

// ─── Helper: Compute feedback (correct digits & correct positions) ─
function computeFeedback(secret, guess) {
  let correctPosition = 0;
  let correctDigit = 0;
  const secretArr = secret.split('');
  const guessArr = guess.split('');

  // Count correct positions first
  for (let i = 0; i < secretArr.length; i++) {
    if (guessArr[i] === secretArr[i]) {
      correctPosition++;
    }
  }

  // Count correct digits (regardless of position)
  const secretCount = {};
  const guessCount = {};
  for (const d of secretArr) secretCount[d] = (secretCount[d] || 0) + 1;
  for (const d of guessArr) guessCount[d] = (guessCount[d] || 0) + 1;
  for (const d of Object.keys(guessCount)) {
    if (secretCount[d]) {
      correctDigit += Math.min(guessCount[d], secretCount[d]);
    }
  }

  return { correctDigit, correctPosition };
}

// ─── Helper: Create room ─────────────────────────────────────────
function createRoom(code, numberLength) {
  return {
    code,
    numberLength: numberLength || 4,
    players: [],        // [{ id, socketId, name, secret, guesses }]
    turn: 0,            // index in players array
    phase: 'waiting',   // waiting | setup | playing | finished
    chat: [],           // [{ sender, text, timestamp, reactions }]
    winner: null
  };
}

// ─── Socket.io Events ────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ── Create Room ──
  socket.on('createRoom', ({ playerName, numberLength }) => {
    const code = uuidv4().slice(0, 6).toUpperCase();
    const room = createRoom(code, numberLength);
    room.players.push({
      id: socket.id,
      socketId: socket.id,
      name: playerName || 'Player 1',
      secret: null,
      guesses: []
    });
    room.phase = 'waiting';
    rooms.set(code, room);
    playerRooms.set(socket.id, code);
    socket.join(code);
    socket.emit('roomCreated', { code, numberLength: room.numberLength, playerIndex: 0 });
    console.log(`Room ${code} created by ${playerName}`);
  });

  // ── Join Room ──
  socket.on('joinRoom', ({ code, playerName }) => {
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full.' });
      return;
    }
    room.players.push({
      id: socket.id,
      socketId: socket.id,
      name: playerName || 'Player 2',
      secret: null,
      guesses: []
    });
    playerRooms.set(socket.id, code);
    socket.join(code);
    room.phase = 'setup';

    socket.emit('roomJoined', {
      code,
      numberLength: room.numberLength,
      playerIndex: 1,
      opponentName: room.players[0].name
    });
    // Notify player 1
    io.to(room.players[0].socketId).emit('opponentJoined', {
      opponentName: playerName || 'Player 2'
    });
    io.to(code).emit('phaseChange', { phase: 'setup', numberLength: room.numberLength });
    console.log(`${playerName} joined room ${code}`);
  });

  // ── Quick Match ──
  socket.on('quickMatch', ({ playerName, numberLength }) => {
    // Find an open room with matching number length
    let foundRoom = null;
    for (const [code, room] of rooms) {
      if (room.phase === 'waiting' && room.players.length === 1 && room.numberLength === (numberLength || 4)) {
        foundRoom = room;
        break;
      }
    }

    if (foundRoom) {
      foundRoom.players.push({
        id: socket.id,
        socketId: socket.id,
        name: playerName || 'Player 2',
        secret: null,
        guesses: []
      });
      playerRooms.set(socket.id, foundRoom.code);
      socket.join(foundRoom.code);
      foundRoom.phase = 'setup';

      socket.emit('roomJoined', {
        code: foundRoom.code,
        numberLength: foundRoom.numberLength,
        playerIndex: 1,
        opponentName: foundRoom.players[0].name
      });
      io.to(foundRoom.players[0].socketId).emit('opponentJoined', {
        opponentName: playerName || 'Player 2'
      });
      io.to(foundRoom.code).emit('phaseChange', { phase: 'setup', numberLength: foundRoom.numberLength });
    } else {
      // Create a new room and wait
      const code = uuidv4().slice(0, 6).toUpperCase();
      const room = createRoom(code, numberLength);
      room.players.push({
        id: socket.id,
        socketId: socket.id,
        name: playerName || 'Player 1',
        secret: null,
        guesses: []
      });
      rooms.set(code, room);
      playerRooms.set(socket.id, code);
      socket.join(code);
      socket.emit('quickMatchWaiting', { code, numberLength: room.numberLength });
    }
  });

  // ── Set Secret Number ──
  socket.on('setSecret', ({ secret }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.phase !== 'setup') return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    if (!validateNumber(secret, room.numberLength)) {
      socket.emit('error', { message: `Enter a valid ${room.numberLength}-digit number with no repeating digits.` });
      return;
    }

    player.secret = secret;
    socket.emit('secretSet', { success: true });

    // Notify opponent that this player is ready
    const opponent = room.players.find(p => p.socketId !== socket.id);
    if (opponent) {
      io.to(opponent.socketId).emit('opponentReady');
    }

    // If both players have set their secrets, start the game
    if (room.players.every(p => p.secret !== null)) {
      room.phase = 'playing';
      room.turn = 0;
      io.to(code).emit('phaseChange', { phase: 'playing' });
      io.to(code).emit('turnUpdate', {
        currentTurn: room.players[room.turn].name,
        currentTurnSocketId: room.players[room.turn].socketId
      });
    }
  });

  // ── Make a Guess ──
  socket.on('makeGuess', ({ guess }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;

    const currentPlayer = room.players[room.turn];
    if (currentPlayer.socketId !== socket.id) {
      socket.emit('error', { message: "It's not your turn!" });
      return;
    }

    if (!validateNumber(guess, room.numberLength)) {
      socket.emit('error', { message: `Enter a valid ${room.numberLength}-digit number with no repeating digits.` });
      return;
    }

    // The player guesses the OPPONENT's secret
    const opponentIndex = room.turn === 0 ? 1 : 0;
    const opponent = room.players[opponentIndex];
    const feedback = computeFeedback(opponent.secret, guess);

    const guessEntry = {
      guess,
      correctDigit: feedback.correctDigit,
      correctPosition: feedback.correctPosition,
      timestamp: Date.now()
    };
    currentPlayer.guesses.push(guessEntry);

    // Send guess result to both players
    io.to(code).emit('guessResult', {
      playerName: currentPlayer.name,
      playerSocketId: currentPlayer.socketId,
      guess,
      correctDigit: feedback.correctDigit,
      correctPosition: feedback.correctPosition,
      guessNumber: currentPlayer.guesses.length
    });

    // Check for win
    if (feedback.correctPosition === room.numberLength) {
      room.phase = 'finished';
      room.winner = currentPlayer.name;

      // Record stats
      const loser = room.players.find(p => p.socketId !== currentPlayer.socketId);
      recordWin(currentPlayer.name, loser.name);

      // Send winner & loser stats
      const winnerStats = getOrCreateStats(currentPlayer.name);
      const loserStats = getOrCreateStats(loser.name);

      io.to(code).emit('gameOver', {
        winner: currentPlayer.name,
        winnerSocketId: currentPlayer.socketId,
        secrets: {
          [room.players[0].name]: room.players[0].secret,
          [room.players[1].name]: room.players[1].secret
        },
        totalGuesses: {
          [room.players[0].name]: room.players[0].guesses.length,
          [room.players[1].name]: room.players[1].guesses.length
        },
        stats: {
          [currentPlayer.name]: { ...winnerStats, winRate: winnerStats.gamesPlayed > 0 ? Math.round((winnerStats.wins / winnerStats.gamesPlayed) * 100) : 0 },
          [loser.name]: { ...loserStats, winRate: loserStats.gamesPlayed > 0 ? Math.round((loserStats.wins / loserStats.gamesPlayed) * 100) : 0 }
        }
      });
      return;
    }

    // Switch turns
    room.turn = opponentIndex;
    io.to(code).emit('turnUpdate', {
      currentTurn: room.players[room.turn].name,
      currentTurnSocketId: room.players[room.turn].socketId
    });
  });

  // ── Chat Message ──
  socket.on('chatMessage', ({ text }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const msg = {
      id: uuidv4(),
      sender: player.name,
      senderSocketId: socket.id,
      text,
      timestamp: Date.now(),
      reactions: {}
    };
    room.chat.push(msg);
    io.to(code).emit('chatMessage', msg);
  });

  // ── Chat Reaction ──
  socket.on('chatReaction', ({ messageId, emoji }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const msg = room.chat.find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(player.name);
    if (idx > -1) {
      msg.reactions[emoji].splice(idx, 1);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = [player.name];
    }

    io.to(code).emit('chatReactionUpdate', { messageId, reactions: msg.reactions });
  });

  // ── Play Again ──
  socket.on('playAgain', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    // Reset game state
    room.players.forEach(p => {
      p.secret = null;
      p.guesses = [];
    });
    room.phase = 'setup';
    room.turn = 0;
    room.winner = null;
    room.chat = [];

    io.to(code).emit('phaseChange', { phase: 'setup', numberLength: room.numberLength });
    io.to(code).emit('gameReset');
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      io.to(code).emit('opponentDisconnected');
      // Clean up
      room.players = room.players.filter(p => p.socketId !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(code);
      } else {
        room.phase = 'waiting';
      }
    }
    playerRooms.delete(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// ─── Start Server ────────────────────────────────────────────────
// ─── Periodic cleanup of empty rooms ─────────────────────────────
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.players.length === 0) rooms.delete(code);
  }
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🎮  Decode the Number — Server running on port ${PORT}`);
  console.log(`  📊  Health check at /health`);
  console.log(`  🏆  Leaderboard at /api/leaderboard\n`);
});
