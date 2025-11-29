// ========================================================
// ROKET KRIBO – FULL GAME WITH ONLINE LEADERBOARD
// ========================================================

// ================== KONFIGURASI API LEADERBOARD ==================
const API_URL =
  "https://script.google.com/macros/s/AKfycbzU6eZe0uNDjylpI_vWkF2dqVxNYTzfDJBBG6HOZctIFwQr5cL5A7QzyUV-HKYDCE66Ug/exec";

// ================== CANVAS SETUP ==================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 🔥 penting: stars dideklarasikan SEBELUM createStars dipanggil
let stars = []; // array bintang background

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  createStars();
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ================== DOM ELEMENTS ==================
const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");

const mainMenu = document.getElementById("mainMenu");
const nicknameInput = document.getElementById("nicknameInput");
const startBtn = document.getElementById("startBtn");
const leaderboardBody = document.getElementById("leaderboardBody");

const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreEl = document.getElementById("finalScore");
const finalNicknameEl = document.getElementById("finalNickname");
const retryBtn = document.getElementById("retryBtn");
const backMenuBtn = document.getElementById("backMenuBtn");

// ================== AUDIO ==================
let sfxJump = new Audio("assets/sfx/jump_cartoon.wav");
let sfxScore = new Audio("assets/sfx/score_cartoon.wav");
let sfxHit = new Audio("assets/sfx/hit_cartoon.wav");
let bgMusic = new Audio("assets/music/piano.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.5;

function safePlay(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// ================== GAME STATE ==================
let gameState = "menu"; // "menu" | "playing" | "gameover"
let currentNickname = "Player";

let rocket;
let meteors = [];
let score = 0;
let bestScore = 0;
let frame = 0;

let baseGravity = 0.4;
let gravity = baseGravity;
let jumpPower = -8;
let baseMeteorSpeed = 4;
let meteorSpeed = baseMeteorSpeed;
let meteorSpawnCounter = 0;

// ================== BACKGROUND: STARS & EARTH ==================
function createStars() {
  stars = [];
  const count = Math.floor((canvas.width + canvas.height) / 15);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.7 + 0.3,
      flickerSpeed: Math.random() * 0.02 + 0.005,
      flickerDir: Math.random() < 0.5 ? -1 : 1,
    });
  }
}

function drawStars() {
  stars.forEach((s) => {
    s.alpha += s.flickerDir * s.flickerSpeed;
    if (s.alpha > 1) {
      s.alpha = 1;
      s.flickerDir = -1;
    } else if (s.alpha < 0.2) {
      s.alpha = 0.2;
      s.flickerDir = 1;
    }

    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawEarth() {
  const r = Math.min(canvas.width, canvas.height) * 0.2;
  const x = canvas.width - r - 40;
  const y = canvas.height - r + 10;

  const grad = ctx.createRadialGradient(
    x - r * 0.3,
    y - r * 0.4,
    r * 0.2,
    x,
    y,
    r
  );
  grad.addColorStop(0, "#a8e4ff");
  grad.addColorStop(0.4, "#42b3ff");
  grad.addColorStop(0.8, "#0060a8");
  grad.addColorStop(1, "#00213f");

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  const glowGrad = ctx.createRadialGradient(
    x,
    y,
    r * 0.85,
    x,
    y,
    r * 1.2
  );
  glowGrad.addColorStop(0, "rgba(180,230,255,0.9)");
  glowGrad.addColorStop(1, "rgba(180,230,255,0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
  ctx.fill();
}

// ================== LEADERBOARD ONLINE ==================
function formatDateTime(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

async function fetchLeaderboard() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Fetch leaderboard error:", e);
    return [];
  }
}

async function sendScore(nick, score) {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, score }),
    });
  } catch (e) {
    console.error("Send score error:", e);
  }
}

