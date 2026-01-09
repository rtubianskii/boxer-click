const tg = window.Telegram?.WebApp;

let score = 0;
let punchPower = 1;

const BOXER_IDLE_SRC = "assets/boxer_idle.png";
const BOXER_PUNCH_SRC = "assets/boxer_punch.png";
const BAG_SRC = "assets/bag.png";
const BG_SRC = "assets/bg.jpg"; // если фон bg.png — поменяй

function preloadImages(urls) {
  urls.forEach((u) => {
    const img = new Image();
    img.src = u;
  });
}

preloadImages([BOXER_IDLE_SRC, BOXER_PUNCH_SRC, BAG_SRC, BG_SRC]);

if (tg) {
  tg.ready();
  tg.expand();
}

const scoreEl = document.getElementById("score");
const boxerEl = document.getElementById("boxer");
const bagEl = document.getElementById("bag");
const fxLayer = document.getElementById("fxLayer");
const punchButton = document.getElementById("punchButton"); // может быть null

// NEW: элементы для эффектов (могут быть null, если ещё не добавил wrapper)
const sceneEl = document.querySelector(".boxer-area");
const bagWrapEl = document.getElementById("bagWrap");

function updateScore() {
  scoreEl.textContent = String(score);

  scoreEl.classList.remove("bump");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("bump");
}

function haptic(type = "light") {
  const hf = tg?.HapticFeedback;
  if (!hf) return;
  if (type === "selection") hf.selectionChanged();
  else hf.impactOccurred(type);
}

function animatePunch() {
  if (boxerEl) boxerEl.src = BOXER_PUNCH_SRC;

  // shake камеры
  if (sceneEl) {
    sceneEl.classList.remove("shake");
    void sceneEl.offsetWidth;
    sceneEl.classList.add("shake");
  }

  // squash груши (если есть wrapper)
  if (bagWrapEl) {
    bagWrapEl.classList.remove("squash");
    void bagWrapEl.offsetWidth;
    bagWrapEl.classList.add("squash");
  }

  // отдача груши (на img)
  if (bagEl) {
    bagEl.classList.remove("bag-hit");
    void bagEl.offsetWidth;
    bagEl.classList.add("bag-hit");
  }

  setTimeout(() => {
    if (boxerEl) boxerEl.src = BOXER_IDLE_SRC;
  }, 150);
}

function spawnFloatingPoints(points) {
  if (!fxLayer || !bagEl) return;

  const bagRect = bagEl.getBoundingClientRect();
  const fxRect = fxLayer.getBoundingClientRect();

  const x = (bagRect.left + bagRect.width * 0.55) - fxRect.left;
  const y = (bagRect.top + bagRect.height * 0.35) - fxRect.top;

  const el = document.createElement("div");
  el.className = "floating-points";
  el.textContent = `+${points}`;

  const jitterX = (Math.random() * 16) - 8;
  const jitterY = (Math.random() * 10) - 5;

  el.style.left = `${x + jitterX}px`;
  el.style.top = `${y + jitterY}px`;

  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

function onPunch() {
  score += punchPower;
  updateScore();
  animatePunch();
  spawnFloatingPoints(punchPower);
  haptic("light");
}

// Клик по груше: если есть wrapper — кликаем по нему, иначе по img
const bagClickTarget = bagWrapEl || bagEl;

if (!bagClickTarget) {
  console.error("Не найден элемент груши (#bagWrap или #bag) — проверь HTML");
} else {
  bagClickTarget.addEventListener("click", onPunch);
  console.log("OK: bag click handler attached");
}

// Кнопка опционально
if (punchButton) {
  punchButton.addEventListener("click", onPunch);
}

if (tg) {
  console.log("Telegram WebApp init data:", tg.initDataUnsafe);
}
