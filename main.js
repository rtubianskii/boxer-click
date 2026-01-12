// main.js — версия с "Колесом фортуны" для розыгрыша
// ✅ кликер (боксёр + груша)
// ✅ сохранение очков
// ✅ вкладки Игра / Задания
// ✅ ежедневный бонус (24ч) + бейдж "ДОСТУПНО"
// ✅ подписка (быстрый вариант без сервера)
// ✅ билеты: 1 за каждые 1000 очков
// ✅ колесо фортуны (canvas) — списывает 1 билет и выдаёт приз + история

const tg = window.Telegram?.WebApp;

/* =========================
   STATE
========================= */
let score = 0;
const punchPower = 1;

/* =========================
   ASSETS
========================= */
const BOXER_IDLE_SRC = "assets/boxer_idle.png";
const BOXER_PUNCH_SRC = "assets/boxer_punch.png";
const BAG_SRC = "assets/bag.png";
const BG_SRC = "assets/bg.jpg";

/* =========================
   STORAGE KEYS
========================= */
const STATE_KEY = "boxer_clicker_state_v4";   // score
const TASKS_KEY = "boxer_clicker_tasks_v4";   // tasks + raffle tickets used
const PRIZES_KEY = "boxer_clicker_prizes_v2"; // prize history
const LAST_PAGE_KEY = "boxer_clicker_page";

/* =========================
   CONFIG
========================= */
const CHANNEL_USERNAME = "your_channel_username"; // <-- ЗАМЕНИ (без @)
const SUB_TASK_REWARD = 100;

const DAILY_REWARD = 250;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

const RAFFLE_STEP = 1000; // 1 билет за каждые 1000 очков

/* =========================
   TASKS/PRIZES STATE
========================= */
let tasksState = {
  subClaimed: false,
  lastDailyAt: 0,          // ms timestamp
  raffleClaimedTickets: 0  // сколько билетов уже использовано
};

let prizesState = { history: [] };

/* =========================
   WHEEL PRIZES
========================= */
const WHEEL_PRIZES = [
  { label: "+200 очков", type: "coins", value: 200 },
  { label: "Промо −10%", type: "promo", value: "SALE10" },
  { label: "x2 на 30 мин", type: "boost", value: "X2_30" },
  { label: "+500 очков", type: "coins", value: 500 },
  { label: "Секретный приз", type: "promo", value: "SECRET" },
  { label: "+100 очков", type: "coins", value: 100 }
];

let wheelRotation = 0; // radians
let wheelSpinning = false;

/* =========================
   UTILS
========================= */
function preloadImages(list) {
  list.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.score === "number" && s.score >= 0) score = Math.floor(s.score);
  } catch {}
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ score }));
  } catch {}
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    tasksState = { ...tasksState, ...s };
  } catch {}
}

function saveTasks() {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasksState));
  } catch {}
}

