const gameArea = document.getElementById("game-area");
const gameTarget = document.getElementById("game-target");
const gameStartBtn = document.getElementById("game-start");
const gameScoreEl = document.getElementById("game-score");
const gameTimeEl = document.getElementById("game-time");
const gameMessage = document.getElementById("game-message");
const rankingList = document.getElementById("game-ranking-list");
const clearRankingBtn = document.getElementById("game-clear-ranking");

const GAME_RANKING_KEY = "compratech_game_ranking_v1";

let gameScore = 0;
let gameTime = 20;
let gameRunning = false;
let moveIntervalId = null;
let timerIntervalId = null;

function loadRanking() {
  try {
    const raw = localStorage.getItem(GAME_RANKING_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRanking(items) {
  localStorage.setItem(GAME_RANKING_KEY, JSON.stringify(items));
}

function renderRanking() {
  const ranking = loadRanking();
  rankingList.innerHTML = "";
  if (!ranking.length) {
    const li = document.createElement("li");
    li.textContent = "Ainda sem pontuacoes.";
    rankingList.appendChild(li);
    return;
  }

  ranking.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${item.score} ponto(s) - ${item.date}`;
    rankingList.appendChild(li);
  });
}

function updateRanking(score) {
  const ranking = loadRanking();
  const stamp = new Date().toLocaleString("pt-BR");
  ranking.push({ score, date: stamp });
  ranking.sort((a, b) => b.score - a.score);
  const top5 = ranking.slice(0, 5);
  saveRanking(top5);
  renderRanking();
}

function moveTarget() {
  const areaRect = gameArea.getBoundingClientRect();
  const targetRect = gameTarget.getBoundingClientRect();
  const maxX = Math.max(0, areaRect.width - targetRect.width - 8);
  const maxY = Math.max(0, areaRect.height - targetRect.height - 8);
  const x = Math.floor(Math.random() * maxX);
  const y = Math.floor(Math.random() * maxY);
  gameTarget.style.left = `${x}px`;
  gameTarget.style.top = `${y}px`;
}

function stopGame() {
  gameRunning = false;
  clearInterval(moveIntervalId);
  clearInterval(timerIntervalId);
  moveIntervalId = null;
  timerIntervalId = null;
  gameStartBtn.disabled = false;
  gameMessage.textContent = `Fim de jogo! Voce fez ${gameScore} ponto(s).`;
  updateRanking(gameScore);
}

function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  gameScore = 0;
  gameTime = 20;
  gameScoreEl.textContent = String(gameScore);
  gameTimeEl.textContent = String(gameTime);
  gameMessage.textContent = "Jogo em andamento...";
  gameStartBtn.disabled = true;
  moveTarget();

  moveIntervalId = setInterval(moveTarget, 650);
  timerIntervalId = setInterval(() => {
    gameTime -= 1;
    gameTimeEl.textContent = String(Math.max(0, gameTime));
    if (gameTime <= 0) stopGame();
  }, 1000);
}

gameTarget?.addEventListener("click", () => {
  if (!gameRunning) return;
  gameScore += 1;
  gameScoreEl.textContent = String(gameScore);
  moveTarget();
});

gameStartBtn?.addEventListener("click", startGame);

clearRankingBtn?.addEventListener("click", () => {
  saveRanking([]);
  renderRanking();
  gameMessage.textContent = "Ranking limpo.";
});

window.addEventListener("resize", () => {
  if (gameRunning) moveTarget();
});

renderRanking();
