/* ═══════════════════════════════════════════════════════════════
   DECODE THE NUMBER — MAIN GAME CLIENT
   Handles all screens, game logic, Socket.io events, particles
   ═══════════════════════════════════════════════════════════════ */

(() => {
  // ─── Socket ──────────────────────────────────────────────────
  const socket = io();

  // ─── State ───────────────────────────────────────────────────
  let mySocketId = null;
  let myName = '';
  let opponentName = '';
  let roomCode = '';
  let numberLength = 4;
  let playerIndex = -1;
  let isMyTurn = false;

  // Digit input state
  let secretDigits = [];
  let guessDigits = [];

  // Guess history
  let myGuesses = [];
  let opponentGuesses = [];

  // ─── DOM References ──────────────────────────────────────────
  const screens = {
    landing:   document.getElementById('screen-landing'),
    waiting:   document.getElementById('screen-waiting'),
    setup:     document.getElementById('screen-setup'),
    game:      document.getElementById('screen-game'),
    gameover:  document.getElementById('screen-gameover')
  };

  // ─── Init ────────────────────────────────────────────────────
  socket.on('connect', () => {
    mySocketId = socket.id;
  });

  initParticles();
  bindLandingEvents();
  bindSetupEvents();
  bindGameEvents();
  bindGameOverEvents();
  bindSoundToggle();
  bindLeaderboard();
  bindConnectionStatus();
  fetchOnlineCount();
  Chat.init(socket, mySocketId);

  // Update Chat's socketId when we get connected
  socket.on('connect', () => {
    mySocketId = socket.id;
    Chat.updateMyId(mySocketId);
  });

  // ─── SCREEN MANAGEMENT ──────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ─── TOAST ───────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── LANDING SCREEN EVENTS ──────────────────────────────────
  function bindLandingEvents() {
    // Number length selector
    document.querySelectorAll('.len-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.tap();
        document.querySelectorAll('.len-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        numberLength = parseInt(btn.dataset.len);
      });
    });

    // Quick Match
    document.getElementById('btnQuickMatch').addEventListener('click', () => {
      SFX.tap();
      myName = document.getElementById('playerName').value.trim() || 'Player';
      socket.emit('quickMatch', { playerName: myName, numberLength });
    });

    // Create Room
    document.getElementById('btnCreateRoom').addEventListener('click', () => {
      SFX.tap();
      myName = document.getElementById('playerName').value.trim() || 'Player';
      socket.emit('createRoom', { playerName: myName, numberLength });
    });

    // Join Room toggle
    document.getElementById('btnJoinRoom').addEventListener('click', () => {
      SFX.tap();
      document.getElementById('joinRoomSection').classList.toggle('hidden');
    });

    // Join Room confirm
    document.getElementById('btnJoinConfirm').addEventListener('click', () => {
      SFX.tap();
      myName = document.getElementById('playerName').value.trim() || 'Player';
      const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
      if (!code) {
        showToast('Please enter a room code', 'error');
        SFX.error();
        return;
      }
      socket.emit('joinRoom', { code, playerName: myName });
    });

    // Load stats when name is entered
    document.getElementById('playerName').addEventListener('blur', () => {
      const name = document.getElementById('playerName').value.trim();
      if (name) fetchMyStats(name);
    });
    document.getElementById('playerName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const name = document.getElementById('playerName').value.trim();
        if (name) fetchMyStats(name);
      }
    });
  }

  // ─── SETUP SCREEN EVENTS ───────────────────────────────────
  function bindSetupEvents() {
    // Setup numpad
    document.querySelectorAll('#numpad .numpad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const digit = btn.dataset.digit;
        if (digit === 'del') {
          if (secretDigits.length > 0) {
            secretDigits.pop();
            SFX.digitDelete();
          }
        } else if (digit === 'ok') {
          submitSecret();
        } else {
          if (secretDigits.length < numberLength) {
            // Prevent duplicate digits
            if (secretDigits.includes(digit)) {
              showToast('No repeating digits allowed!', 'error');
              SFX.error();
              return;
            }
            secretDigits.push(digit);
            SFX.digitInput();
          }
        }
        renderSecretDigits();
        updateNumpadState('numpad', secretDigits);
      });
    });
  }

  function renderSecretDigits() {
    const section = document.getElementById('digitInputSection');
    section.innerHTML = '';
    for (let i = 0; i < numberLength; i++) {
      const box = document.createElement('div');
      box.className = 'digit-box';
      if (secretDigits[i] !== undefined) {
        box.textContent = secretDigits[i];
        box.classList.add('filled');
      }
      if (i === secretDigits.length && secretDigits.length < numberLength) {
        box.classList.add('active');
      }
      section.appendChild(box);
    }
  }

  function submitSecret() {
    if (secretDigits.length !== numberLength) {
      showToast(`Enter all ${numberLength} digits`, 'error');
      SFX.error();
      return;
    }
    const secret = secretDigits.join('');
    socket.emit('setSecret', { secret });
    SFX.confirm();
  }

  // ─── GAME SCREEN EVENTS ────────────────────────────────────
  function bindGameEvents() {
    // Guess numpad
    document.querySelectorAll('#guessNumpad .numpad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const digit = btn.dataset.digit;
        if (!isMyTurn) return;
        if (digit === 'del') {
          if (guessDigits.length > 0) {
            guessDigits.pop();
            SFX.digitDelete();
          }
        } else if (digit === 'ok') {
          submitGuess();
        } else {
          if (guessDigits.length < numberLength) {
            if (guessDigits.includes(digit)) {
              showToast('No repeating digits allowed!', 'error');
              SFX.error();
              return;
            }
            guessDigits.push(digit);
            SFX.digitInput();
          }
        }
        renderGuessDigits();
        updateNumpadState('guessNumpad', guessDigits);
      });
    });

    // History tabs
    document.getElementById('tabYours').addEventListener('click', () => {
      SFX.tap();
      switchHistoryTab('yours');
    });
    document.getElementById('tabOpponent').addEventListener('click', () => {
      SFX.tap();
      switchHistoryTab('opponent');
    });
  }

  function renderGuessDigits() {
    const section = document.getElementById('guessDigitBoxes');
    section.innerHTML = '';
    for (let i = 0; i < numberLength; i++) {
      const box = document.createElement('div');
      box.className = 'digit-box';
      if (guessDigits[i] !== undefined) {
        box.textContent = guessDigits[i];
        box.classList.add('filled');
      }
      if (i === guessDigits.length && guessDigits.length < numberLength) {
        box.classList.add('active');
      }
      section.appendChild(box);
    }
  }

  function updateNumpadState(numpadId, currentDigits) {
    document.querySelectorAll(`#${numpadId} .numpad-btn`).forEach(btn => {
      const d = btn.dataset.digit;
      if (d === 'del' || d === 'ok') return;
      if (currentDigits.includes(d)) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
    });
  }

  function submitGuess() {
    if (guessDigits.length !== numberLength) {
      showToast(`Enter all ${numberLength} digits`, 'error');
      SFX.error();
      return;
    }
    const guess = guessDigits.join('');
    socket.emit('makeGuess', { guess });
    SFX.guessSubmit();
    guessDigits = [];
    renderGuessDigits();
    resetNumpad('guessNumpad');
  }

  function resetNumpad(numpadId) {
    document.querySelectorAll(`#${numpadId} .numpad-btn`).forEach(btn => {
      btn.classList.remove('disabled');
    });
  }

  function switchHistoryTab(tab) {
    document.getElementById('tabYours').classList.toggle('active', tab === 'yours');
    document.getElementById('tabOpponent').classList.toggle('active', tab === 'opponent');
    document.getElementById('historyYours').classList.toggle('hidden', tab !== 'yours');
    document.getElementById('historyOpponent').classList.toggle('hidden', tab !== 'opponent');
  }

  function renderHistory() {
    renderHistoryList('historyYours', myGuesses, 'You');
    renderHistoryList('historyOpponent', opponentGuesses, opponentName);
  }

  function renderHistoryList(containerId, guesses, label) {
    const container = document.getElementById(containerId);
    if (guesses.length === 0) {
      container.innerHTML = `<div class="empty-history">${label === 'You' ? 'No guesses yet. Start guessing!' : "Opponent hasn't guessed yet."}</div>`;
      return;
    }
    container.innerHTML = '';
    guesses.forEach((g, idx) => {
      const entry = document.createElement('div');
      entry.className = 'guess-entry';

      const digitsHTML = g.guess.split('').map(d =>
        `<div class="guess-digit">${d}</div>`
      ).join('');

      entry.innerHTML = `
        <span class="guess-number">#${idx + 1}</span>
        <div class="guess-digits">${digitsHTML}</div>
        <div class="guess-feedback">
          <span class="feedback-item fb-position">📍 ${g.correctPosition}</span>
          <span class="feedback-item fb-digit">🔢 ${g.correctDigit}</span>
        </div>
      `;
      container.appendChild(entry);
    });
    container.scrollTop = container.scrollHeight;
  }

  function updateTurnUI() {
    const indicator = document.getElementById('turnIndicator');
    const turnText = document.getElementById('turnText');
    const guessArea = document.getElementById('guessInputArea');
    const numpad = document.getElementById('guessNumpad');
    const waitMsg = document.getElementById('waitingTurnMsg');

    if (isMyTurn) {
      indicator.className = 'turn-indicator your-turn';
      turnText.textContent = '🎯 Your Turn';
      numpad.classList.remove('hidden');
      waitMsg.classList.add('hidden');
    } else {
      indicator.className = 'turn-indicator opp-turn';
      turnText.textContent = `⏳ ${opponentName}'s Turn`;
      numpad.classList.add('hidden');
      waitMsg.classList.remove('hidden');
    }
  }

  // ─── GAME OVER EVENTS ──────────────────────────────────────
  function bindGameOverEvents() {
    document.getElementById('btnPlayAgain').addEventListener('click', () => {
      SFX.tap();
      socket.emit('playAgain');
    });
    document.getElementById('btnExitGame').addEventListener('click', () => {
      SFX.tap();
      location.reload();
    });
  }

  // ─── SOCKET EVENT HANDLERS ─────────────────────────────────
  // Room created
  socket.on('roomCreated', ({ code, numberLength: nl, playerIndex: pi }) => {
    roomCode = code;
    numberLength = nl;
    playerIndex = pi;
    document.getElementById('waitingRoomCode').textContent = code;
    showScreen('waiting');
    SFX.confirm();
  });

  // Quick match waiting
  socket.on('quickMatchWaiting', ({ code, numberLength: nl }) => {
    roomCode = code;
    numberLength = nl;
    document.getElementById('waitingRoomCode').textContent = code;
    showScreen('waiting');
  });

  // Copy room code
  document.getElementById('btnCopyCode').addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      showToast('Room code copied!', 'success');
      SFX.tap();
    });
  });

  // Room joined (I joined someone's room)
  socket.on('roomJoined', ({ code, numberLength: nl, playerIndex: pi, opponentName: opp }) => {
    roomCode = code;
    numberLength = nl;
    playerIndex = pi;
    opponentName = opp;
    SFX.matchFound();
    showToast(`Matched with ${opp}!`, 'success');
  });

  // Opponent joined my room
  socket.on('opponentJoined', ({ opponentName: opp }) => {
    opponentName = opp;
    SFX.matchFound();
    showToast(`${opp} joined the game!`, 'success');
  });

  // Phase change
  socket.on('phaseChange', ({ phase, numberLength: nl }) => {
    if (nl) numberLength = nl;
    if (phase === 'setup') {
      secretDigits = [];
      showScreen('setup');
      document.getElementById('setupNumLength').textContent = numberLength;
      renderSecretDigits();
      resetNumpad('numpad');
      document.getElementById('opponentStatus').textContent = 'Waiting for opponent to set their number…';
    } else if (phase === 'playing') {
      myGuesses = [];
      opponentGuesses = [];
      guessDigits = [];
      showScreen('game');
      document.getElementById('yourNameBadge').textContent = myName;
      document.getElementById('oppNameBadge').textContent = opponentName;
      renderGuessDigits();
      renderHistory();
      resetNumpad('guessNumpad');
    }
  });

  // Secret set
  socket.on('secretSet', () => {
    showToast('Secret number locked! 🔒', 'success');
    document.getElementById('opponentStatus').textContent = 'Your number is set! Waiting for opponent…';
    // Disable numpad
    document.querySelectorAll('#numpad .numpad-btn').forEach(btn => btn.classList.add('disabled'));
  });

  // Opponent ready
  socket.on('opponentReady', () => {
    document.getElementById('opponentStatus').textContent = '✅ Opponent is ready!';
  });

  // Turn update
  socket.on('turnUpdate', ({ currentTurn, currentTurnSocketId }) => {
    isMyTurn = (currentTurnSocketId === mySocketId);
    updateTurnUI();
    if (isMyTurn) {
      SFX.yourTurn();
    }
  });

  // Guess result
  socket.on('guessResult', ({ playerName, playerSocketId, guess, correctDigit, correctPosition, guessNumber }) => {
    const entry = { guess, correctDigit, correctPosition };
    if (playerSocketId === mySocketId) {
      myGuesses.push(entry);
    } else {
      opponentGuesses.push(entry);
      SFX.opponentGuess();
    }
    renderHistory();
  });

  // Game over
  socket.on('gameOver', ({ winner, winnerSocketId, secrets, totalGuesses, stats }) => {
    const iWon = winnerSocketId === mySocketId;
    showScreen('gameover');

    document.getElementById('gameoverIcon').textContent = iWon ? '🏆' : '😔';
    document.getElementById('gameoverTitle').textContent = iWon ? 'You Win!' : 'You Lose!';
    document.getElementById('gameoverSubtitle').textContent = iWon
      ? 'Congratulations! You cracked the code! 🎉'
      : `${winner} cracked your code first!`;

    // Show secrets
    const names = Object.keys(secrets);
    const myIdx = names.indexOf(myName);
    const oppIdx = myIdx === 0 ? 1 : 0;
    document.getElementById('secretLabel1').textContent = 'Your Number';
    document.getElementById('secretValue1').textContent = secrets[names[myIdx]] || secrets[names[0]];
    document.getElementById('secretLabel2').textContent = `${opponentName}'s Number`;
    document.getElementById('secretValue2').textContent = secrets[names[oppIdx]] || secrets[names[1]];

    const gNames = Object.keys(totalGuesses);
    const myGIdx = gNames.indexOf(myName);
    const oppGIdx = myGIdx === 0 ? 1 : 0;
    document.getElementById('statYourGuesses').textContent = totalGuesses[gNames[myGIdx]] || totalGuesses[gNames[0]];
    document.getElementById('statOppGuesses').textContent = totalGuesses[gNames[oppGIdx]] || totalGuesses[gNames[1]];

    // Show post-game stats
    if (stats && stats[myName]) {
      const s = stats[myName];
      document.getElementById('pgGames').textContent = s.gamesPlayed;
      document.getElementById('pgWins').textContent = s.wins;
      document.getElementById('pgWinRate').textContent = s.winRate + '%';
      document.getElementById('pgStreak').textContent = s.winStreak;
    }

    if (iWon) {
      SFX.win();
      spawnConfetti();
    } else {
      SFX.lose();
    }
  });

  // Game reset
  socket.on('gameReset', () => {
    myGuesses = [];
    opponentGuesses = [];
    secretDigits = [];
    guessDigits = [];
    Chat.reset();
  });

  // Error
  socket.on('error', ({ message }) => {
    showToast(message, 'error');
    SFX.error();
  });

  // Opponent disconnected
  socket.on('opponentDisconnected', () => {
    showToast('Opponent disconnected! 😢', 'error');
    SFX.error();
    setTimeout(() => location.reload(), 2500);
  });

  // ─── CONFETTI ──────────────────────────────────────────────
  function spawnConfetti() {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';
    const colors = ['#6C5CE7', '#fd79a8', '#fdcb6e', '#00cec9', '#00b894', '#e17055', '#a29bfe'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 2 + 's';
      piece.style.animationDuration = (2 + Math.random() * 2) + 's';
      piece.style.width = (6 + Math.random() * 6) + 'px';
      piece.style.height = (6 + Math.random() * 6) + 'px';
      container.appendChild(piece);
    }
  }

  // ─── PARTICLES BACKGROUND ─────────────────────────────────
  function initParticles() {
    const canvas = document.getElementById('particlesCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 50;
    const colors = ['rgba(108,92,231,0.3)', 'rgba(253,121,168,0.2)', 'rgba(0,206,201,0.2)', 'rgba(253,203,110,0.15)'];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 3 + 1;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.alpha = Math.random() * 0.5 + 0.1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(108, 92, 231, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(animate);
    }
    animate();
  }

  // ─── STATS FETCHING ──────────────────────────────────────
  function fetchMyStats(name) {
    fetch(`/api/stats/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(stats => {
        const preview = document.getElementById('statsPreview');
        if (stats.gamesPlayed > 0) {
          preview.classList.remove('hidden');
          document.getElementById('spGames').textContent = stats.gamesPlayed;
          document.getElementById('spWins').textContent = stats.wins;
          document.getElementById('spLosses').textContent = stats.losses;
          document.getElementById('spWinRate').textContent = stats.winRate + '%';
          document.getElementById('spStreak').textContent = stats.winStreak;
          document.getElementById('spBest').textContent = stats.bestStreak;
        } else {
          preview.classList.add('hidden');
        }
      })
      .catch(() => {});
  }

  // ─── ONLINE COUNT ───────────────────────────────────────
  function fetchOnlineCount() {
    fetch('/api/online')
      .then(r => r.json())
      .then(data => {
        document.getElementById('onlineCount').textContent = data.online || 0;
      })
      .catch(() => {});
    // Refresh every 15 seconds
    setInterval(() => {
      fetch('/api/online')
        .then(r => r.json())
        .then(data => {
          document.getElementById('onlineCount').textContent = data.online || 0;
        })
        .catch(() => {});
    }, 15000);
  }

  // ─── SOUND TOGGLE ───────────────────────────────────────
  function bindSoundToggle() {
    const btn = document.getElementById('soundToggle');
    // Restore from localStorage
    const saved = localStorage.getItem('soundMuted');
    if (saved === 'true') {
      SFX.setMuted(true);
      btn.textContent = '🔇';
      btn.classList.add('muted');
    }
    btn.addEventListener('click', () => {
      const nowMuted = SFX.toggleMute();
      btn.textContent = nowMuted ? '🔇' : '🔊';
      btn.classList.toggle('muted', nowMuted);
      localStorage.setItem('soundMuted', nowMuted);
      if (!nowMuted) SFX.tap();
    });
  }

  // ─── LEADERBOARD ────────────────────────────────────────
  function bindLeaderboard() {
    document.getElementById('btnLeaderboard').addEventListener('click', () => {
      SFX.tap();
      openLeaderboard();
    });
    document.getElementById('btnCloseLeaderboard').addEventListener('click', () => {
      SFX.tap();
      document.getElementById('leaderboardModal').classList.add('hidden');
    });
    document.getElementById('leaderboardModal').addEventListener('click', (e) => {
      if (e.target.id === 'leaderboardModal') {
        document.getElementById('leaderboardModal').classList.add('hidden');
      }
    });
  }

  function openLeaderboard() {
    const modal = document.getElementById('leaderboardModal');
    modal.classList.remove('hidden');
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '<p class="hint-text">Loading…</p>';

    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(entries => {
        if (entries.length === 0) {
          list.innerHTML = '<p class="lb-empty">No games played yet. Be the first! 🎮</p>';
          return;
        }
        list.innerHTML = '';
        entries.forEach((e, idx) => {
          const rank = idx + 1;
          const medals = ['🥇', '🥈', '🥉'];
          const rankText = rank <= 3 ? medals[rank - 1] : rank;
          const rankClass = rank <= 3 ? ` lb-rank-${rank}` : '';
          const div = document.createElement('div');
          div.className = 'lb-entry';
          div.innerHTML = `
            <span class="lb-rank${rankClass}">${rankText}</span>
            <span class="lb-name">${escapeHTML(e.name)}</span>
            <div class="lb-stats">
              <span><span class="lb-stat-val">${e.wins}</span> W</span>
              <span><span class="lb-stat-val">${e.winRate}%</span> WR</span>
              <span><span class="lb-stat-val">${e.gamesPlayed}</span> GP</span>
            </div>
          `;
          list.appendChild(div);
        });
      })
      .catch(() => {
        list.innerHTML = '<p class="lb-empty">Failed to load leaderboard.</p>';
      });
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── CONNECTION STATUS ─────────────────────────────────
  function bindConnectionStatus() {
    // Create connection bar
    const bar = document.createElement('div');
    bar.className = 'connection-bar';
    bar.id = 'connectionBar';
    bar.textContent = '⚠️ Connection lost. Reconnecting…';
    document.body.appendChild(bar);

    socket.on('disconnect', () => {
      bar.classList.add('show');
    });
    socket.on('connect', () => {
      bar.classList.remove('show');
    });
  }

})();
