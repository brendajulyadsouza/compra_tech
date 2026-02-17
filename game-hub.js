const arcadeCanvas = document.getElementById("arcade-canvas");
const arcadeTitle = document.getElementById("arcade-title");
const arcadeDescription = document.getElementById("arcade-description");
const arcadeStatus = document.getElementById("arcade-status");
const gameButtons = Array.from(document.querySelectorAll(".arcade-game-btn"));

let cleanupFn = null;

function setActive(gameKey) {
  gameButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.game === gameKey);
  });
}

function mountReflex() {
  arcadeTitle.textContent = "Reflexo Turbo";
  arcadeDescription.textContent = "Clique no alvo o maximo que conseguir em 20 segundos.";
  arcadeCanvas.innerHTML = `
    <div class="arcade-row">
      <button class="btn-primary" id="reflex-start" type="button">Iniciar</button>
      <span>Pontos: <strong id="reflex-score">0</strong></span>
      <span>Tempo: <strong id="reflex-time">20</strong>s</span>
    </div>
    <div class="arcade-playfield" id="reflex-field">
      <button class="arcade-target" id="reflex-target" type="button">🎯</button>
    </div>
  `;
  arcadeStatus.textContent = "Clique em iniciar.";

  const startBtn = document.getElementById("reflex-start");
  const scoreEl = document.getElementById("reflex-score");
  const timeEl = document.getElementById("reflex-time");
  const field = document.getElementById("reflex-field");
  const target = document.getElementById("reflex-target");

  let running = false;
  let score = 0;
  let time = 20;
  let moveId = null;
  let timerId = null;

  const move = () => {
    const maxX = Math.max(0, field.clientWidth - target.offsetWidth - 8);
    const maxY = Math.max(0, field.clientHeight - target.offsetHeight - 8);
    target.style.left = `${Math.floor(Math.random() * maxX)}px`;
    target.style.top = `${Math.floor(Math.random() * maxY)}px`;
  };

  const stop = () => {
    running = false;
    clearInterval(moveId);
    clearInterval(timerId);
    startBtn.disabled = false;
    arcadeStatus.textContent = `Fim de jogo: ${score} ponto(s).`;
  };

  startBtn.addEventListener("click", () => {
    if (running) return;
    running = true;
    score = 0;
    time = 20;
    scoreEl.textContent = "0";
    timeEl.textContent = "20";
    arcadeStatus.textContent = "Jogo em andamento...";
    startBtn.disabled = true;
    move();
    moveId = setInterval(move, 650);
    timerId = setInterval(() => {
      time -= 1;
      timeEl.textContent = String(Math.max(0, time));
      if (time <= 0) stop();
    }, 1000);
  });

  target.addEventListener("click", () => {
    if (!running) return;
    score += 1;
    scoreEl.textContent = String(score);
    move();
  });

  return () => {
    clearInterval(moveId);
    clearInterval(timerId);
  };
}

function mountGuess() {
  arcadeTitle.textContent = "Adivinhe o Numero";
  arcadeDescription.textContent = "Descubra o numero secreto de 1 a 50 no menor numero de tentativas.";
  arcadeCanvas.innerHTML = `
    <div class="arcade-row">
      <input id="guess-input" class="arcade-input" type="number" min="1" max="50" placeholder="Digite 1 a 50">
      <button class="btn-primary" id="guess-try" type="button">Tentar</button>
      <button class="btn-secondary" id="guess-reset" type="button">Novo jogo</button>
    </div>
    <p>Tentativas: <strong id="guess-attempts">0</strong></p>
  `;
  arcadeStatus.textContent = "Boa sorte!";

  const input = document.getElementById("guess-input");
  const tryBtn = document.getElementById("guess-try");
  const resetBtn = document.getElementById("guess-reset");
  const attemptsEl = document.getElementById("guess-attempts");

  let secret = Math.floor(Math.random() * 50) + 1;
  let attempts = 0;

  const evaluate = () => {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      arcadeStatus.textContent = "Digite um numero valido de 1 a 50.";
      return;
    }
    attempts += 1;
    attemptsEl.textContent = String(attempts);
    if (value === secret) {
      arcadeStatus.textContent = `Acertou em ${attempts} tentativa(s)!`;
    } else if (value < secret) {
      arcadeStatus.textContent = "Muito baixo.";
    } else {
      arcadeStatus.textContent = "Muito alto.";
    }
  };

  tryBtn.addEventListener("click", evaluate);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") evaluate();
  });
  resetBtn.addEventListener("click", () => {
    secret = Math.floor(Math.random() * 50) + 1;
    attempts = 0;
    attemptsEl.textContent = "0";
    input.value = "";
    arcadeStatus.textContent = "Novo jogo iniciado.";
  });

  return () => {};
}

function mountMemory() {
  arcadeTitle.textContent = "Memoria Flash";
  arcadeDescription.textContent = "Repita a sequencia de cores. Cada rodada aumenta a dificuldade.";
  arcadeCanvas.innerHTML = `
    <div class="arcade-row">
      <button class="btn-primary" id="memory-start" type="button">Iniciar</button>
      <span>Rodada: <strong id="memory-round">0</strong></span>
    </div>
    <div class="memory-grid">
      <button class="memory-pad pad-0" data-pad="0" type="button"></button>
      <button class="memory-pad pad-1" data-pad="1" type="button"></button>
      <button class="memory-pad pad-2" data-pad="2" type="button"></button>
      <button class="memory-pad pad-3" data-pad="3" type="button"></button>
    </div>
  `;
  arcadeStatus.textContent = "Clique em iniciar.";

  const startBtn = document.getElementById("memory-start");
  const roundEl = document.getElementById("memory-round");
  const pads = Array.from(document.querySelectorAll(".memory-pad"));
  let sequence = [];
  let playerIndex = 0;
  let accepting = false;
  let round = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const flash = async (padIndex) => {
    const pad = pads[padIndex];
    pad.classList.add("active");
    await sleep(260);
    pad.classList.remove("active");
    await sleep(120);
  };

  const showSequence = async () => {
    accepting = false;
    for (const item of sequence) {
      await flash(item);
    }
    accepting = true;
    playerIndex = 0;
  };

  const nextRound = async () => {
    round += 1;
    roundEl.textContent = String(round);
    sequence.push(Math.floor(Math.random() * 4));
    arcadeStatus.textContent = "Memorize...";
    await showSequence();
    arcadeStatus.textContent = "Sua vez.";
  };

  startBtn.addEventListener("click", async () => {
    sequence = [];
    round = 0;
    playerIndex = 0;
    arcadeStatus.textContent = "Iniciando...";
    await nextRound();
  });

  pads.forEach((pad) => {
    pad.addEventListener("click", async () => {
      if (!accepting || sequence.length === 0) return;
      const value = Number(pad.dataset.pad);
      await flash(value);
      if (value !== sequence[playerIndex]) {
        accepting = false;
        arcadeStatus.textContent = `Errou. Voce chegou na rodada ${round}.`;
        return;
      }
      playerIndex += 1;
      if (playerIndex === sequence.length) {
        arcadeStatus.textContent = "Boa! Proxima rodada...";
        await sleep(450);
        await nextRound();
      }
    });
  });

  return () => {};
}

function mountGame(gameKey) {
  if (typeof cleanupFn === "function") cleanupFn();
  setActive(gameKey);
  if (gameKey === "guess") cleanupFn = mountGuess();
  else if (gameKey === "memory") cleanupFn = mountMemory();
  else cleanupFn = mountReflex();
}

gameButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mountGame(button.dataset.game || "reflex");
  });
});

mountGame("reflex");
