/**
 * Neural Clash — Tic-Tac-Toe
 * Frontend Game Controller
 * Communicates with Flask via Fetch API
 */

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let board        = Array(9).fill(null);
let gameOver     = false;
let isMyTurn     = true;            // Human goes first
let scores       = { human: 0, ai: 0, draws: 0 };
const SOUNDS     = {};              // Sound effects cache

// ─────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────
const boardEl       = document.getElementById("board");
const turnText      = document.getElementById("turn-text");
const turnDot       = document.querySelector(".turn-dot");
const overlay       = document.getElementById("modal-overlay");
const modalEmoji    = document.getElementById("modal-emoji");
const modalTitle    = document.getElementById("modal-title");
const modalSub      = document.getElementById("modal-sub");
const scoreHuman    = document.getElementById("score-human");
const scoreAI       = document.getElementById("score-ai");
const scoreDraws    = document.getElementById("score-draws");

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  spawnParticles();
  initSounds();
  buildBoard();
  setTurn("human");
});

// ─────────────────────────────────────────────
//  BUILD BOARD
// ─────────────────────────────────────────────
function buildBoard(delay = true) {
  boardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;
    cell.style.animationDelay = delay ? `${i * 0.06}s` : "0s";
    cell.addEventListener("click", () => handleHumanMove(i));
    boardEl.appendChild(cell);
  }
}

// ─────────────────────────────────────────────
//  HANDLE HUMAN MOVE
// ─────────────────────────────────────────────
async function handleHumanMove(index) {
  if (!isMyTurn || gameOver || board[index] !== null) return;

  playSound("click");
  rippleEffect(index);
  isMyTurn = false;
  disableBoard();
  setTurn("thinking");

  try {
    const res  = await fetch("/move", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ cell: index }),
    });
    const data = await res.json();

    if (data.error) {
      console.warn(data.error);
      isMyTurn = true;
      enableBoard();
      setTurn("human");
      return;
    }

    // Render human move immediately
    placeMarker(index, "X");
    board[index] = "X";

    // Small delay, then render AI move
    if (data.ai_cell !== null && data.ai_cell !== undefined) {
      await sleep(520);
      playSound("ai");
      placeMarker(data.ai_cell, "O");
      board[data.ai_cell] = "O";
    }

    scores = data.scores;
    updateScoreboard(data.winner, data.winning_combo);

    if (data.game_over) {
      gameOver = true;
      handleGameOver(data.winner, data.winning_combo);
    } else {
      isMyTurn = true;
      enableBoard();
      setTurn("human");
    }

  } catch (err) {
    console.error("Network error:", err);
    isMyTurn = true;
    enableBoard();
    setTurn("human");
  }
}

// ─────────────────────────────────────────────
//  PLACE MARKER
// ─────────────────────────────────────────────
function placeMarker(index, mark) {
  const cell = boardEl.children[index];
  cell.classList.add("taken");

  const wrapper = document.createElement("div");
  wrapper.className = "mark";

  if (mark === "X") {
    wrapper.innerHTML = `
      <svg viewBox="0 0 100 100">
        <line class="x-line" x1="20" y1="20" x2="80" y2="80"/>
        <line class="x-line" x1="80" y1="20" x2="20" y2="80" style="animation-delay:0.1s"/>
      </svg>`;
  } else {
    wrapper.innerHTML = `
      <svg viewBox="0 0 100 100">
        <circle class="o-circle" cx="50" cy="50" r="32" transform="rotate(-90 50 50)"/>
      </svg>`;
  }

  cell.appendChild(wrapper);
}

// ─────────────────────────────────────────────
//  GAME OVER
// ─────────────────────────────────────────────
function handleGameOver(winner, combo) {
  disableBoard();

  if (combo) {
    combo.forEach(i => boardEl.children[i].classList.add("winner"));
  }

  setTimeout(() => {
    if (winner === "X") {
      playSound("win");
      launchConfetti();
      showModal("🎉", "YOU WIN!", "The AI couldn't stop you!", "cyan");
    } else if (winner === "O") {
      playSound("lose");
      showModal("🤖", "AI WINS", "Minimax is unbeatable...", "magenta");
    } else {
      playSound("draw");
      showModal("🤝", "DRAW!", "A perfect stalemate.", "yellow");
    }
  }, combo ? 700 : 300);
}

// ─────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────
function showModal(emoji, title, sub, color) {
  modalEmoji.textContent   = emoji;
  modalTitle.textContent   = title;
  modalTitle.style.color   = `var(--${color})`;
  modalTitle.style.textShadow = `0 0 20px var(--${color})`;
  modalSub.textContent     = sub;
  overlay.classList.add("active");
}

// ─────────────────────────────────────────────
//  RESET GAME
// ─────────────────────────────────────────────
async function resetGame() {
  overlay.classList.remove("active");
  boardEl.classList.add("resetting");

  await sleep(300);
  await fetch("/reset", { method: "POST" });

  board    = Array(9).fill(null);
  gameOver = false;
  isMyTurn = true;

  await sleep(300);
  boardEl.classList.remove("resetting");
  buildBoard(true);
  setTurn("human");
}

