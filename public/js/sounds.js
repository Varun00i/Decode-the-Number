/* ═══════════════════════════════════════════════════════════════
   DECODE THE NUMBER — SOUND EFFECTS MODULE
   Interactive tap & joy sounds using Web Audio API (no files needed)
   ═══════════════════════════════════════════════════════════════ */

const SFX = (() => {
  let audioCtx = null;
  let muted = false;

  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function isMuted() { return muted; }
  function setMuted(val) { muted = val; }
  function toggleMute() { muted = !muted; return muted; }

  // ── Generic beep helper ──
  function beep(freq, duration, type = 'sine', volume = 0.15) {
    if (muted) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // ── TAP / BUTTON PRESS ──
  function tap() {
    beep(800, 0.08, 'sine', 0.12);
  }

  // ── DIGIT INPUT ──
  function digitInput() {
    beep(600 + Math.random() * 200, 0.06, 'triangle', 0.1);
  }

  // ── DELETE ──
  function digitDelete() {
    beep(300, 0.08, 'sawtooth', 0.06);
  }

  // ── CONFIRM / SUBMIT ──
  function confirm() {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.12, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    });
  }

  // ── GUESS SUBMITTED ──
  function guessSubmit() {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    [440, 554, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.1, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    });
  }

  // ── OPPONENT GUESS (notification) ──
  function opponentGuess() {
    beep(500, 0.12, 'sine', 0.08);
    setTimeout(() => beep(600, 0.12, 'sine', 0.08), 100);
  }

  // ── YOUR TURN ──
  function yourTurn() {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    [392, 523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.1, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.2);
    });
  }

  // ── WIN ──
  function win() {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const melody = [523, 587, 659, 784, 880, 1047];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.14, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }

  // ── LOSE ──
  function lose() {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const melody = [400, 350, 300, 250];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.1, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });
  }

  // ── CHAT MESSAGE ──
  function chatMsg() {
    beep(880, 0.06, 'sine', 0.06);
    setTimeout(() => beep(1100, 0.06, 'sine', 0.06), 60);
  }

  // ── ERROR ──
  function error() {
    beep(200, 0.15, 'square', 0.08);
    setTimeout(() => beep(180, 0.15, 'square', 0.08), 120);
  }

  // ── MATCH FOUND ──
  function matchFound() {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.12, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.25);
    });
  }

  return {
    tap,
    digitInput,
    digitDelete,
    confirm,
    guessSubmit,
    opponentGuess,
    yourTurn,
    win,
    lose,
    chatMsg,
    error,
    matchFound,
    isMuted,
    setMuted,
    toggleMute
  };
})();
