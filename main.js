const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

let score = 0;
let punchPower = 1;

const BOXER_IDLE_SRC = "boxer_idle.png";
const BOXER_PUNCH_SRC = "boxer_punch.png";

const scoreEl = document.getElementById("score");
const bagEl = document.getElementById("bag");
const boxerEl = document.getElementById("boxer");
const fxLayer = document.getElementById("fxLayer");

// кнопку можно оставить как запасной вариант
const punchButton = document.getElementById("punchButton");

function updateScore() {
  scoreEl.textContent = String(score);
}

function haptic(type = "light") {
  // Telegram haptics (работает в поддерживаемых клиентах)
  const hf = tg?.HapticFeedback;
  if (!hf) return;

  // impactOccurred: "light" | "medium" | "heavy" | "rigid" | "soft"
  // notificationOccurred: "success" | "warning" | "error"
  // selectionChanged: без параметров
  if (type === "selection") hf.selectionChanged();
  else hf.impactOccurred(type);
}

function animatePunch() {
  boxerEl.src = BOXER_PUNCH_SRC;

  bagEl.classList.remove("bag-hit");
  void bagEl.offsetWidth;
  bagEl.classList.add("bag-hit");

  setTimeout(() => {
    boxerEl.src = BOXER_IDLE_SRC;
  }, 150);
}

function spawnFloatingPoints(points) {
  // координаты груши относительно экрана
  const bagRect = bagEl.getBoundingClientRect();
  const fxRect = fxLayer.getBoundingClientRect();

  // точка появления: примерно по центру груши, чуть выше низа
  const x = (bagRect.left + bagRect.width * 0.55) - fxRect.left;
  const y = (bagRect.top + bagRect.height * 0.35) - fxRect.top;

  const el = document.createElement("div");
  el.className = "floating-points";
  el.textContent = `+${points}`;

  // небольшая случайность, чтобы красиво “сыпалось”
  const jitterX = (Math.random() * 16) - 8; // -8..+8
  const jitterY = (Math.random() * 10) - 5;

  el.style.left = `${x + jitterX}px`;
  el.style.top = `${y + jitterY}px`;

  fxLayer.appendChild(el);

  // удалить после анимации
  setTimeout(() => el.remove(), 650);
}

function onPunch() {
  score += punchPower;
  updateScore();
  animatePunch();
  spawnFloatingPoints(punchPower);
  haptic("light");
}

// Тап по груше
bagEl.addEventListener("click", onPunch);

// Запасной вариант: кнопка (можешь потом убрать)
if (punchButton) punchButton.addEventListener("click", onPunch);

// На мобилках иногда приятнее откликаться на pointerdown
bagEl.addEventListener("pointerdown", (e) => {
  // предотвращаем двойные события на некоторых устройствах
  // если заметишь двойной подсчёт — скажи, подстроим
});

if (tg) {
  console.log("Telegram WebApp init data:", tg.initDataUnsafe);
}