function renderLeaderboard(list) {
  if (!leaderboardBody) return;
  leaderboardBody.innerHTML = "";
  list.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.nick}</td>
      <td>${entry.score}</td>
      <td>${formatDateTime(entry.time)}</td>
    `;
    leaderboardBody.appendChild(tr);
  });
}

async function refreshLeaderboard() {
  const list = await fetchLeaderboard();
  renderLeaderboard(list);
  if (list.length) {
    bestScore = list[0].score;
    if (bestScoreEl) bestScoreEl.textContent = bestScore;
  }
}

// panggil sekali di awal
refreshLeaderboard();

// ================== ROKET ==================
function initRocket() {
  rocket = {
    x: canvas.width * 0.22,
    y: canvas.height / 2,
    width: 60,
    height: 30,
    flameLength: 20,
    color: "white",
    velocity: 0,
  };
}

function updateRocketColor() {
  if (score >= 600) rocket.color = "#800000";
  else if (score >= 500) rocket.color = "purple";
  else if (score >= 400) rocket.color = "yellow";
  else if (score >= 300) rocket.color = "blue";
  else if (score >= 200) rocket.color = "green";
  else if (score >= 100) rocket.color = "orange";
  else rocket.color = "white";
}

function updateFlameLength() {
  rocket.flameLength = 20 + Math.floor(score / 50) * 5;
}

function updateSpeedByScore() {
  const level = Math.floor(score / 50);
  gravity = baseGravity + level * 0.05;
  meteorSpeed = baseMeteorSpeed + level * 0.3;
}

function drawRocket() {
  ctx.save();

  const cx = rocket.x + rocket.width / 2;
  const cy = rocket.y + rocket.height / 2;

  ctx.translate(cx, cy);

  const bodyW = 60;
  const bodyH = 28;
  const x = -bodyW / 2;
  const y = -bodyH / 2;
  const radius = 14;

  // badan roket putih
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + bodyW - radius, y);
  ctx.quadraticCurveTo(x + bodyW, y, x + bodyW, y + radius);
  ctx.lineTo(x + bodyW, y + bodyH - radius);
  ctx.quadraticCurveTo(
    x + bodyW,
    y + bodyH,
    x + bodyW - radius,
    y + bodyH
  );
  ctx.lineTo(x + radius, y + bodyH);
  ctx.quadraticCurveTo(x, y + bodyH, x, y + bodyH - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // hidung merah (ke kanan)
  ctx.fillStyle = "#ff5252";
  ctx.beginPath();
  ctx.moveTo(x + bodyW / 2 + 4, y);
  ctx.lineTo(x + bodyW / 2 + 22, 0);
  ctx.lineTo(x + bodyW / 2 + 4, y + bodyH);
  ctx.closePath();
  ctx.fill();

  // sabuk merah
  ctx.fillRect(x + bodyW * 0.05, y + bodyH * 0.35, bodyW * 0.4, bodyH * 0.3);

  // sirip bawah
  ctx.beginPath();
  ctx.moveTo(x - 4, y + bodyH * 0.2);
  ctx.lineTo(x - 20, y + bodyH * 0.5);
  ctx.lineTo(x - 4, y + bodyH * 0.8);
  ctx.closePath();
  ctx.fill();

  // sirip atas
  ctx.beginPath();
  ctx.moveTo(x + bodyW * 0.1, y - 6);
  ctx.lineTo(x - 4, y - 18);
  ctx.lineTo(x + bodyW * 0.25, y - 2);
  ctx.closePath();
  ctx.fill();

  // jendela
  const windowX = x + bodyW * 0.25;
  const windowY = y + bodyH * 0.5;
  ctx.fillStyle = "#2b3b8f";
  ctx.beginPath();
  ctx.arc(windowX, windowY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#66d9ff";
  ctx.beginPath();
  ctx.arc(windowX - 3, windowY - 3, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(windowX + 2, windowY + 2, 2, 0, Math.PI * 2);
  ctx.fill();

  // api belakang
  const flameLen = rocket.flameLength;
  const flameBaseX = x - 6;
  const flameCenterY = y + bodyH * 0.5;

  const gradFlame = ctx.createLinearGradient(
    flameBaseX - flameLen,
    flameCenterY,
    flameBaseX,
    flameCenterY
  );
  gradFlame.addColorStop(0, "#ff9800");
  gradFlame.addColorStop(0.6, "#ffeb3b");
  gradFlame.addColorStop(1, "rgba(255,255,255,0.9)");

  ctx.fillStyle = gradFlame;
  ctx.beginPath();
  ctx.moveTo(flameBaseX, flameCenterY - 8);
  ctx.lineTo(flameBaseX - flameLen, flameCenterY);
  ctx.lineTo(flameBaseX, flameCenterY + 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ================== METEOR (LUBANG TERJAMIN) ==================
function createMeteorColumn(gapCount, gapHeight) {
  const x = canvas.width;
  const usableTop = 40;
  const usableBottom = canvas.height - 40 - gapHeight;

  const gaps = [];
  const minDistance = gapHeight * 1.1;

  while (gaps.length < gapCount) {
    const g = usableTop + Math.random() * (usableBottom - usableTop);
    if (gaps.every((existing) => Math.abs(existing - g) > minDistance)) {
      gaps.push(g);
    }
  }
  gaps.sort((a, b) => a - b);

  const segments = [];
  let startY = 0;

  for (let i = 0; i < gaps.length; i++) {
    const gy = gaps[i];
    if (gy - startY > 5) {
      segments.push({ y: startY, h: gy - startY });
    }
    startY = gy + gapHeight;
  }

  if (canvas.height - startY > 5) {
    segments.push({ y: startY, h: canvas.height - startY });
  }

  segments.forEach((seg, index) => {
    meteors.push({
      x,
      y: seg.y,
      width: 60,
      height: seg.h,
      scoreTrigger: index === 0,
      passed: false,
    });
  });
}

function spawnMeteors() {
  const spawnInterval = 70;
  if (frame % spawnInterval !== 0) return;

  meteorSpawnCounter++;
  const gapHeight = canvas.height * 0.22;
  const gapCount = meteorSpawnCounter % 7 === 0 ? 2 : 1;

  createMeteorColumn(gapCount, gapHeight);
}

function drawMeteors() {
  meteors.forEach((m) => {
    const gradient = ctx.createLinearGradient(m.x, m.y, m.x + m.width, m.y);
    gradient.addColorStop(0, "#4a3f3f");
    gradient.addColorStop(0.5, "#b79a7f");
    gradient.addColorStop(1, "#4a3f3f");

    ctx.fillStyle = gradient;
    ctx.fillRect(m.x, m.y, m.width, m.height);

    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m.x + m.width * 0.3, m.y + 5);
    ctx.lineTo(m.x + m.width * 0.4, m.y + m.height - 5);
    ctx.stroke();
  });
}

function updateMeteors() {
  meteors.forEach((m) => {
    m.x -= meteorSpeed;

    // tabrakan
    if (
      rocket.x < m.x + m.width &&
      rocket.x + rocket.width > m.x &&
      rocket.y < m.y + m.height &&
      rocket.y + rocket.height > m.y
    ) {
      gameOver();
    }

    // skor (1 poin per kolom)
    if (m.scoreTrigger && !m.passed && m.x + m.width < rocket.x) {
      m.passed = true;
      score++;
      if (scoreEl) scoreEl.textContent = score;
      safePlay(sfxScore);
    }
  });

  meteors = meteors.filter((m) => m.x + m.width > 0);
}

// ================== FISIKA ROKET ==================
function updateRocket() {
  rocket.velocity += gravity;
  rocket.y += rocket.velocity;

  if (rocket.y + rocket.height > canvas.height || rocket.y < 0) {
    gameOver();
  }
}

// ================== INPUT CONTROL ==================
function handleJump() {
  if (gameState !== "playing") return;
  rocket.velocity = jumpPower;
  safePlay(sfxJump);
}

window.addEventListener("touchstart", handleJump);
window.addEventListener("mousedown", handleJump);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});

// ================== GAME CONTROL ==================
function resetGame() {
  initRocket();
  meteors = [];
  score = 0;
  frame = 0;
  meteorSpawnCounter = 0;

  gravity = baseGravity;
  meteorSpeed = baseMeteorSpeed;

  if (scoreEl) scoreEl.textContent = score;
}

function startGame() {
  const nick = (nicknameInput?.value || "").trim();
  currentNickname = nick || "Player";

  mainMenu.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  hud.classList.remove("hidden");

  resetGame();
  gameState = "playing";

  bgMusic.currentTime = 0;
  bgMusic.play().catch(() => {});
}

async function gameOver() {
  if (gameState !== "playing") return;
  gameState = "gameover";

  safePlay(sfxHit);
  bgMusic.pause();

  if (finalScoreEl) finalScoreEl.textContent = score;
  if (finalNicknameEl) finalNicknameEl.textContent = currentNickname;

  // kirim skor ke server & refresh leaderboard
  sendScore(currentNickname, score)
    .then(refreshLeaderboard)
    .catch((e) => console.error(e));

  hud.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");
}

// ================== BUTTON EVENTS ==================
startBtn?.addEventListener("click", startGame);
retryBtn?.addEventListener("click", startGame);
backMenuBtn?.addEventListener("click", () => {
  gameState = "menu";
  gameOverScreen.classList.add("hidden");
  hud.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  bgMusic.pause();
});

// ================== GAME LOOP ==================
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  frame++;

  drawStars();
  drawEarth();

  if (gameState === "playing") {
    updateSpeedByScore();
    updateRocketColor();
    updateFlameLength();

    updateRocket();
    spawnMeteors();
    updateMeteors();
    drawRocket();
    drawMeteors();
  } else {
    // menu atau gameover: roket diam sebagai dekorasi
    updateRocketColor();
    updateFlameLength();
    drawRocket();
  }

  requestAnimationFrame(gameLoop);
}

// ================== START ==================
initRocket();
resetGame();
gameLoop();
