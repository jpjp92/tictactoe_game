const board = document.getElementById("game-board");
const statusText = document.getElementById("status");
const restartBtn = document.getElementById("restart");
const xScoreEl = document.getElementById("x-score");
const oScoreEl = document.getElementById("o-score");
const size3x3Btn = document.getElementById("size-3x3");
const size5x5Btn = document.getElementById("size-5x5");

let boardSize = 3; // 기본 크기 3x3
let currentPlayer = "X";
let cells = Array(boardSize * boardSize).fill("");
let gameOver = false;
let scores = { "X": 0, "O": 0 };

function drawBoard() {
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${boardSize}, minmax(50px, 1fr))`;
  
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
  for (let r = 0; r < boardSize; r++) {
    let row = true;
    for (let c = 0; c < boardSize; c++) {
      if (cells[r*boardSize + c] !== player) row = false;
    }
    if (row) {
      for (let c = 0; c < boardSize; c++) 
        board.children[r*boardSize + c].classList.add("win");
      return true;
    }
  }
  
  // Column check
  for (let c = 0; c < boardSize; c++) {
    let col = true;
    for (let r = 0; r < boardSize; r++) {
      if (cells[r*boardSize + c] !== player) col = false;
    }
    if (col) {
      for (let r = 0; r < boardSize; r++) 
        board.children[r*boardSize + c].classList.add("win");
      return true;
    }
  }
  
  // Diagonal left-top to right-bottom
  let diag1 = true;
  for (let i = 0; i < boardSize; i++) {
    if (cells[i*(boardSize+1)] !== player) diag1 = false;
  }
  if (diag1) {
    for (let i = 0; i < boardSize; i++) 
      board.children[i*(boardSize+1)].classList.add("win");
    return true;
  }
  
  // Diagonal right-top to left-bottom
  let diag2 = true;
  for (let i = 0; i < boardSize; i++) {
    if (cells[(i+1)*boardSize - 1 - i] !== player) diag2 = false;
  }
  if (diag2) {
    for (let i = 0; i < boardSize; i++)
      board.children[(i+1)*boardSize - 1 - i].classList.add("win");
    return true;
  }
  
  return false;
}

function updateScore() {
  xScoreEl.textContent = scores["X"];
  oScoreEl.textContent = scores["O"];
}

function resetGame() {
  cells = Array(boardSize * boardSize).fill("");
  currentPlayer = "X";
  gameOver = false;
  statusText.textContent = "X's turn";
  drawBoard();
}

function changeBoardSize(size) {
  // 보드 크기 변경 시 게임 재설정
  boardSize = size;
  resetGame();
  
  // 버튼 활성화 상태 갱신
  size3x3Btn.classList.toggle("active", size === 3);
  size5x5Btn.classList.toggle("active", size === 5);
}

// 이벤트 리스너 설정
restartBtn.addEventListener("click", resetGame);

size3x3Btn.addEventListener("click", () => {
  changeBoardSize(3);
});

size5x5Btn.addEventListener("click", () => {
  changeBoardSize(5);
});

// 초기 게임 보드 그리기
drawBoard();
