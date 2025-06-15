const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = window.env;

console.log('VITE_SUPABASE_URL:', VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', VITE_SUPABASE_ANON_KEY);

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Environment variables are not properly set:', { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY });
  throw new Error('Missing or invalid Supabase credentials');
}

const supabase = window.supabase.createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
console.log('Supabase client initialized with URL:', VITE_SUPABASE_URL);

let currentGameId = null;
let currentPlayer = null;
let scores = { "X": 0, "O": 0 };

// 나머지 코드 (drawBoard, handleClick 등)는 이전과 동일하게 유지
function drawBoard(boardState = Array(25).fill("0")) {
  const board = document.getElementById("game-board");
  board.innerHTML = "";
  boardState.forEach((cell, index) => {
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

async function handleClick(index) {
  if (!currentGameId || !currentPlayer || gameOver) return;
  const { data } = await supabase.from('games').select('board, last_played').eq('id', currentGameId).single();
  if (data.board[index] !== '0' || (currentPlayer === 'X' && data.last_played !== 1) || (currentPlayer === 'O' && data.last_played !== 2)) return;

  let newBoard = data.board.split('');
  newBoard[index] = currentPlayer;
  const winner = checkWinner(newBoard);
  await supabase
    .from('games')
    .update({ board: newBoard.join(''), last_played: currentPlayer === 'X' ? 2 : 1, winner })
    .eq('id', currentGameId);
  if (winner) {
    scores[currentPlayer]++;
    updateScore();
  }
}

function checkWinner(board) {
  const wins = [
    ...Array(5).fill().map((_, i) => Array(5).fill().map((_, j) => i * 5 + j)),
    ...Array(5).fill().map((_, i) => Array(5).fill().map((_, j) => j * 5 + i)),
    Array(5).fill().map((_, i) => i * 6),
    Array(5).fill().map((_, i) => (i + 1) * 4)
  ];
  for (const combo of wins) {
    if (combo.every(i => board[i] === (board[combo[0]] === 'X' ? 'X' : 'O'))) {
      combo.forEach(i => document.getElementById("game-board").children[i].classList.add("win"));
      return board[combo[0]] === 'X' ? 1 : 2;
    }
  }
  return board.includes('0') ? null : 0;
}

function updateScore() {
  document.getElementById("x-score").textContent = scores["X"];
  document.getElementById("o-score").textContent = scores["O"];
}

async function createGame() {
  const { data, error } = await supabase
    .from('games')
    .insert({ board: '0'.repeat(25), last_played: 1 })
    .select()
    .single();
  if (error) throw error;
  currentGameId = data.id;
  currentPlayer = 'X';
  document.getElementById('game-code').value = btoa(data.id);
  subscribeToGame(data.id, updateBoard);
  drawBoard();
}

async function joinGame() {
  const gameCode = document.getElementById('game-code').value;
  try {
    const gameId = atob(gameCode);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    if (error) throw error;
    currentGameId = data.id;
    currentPlayer = 'O';
    subscribeToGame(data.id, updateBoard);
    drawBoard(data.board.split(''));
    updateBoard(data);
  } catch (e) {
    alert("Invalid game code!");
  }
}

function subscribeToGame(gameId, callback) {
  supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
      callback(payload.new);
    })
    .subscribe();
}

function updateBoard(game) {
  drawBoard(game.board.split(''));
  document.getElementById('status').textContent = game.winner
    ? `Winner: Player ${game.winner === 1 ? 'X' : 'O'} 🎉`
    : `Turn: Player ${game.last_played === 1 ? 'X' : 'O'}`;
}

async function restartGame() {
  if (currentGameId) {
    await supabase.from('games').update({ board: '0'.repeat(25), last_played: 1, winner: null }).eq('id', currentGameId);
    drawBoard();
  }
}

document.getElementById("restart").addEventListener("click", restartGame);
drawBoard();