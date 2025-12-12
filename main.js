let score = 0;
let punchPower = 1;

const BOXER_IDLE_SRC = "boxer_idle.png";
const BOXER_PUNCH_SRC = "boxer_punch.png";

const scoreEl = document.getElementById('score');
const punchButton = document.getElementById('punchButton');
const bagEl = document.getElementById('bag');
const boxerEl = document.getElementById('boxer');

function updateScore() {
  scoreEl.textContent = score.toString();
}

function animatePunch() {
  // 1. Меняем спрайт на позу удара
  boxerEl.src = BOXER_PUNCH_SRC;

  // 2. Анимация груши
  bagEl.classList.remove('bag-hit');
  void bagEl.offsetWidth;
  bagEl.classList.add('bag-hit');

  // 3. Возвращаем боксера в исходную позу
  setTimeout(() => {
    boxerEl.src = BOXER_IDLE_SRC;
  }, 150); // можно увеличить 150 на 200–250, если удар длиннее
}

function onPunch() {
  score += punchPower;
  updateScore();
  animatePunch();
}

punchButton.addEventListener('click', onPunch);