function loadPrizes() {
  try {
    const raw = localStorage.getItem(PRIZES_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (Array.isArray(s.history)) prizesState.history = s.history;
  } catch {}
}

function savePrizes() {
  try {
    localStorage.setItem(PRIZES_KEY, JSON.stringify(prizesState));
  } catch {}
}

function haptic(type = "light") {
  const h = tg?.HapticFeedback;
  if (!h) return;
  type === "selection" ? h.selectionChanged() : h.impactOccurred(type);
}

function notify(type) {
  tg?.HapticFeedback?.notificationOccurred?.(type); // "success"|"warning"|"error"
}

function fmtTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

/* =========================
   INIT
========================= */
loadState();
loadTasks();
loadPrizes();

preloadImages([BOXER_IDLE_SRC, BOXER_PUNCH_SRC, BAG_SRC, BG_SRC]);

tg?.ready();
tg?.expand();

/* =========================
   DOM
========================= */
const scoreEl = document.getElementById("score");
const boxerEl = document.getElementById("boxer");
const bagEl = document.getElementById("bag");
const bagWrapEl = document.getElementById("bagWrap");
const fxLayer = document.getElementById("fxLayer");
const sceneEl = document.querySelector(".boxer-area");

// pages / tabs
const pageGame = document.getElementById("pageGame");
const pageTasks = document.getElementById("pageTasks");
const tabGame = document.getElementById("tabGame");
const tabTasks = document.getElementById("tabTasks");

// tasks
const openChannelBtn = document.getElementById("openChannel");
const claimSubBtn = document.getElementById("claimSub");
const subStatusEl = document.getElementById("subStatus");

const claimDailyBtn = document.getElementById("claimDaily");
const dailyStatusEl = document.getElementById("dailyStatus");

const raffleStatusEl = document.getElementById("raffleStatus");
const openRaffleBtn = document.getElementById("openRaffle");

const prizesListEl = document.getElementById("prizesList");

// badges
const dailyBadgeEl = document.getElementById("dailyBadge");
const raffleBadgeEl = document.getElementById("raffleBadge");

// wheel modal
const wheelModal = document.getElementById("wheelModal");
const closeWheelBtn = document.getElementById("closeWheel");
const spinWheelBtn = document.getElementById("spinWheel");
const wheelTicketsEl = document.getElementById("wheelTickets");
const wheelResultEl = document.getElementById("wheelResult");
const wheelCanvas = document.getElementById("wheelCanvas");
const wctx = wheelCanvas?.getContext("2d");

/* =========================
   UI
========================= */
function updateScore() {
  if (!scoreEl) return;
  scoreEl.textContent = String(score);
  scoreEl.classList.remove("bump");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("bump");
}

function spawnFloatingPoints(points) {
  if (!fxLayer || !bagEl) return;

  const bagRect = bagEl.getBoundingClientRect();
  const fxRect = fxLayer.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "floating-points";
  el.textContent = `+${points}`;

  const x = (bagRect.left + bagRect.width * 0.55) - fxRect.left;
  const y = (bagRect.top + bagRect.height * 0.35) - fxRect.top;

  const jitterX = (Math.random() * 16) - 8;
  const jitterY = (Math.random() * 10) - 5;

  el.style.left = `${x + jitterX}px`;
  el.style.top = `${y + jitterY}px`;

  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

function animatePunch() {
  if (boxerEl) boxerEl.src = BOXER_PUNCH_SRC;

  if (sceneEl) {
    sceneEl.classList.remove("shake");
    void sceneEl.offsetWidth;
    sceneEl.classList.add("shake");
  }

  if (bagWrapEl) {
    bagWrapEl.classList.remove("squash");
    void bagWrapEl.offsetWidth;
    bagWrapEl.classList.add("squash");
  }

  if (bagEl) {
    bagEl.classList.remove("bag-hit");
    void bagEl.offsetWidth;
    bagEl.classList.add("bag-hit");
  }

  setTimeout(() => {
    if (boxerEl) boxerEl.src = BOXER_IDLE_SRC;
  }, 150);
}

/* =========================
   GAME LOGIC
========================= */
function onPunch() {
  score += punchPower;
  updateScore();
  saveState();
  animatePunch();
  spawnFloatingPoints(punchPower);
  haptic("light");
  refreshRaffleUI();
}

(bagWrapEl || bagEl)?.addEventListener("click", onPunch);

/* =========================
   NAV
========================= */
function setPage(name) {
  const isGame = name === "game";

  pageGame?.classList.toggle("active", isGame);
  pageTasks?.classList.toggle("active", !isGame);

  tabGame?.classList.toggle("active", isGame);
  tabTasks?.classList.toggle("active", !isGame);

  try { localStorage.setItem(LAST_PAGE_KEY, name); } catch {}
  haptic("selection");

  if (!isGame) {
    refreshTasksUI();
    renderPrizes();
  }
}

tabGame?.addEventListener("click", () => setPage("game"));
tabTasks?.addEventListener("click", () => setPage("tasks"));

setPage(localStorage.getItem(LAST_PAGE_KEY) || "game");

/* =========================
   TASKS + BADGES
========================= */
function refreshSubTaskUI() {
  if (!subStatusEl || !claimSubBtn) return;

  if (tasksState.subClaimed) {
    subStatusEl.textContent = `Выполнено (+${SUB_TASK_REWARD})`;
    claimSubBtn.disabled = true;
  } else {
    subStatusEl.textContent = "Открой канал и нажми «Получить»";
    claimSubBtn.disabled = false;
  }
}

function refreshDailyUI() {
  if (!dailyStatusEl || !claimDailyBtn) return;

  const now = Date.now();
  const nextAt = (tasksState.lastDailyAt || 0) + DAILY_COOLDOWN;
  const remaining = nextAt - now;

  if (remaining <= 0) {
    dailyStatusEl.textContent = "Доступно ✅";
    claimDailyBtn.disabled = false;

    if (dailyBadgeEl) {
      dailyBadgeEl.classList.remove("hidden");
      dailyBadgeEl.textContent = "ДОСТУПНО";
    }
  } else {
    dailyStatusEl.textContent = `Через ${fmtTime(remaining)}`;
    claimDailyBtn.disabled = true;
    if (dailyBadgeEl) dailyBadgeEl.classList.add("hidden");
  }
}

function getTotalTickets() {
  return Math.floor(score / RAFFLE_STEP);
}

function getAvailableTickets() {
  return Math.max(0, getTotalTickets() - (tasksState.raffleClaimedTickets || 0));
}

function refreshRaffleUI() {
  if (!raffleStatusEl || !openRaffleBtn) return;

  const available = getAvailableTickets();
  raffleStatusEl.textContent = `Билетов: ${available}`;
  openRaffleBtn.disabled = available <= 0;
  openRaffleBtn.style.opacity = openRaffleBtn.disabled ? "0.6" : "1";

  if (raffleBadgeEl) {
    if (available > 0) {
      raffleBadgeEl.classList.remove("hidden");
      raffleBadgeEl.textContent = `БИЛЕТЫ: ${available}`;
    } else {
      raffleBadgeEl.classList.add("hidden");
    }
  }

  // если колесо открыто — обновим текст билетов
  if (wheelTicketsEl && wheelModal && !wheelModal.classList.contains("hidden")) {
    wheelTicketsEl.textContent = `Билетов: ${available}`;
  }
}

function refreshTasksUI() {
  refreshSubTaskUI();
  refreshDailyUI();
  refreshRaffleUI();
}

/* =========================
   TASK ACTIONS
========================= */
openChannelBtn?.addEventListener("click", () => {
  const url = `https://t.me/${CHANNEL_USERNAME}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
  haptic("selection");
});

claimSubBtn?.addEventListener("click", () => {
  if (tasksState.subClaimed) return;

  tasksState.subClaimed = true;
  saveTasks();

  score += SUB_TASK_REWARD;
  updateScore();
  saveState();

  refreshTasksUI();
  notify("success");
});

claimDailyBtn?.addEventListener("click", () => {
  const now = Date.now();
  const nextAt = (tasksState.lastDailyAt || 0) + DAILY_COOLDOWN;

  if (now < nextAt) {
    notify("error");
    refreshDailyUI();
    return;
  }

  tasksState.lastDailyAt = now;
  saveTasks();

  score += DAILY_REWARD;
  updateScore();
  saveState();

  refreshTasksUI();
  notify("success");
});

/* =========================
   PRIZES LIST
========================= */
function renderPrizes() {
  if (!prizesListEl) return;

  const items = prizesState.history || [];
  if (items.length === 0) {
    prizesListEl.innerHTML = `<div class="prize-item">Пока нет призов. Набери 1000 очков для первого билета.</div>`;
    return;
  }

  prizesListEl.innerHTML = items
    .slice()
    .reverse()
    .map((t) => `<div class="prize-item">${t}</div>`)
    .join("");
}

/* =========================
   WHEEL (CANVAS)
========================= */
function drawWheel() {
  if (!wctx || !wheelCanvas) return;

  const ctx = wctx;
  const { width, height } = wheelCanvas;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 8;

  ctx.clearRect(0, 0, width, height);

  const n = WHEEL_PRIZES.length;
  const slice = (Math.PI * 2) / n;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(wheelRotation);

  for (let i = 0; i < n; i++) {
    const a0 = i * slice;
    const a1 = a0 + slice;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.18)";
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.rotate(a0 + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 16px Inter, system-ui";
    ctx.fillText(WHEEL_PRIZES[i].label, r - 12, 6);
    ctx.restore();
  }

  // центр
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function openWheel() {
  if (!wheelModal) return;
  wheelResultEl.textContent = "";
  wheelTicketsEl.textContent = `Билетов: ${getAvailableTickets()}`;
  wheelModal.classList.remove("hidden");
  drawWheel();
  haptic("selection");
}

function closeWheel() {
  wheelModal?.classList.add("hidden");
}

closeWheelBtn?.addEventListener("click", closeWheel);
wheelModal?.addEventListener("click", (e) => {
  if (e.target === wheelModal) closeWheel();
});

// "Открыть" в задании розыгрыша теперь открывает колесо
openRaffleBtn?.addEventListener("click", () => {
  if (getAvailableTickets() <= 0) {
    notify("error");
    return;
  }
  openWheel();
});

function pickPrizeIndexFromRotation(rot) {
  const n = WHEEL_PRIZES.length;
  const slice = (Math.PI * 2) / n;
  const pointerAngle = -Math.PI / 2;

  let a = (pointerAngle - rot) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;

  return Math.floor(a / slice);
}

function applyPrize(prize) {
  const when = new Date().toLocaleString("ru-RU");
  let text = `${when} — ${prize.label}`;

  if (prize.type === "coins") {
    score += prize.value;
    updateScore();
    saveState();
    text += ` (начислено: +${prize.value})`;
  } else {
    // локальный код (для MVP)
    text += ` (код: ${prize.value})`;
  }

  prizesState.history.push(text);
  savePrizes();
  renderPrizes();

  if (wheelResultEl) wheelResultEl.textContent = `Выигрыш: ${prize.label}`;
}

spinWheelBtn?.addEventListener("click", () => {
  if (wheelSpinning) return;

  const available = getAvailableTickets();
  if (available <= 0) {
    wheelTicketsEl.textContent = "Билетов: 0";
    notify("error");
    return;
  }

  // списываем билет сразу
  tasksState.raffleClaimedTickets += 1;
  saveTasks();
  refreshRaffleUI();

  wheelTicketsEl.textContent = `Билетов: ${getAvailableTickets()}`;
  wheelResultEl.textContent = "";
  wheelSpinning = true;
  spinWheelBtn.disabled = true;

  // крутим 4–7 оборотов + докрутка
  const extraTurns = 4 + Math.random() * 3;
  const target = wheelRotation + extraTurns * Math.PI * 2 + Math.random() * Math.PI * 2;

  const start = performance.now();
  const duration = 2600;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const k = easeOutCubic(t);

    // плавно приближаемся к target
    wheelRotation = wheelRotation + (target - wheelRotation) * k;
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // финал
      wheelRotation = target % (Math.PI * 2);
      drawWheel();

      const idx = pickPrizeIndexFromRotation(wheelRotation);
      applyPrize(WHEEL_PRIZES[idx]);

      wheelSpinning = false;
      spinWheelBtn.disabled = false;

      notify("success");
      wheelTicketsEl.textContent = `Билетов: ${getAvailableTickets()}`;
    }
  }

  requestAnimationFrame(step);
});

/* =========================
   START
========================= */
updateScore();
refreshTasksUI();
renderPrizes();
drawWheel();

// сохранение при сворачивании/закрытии
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveState();
    saveTasks();
    savePrizes();
  }
});
window.addEventListener("beforeunload", () => {
  saveState();
  saveTasks();
  savePrizes();
});
