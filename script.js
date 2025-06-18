const board = document.getElementById("game-board");
const statusText = document.getElementById("status");
const restartBtn = document.getElementById("restart");
const xScoreEl = document.getElementById("x-score");
const oScoreEl = document.getElementById("o-score");

let currentPlayer = "X";
let cells = Array(25).fill("");
let gameOver = false;
let scores = { "X": 0, "O": 0 };

function drawBoard() {
  board.innerHTML = "";
  cells.forEach((cell, index) => {
    const div = document.createElement("div");
    div.classList.add("cell");

    if (cell === "X" || cell === "O") {
      const span = document.createElement("span");
      span.textContent = cell;
      span.classList.add(cell === "X" ? "x" : "o", "pop");
      div.appendChild(span);
    }

    div.addEventListener("click", () => handleClick(index), { passive: true });
    board.appendChild(div);
  });
}

function handleClick(index) {
  if (cells[index] !== "" || gameOver) return;
  cells[index] = currentPlayer;
  drawBoard();
  if (checkWin(currentPlayer)) {
    statusText.textContent = `${currentPlayer} wins! 🎉`;
    scores[currentPlayer]++;
    updateScore();
    gameOver = true;
  } else if (!cells.includes("")) {
    statusText.textContent = "It's a draw! 🤝";
    gameOver = true;
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusText.textContent = `${currentPlayer}'s turn`;
  }
}

function checkWin(player) {
  // Row check
  for (let r = 0; r < 5; r++) {
    let row = true;
    for (let c = 0; c < 5; c++) {
      if (cells[r*5 + c] !== player) row = false;
    }
    if (row) {
      for (let c = 0; c < 5; c++) board.children[r*5 + c].classList.add("win");
      return true;
    }
  }
  // Column check
  for (let c = 0; c < 5; c++) {
    let col = true;
    for (let r = 0; r < 5; r++) {
      if (cells[r*5 + c] !== player) col = false;
    }
    if (col) {
      for (let r = 0; r < 5; r++) board.children[r*5 + c].classList.add("win");
      return true;
    }
  }
  // Diagonal left-top to right-bottom
  let diag1 = true;
  for (let i = 0; i < 5; i++) {
    if (cells[i*6] !== player) diag1 = false;
  }
  if (diag1) {
    for (let i = 0; i < 5; i++) board.children[i*6].classList.add("win");
    return true;
  }
  // Diagonal right-top to left-bottom
  let diag2 = true;
  for (let i = 1; i <= 5; i++) {
    if (cells[i*4] !== player) diag2 = false;
  }
  if (diag2) {
    for (let i = 1; i <= 5; i++) board.children[i*4].classList.add("win");
    return true;
  }
  return false;
}

function updateScore() {
  xScoreEl.textContent = scores["X"];
  oScoreEl.textContent = scores["O"];
}

restartBtn.addEventListener("click", () => {
  cells = Array(25).fill("");
  currentPlayer = "X";
  gameOver = false;
  statusText.textContent = "X's turn";
  drawBoard();
});

drawBoard();