// ─────────────────────────────────────────────
//  CLEAR DATA
// ─────────────────────────────────────────────
async function clearData() {
  if (!confirm("Are you sure you want to clear all scores? This cannot be undone.")) {
    return;
  }

  try {
    await fetch("/clear", { method: "POST" });
    
    // Reset scores
    scores = { human: 0, ai: 0, draws: 0 };
    updateScoreboard();

    // Reset board
    board    = Array(9).fill(null);
    gameOver = false;
    isMyTurn = true;
    
    overlay.classList.remove("active");
    buildBoard(false);
    setTurn("human");
    
    console.log("Data cleared successfully!");
  } catch (err) {
    console.error("Error clearing data:", err);
    alert("Failed to clear data. Please try again.");
  }
}

// ─────────────────────────────────────────────
//  TURN INDICATOR
// ─────────────────────────────────────────────
function setTurn(state) {
  turnDot.className = "turn-dot";
  if (state === "human") {
    turnDot.classList.add("");          // default cyan blink
    turnText.textContent = "Your Turn — Play X";
  } else if (state === "ai") {
    turnDot.classList.add("ai");
    turnText.textContent = "AI is playing...";
  } else if (state === "thinking") {
    turnDot.classList.add("think");
    turnText.textContent = "AI is thinking...";
  }
}

// ─────────────────────────────────────────────
//  SCOREBOARD
// ─────────────────────────────────────────────
function updateScoreboard(winner, combo) {
  scoreHuman.textContent = scores.human;
  scoreAI.textContent    = scores.ai;
  scoreDraws.textContent = scores.draws;

  if (winner === "X") bumpScore(".human-card");
  else if (winner === "O") bumpScore(".ai-card");
  else if (winner === "draw") bumpScore(".draw-card");
}

function bumpScore(selector) {
  const el = document.querySelector(selector);
  el.classList.remove("score-bump");
  void el.offsetWidth;            // reflow trick
  el.classList.add("score-bump");
}

// ─────────────────────────────────────────────
//  BOARD ENABLE / DISABLE
// ─────────────────────────────────────────────
function disableBoard() {
  [...boardEl.children].forEach(c => c.classList.add("disabled"));
}
function enableBoard() {
  [...boardEl.children].forEach(c => {
    if (!c.classList.contains("taken")) c.classList.remove("disabled");
  });
}

// ─────────────────────────────────────────────
//  RIPPLE EFFECT
// ─────────────────────────────────────────────
function rippleEffect(index) {
  const cell = boardEl.children[index];
  const r = document.createElement("div");
  r.className = "ripple";
  r.style.cssText = `
    width: 40px; height: 40px;
    background: rgba(0,245,255,0.25);
    top: 50%; left: 50%;
    margin: -20px 0 0 -20px;
  `;
  cell.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

// ─────────────────────────────────────────────
//  SOUND EFFECTS (Web Audio API — no files needed)
// ─────────────────────────────────────────────
let audioCtx = null;

function initSounds() {
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { audioCtx = null; }
}

function resumeAudio() {
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, type = "sine", duration = 0.12, vol = 0.15, delay = 0) {
  if (!audioCtx) return;
  resumeAudio();
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type      = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration + 0.01);
}

function playSound(type) {
  switch (type) {
    case "click":
      playTone(600, "sine",     0.08, 0.1);
      playTone(900, "sine",     0.06, 0.08, 0.05);
      break;
    case "ai":
      playTone(300, "sawtooth", 0.08, 0.08);
      playTone(450, "sawtooth", 0.07, 0.07, 0.06);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.18, 0.15, i * 0.12));
      break;
    case "lose":
      [400, 350, 280].forEach((f, i) => playTone(f, "sawtooth", 0.2, 0.12, i * 0.12));
      break;
    case "draw":
      playTone(440, "triangle", 0.2, 0.1);
      playTone(440, "triangle", 0.2, 0.1, 0.2);
      break;
  }
}

// ─────────────────────────────────────────────
//  CONFETTI (canvas-based)
// ─────────────────────────────────────────────
function launchConfetti() {
  const canvas  = document.getElementById("confetti-canvas");
  const ctx     = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#00f5ff","#ff00aa","#ffe600","#00ff9d","#ffffff"];
  const pieces = Array.from({ length: 120 }, () => ({
    x:    Math.random() * canvas.width,
    y:    -20,
    r:    Math.random() * 6 + 3,
    d:    Math.random() * 4 + 2,
    col:  colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 5,
    tiltAngle: 0,
    tiltAngleIncrement: Math.random() * 0.07 + 0.05,
  }));

  let frame = 0;
  const max = 160;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.tiltAngle += p.tiltAngleIncrement;
      p.y += p.d;
      p.x += Math.sin(frame / 20) * 1.5;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      ctx.beginPath();
      ctx.lineWidth  = p.r;
      ctx.strokeStyle = p.col;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();
    });
    frame++;
    if (frame < max) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ─────────────────────────────────────────────
//  AMBIENT PARTICLES
// ─────────────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById("particles");
  const colors    = ["#00f5ff","#ff00aa","#ffe600","#00ff9d"];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size  = Math.random() * 3 + 1;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 12 + 8}s;
      animation-delay: ${Math.random() * 10}s;
      box-shadow: 0 0 ${size * 3}px currentColor;
    `;
    container.appendChild(p);
  }
}

// ─────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }