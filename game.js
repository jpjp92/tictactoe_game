// Supabase 클라이언트를 전역 변수로 가져오기
const supabase = window.supabaseClient;

// DOM 요소
const gameScreen = document.getElementById('game-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const roomTitle = document.getElementById('room-title');
const gameBoard = document.getElementById('game-board');
const statusText = document.getElementById('status');
const player1Info = document.getElementById('player1-info');
const player2Info = document.getElementById('player2-info');
const player1Name = document.getElementById('player1-name');
const player2Name = document.getElementById('player2-name');
const leaveGameButton = document.getElementById('leave-game');

// 게임 상태 변수
let currentGame = null;
let currentPlayer = null;
let boardSize = 3;
let cells = [];
let gameSubscription = null;
let isMyTurn = false;
let playerSymbol = '';

/**
 * 게임 초기화
 */
document.addEventListener('gameInitialize', async (e) => {
  const { room, player } = e.detail;
  currentGame = room;
  currentPlayer = player;
  boardSize = room.board_size;
  
  // 내가 X(방장)인지 O(게스트)인지 설정
  const isHost = room.host_id === player.id;
  playerSymbol = isHost ? 'X' : 'O';
  
  // 게임 보드 초기화
  setupGame();
  
  // 실시간 게임 상태 구독
  setupRealtimeGame();
  
  // 상세 방 정보 가져오기
  await fetchRoomDetails();
});

/**
 * 방 상세 정보 가져오기
 */
const fetchRoomDetails = async () => {
  try {
    const { data: room, error } = await supabase
      .from('rooms')
      .select(`
        id, 
        name, 
        host_id, 
        guest_id,
        current_turn,
        board_state,
        status,
        host:host_id(name),
        guest:guest_id(name)
      `)
      .eq('id', currentGame.id)
      .single();
      
    if (error) throw error;
    
    if (room) {
      currentGame = room;
      
      // 방 정보 업데이트
      roomTitle.textContent = room.name;
      player1Name.textContent = room.host?.name || '방장';
      player2Name.textContent = room.guest?.name || '대기 중...';
      
      // 게임 상태 업데이트
      updateGameState(room);
    }
  } catch (error) {
    console.error('방 상세정보 가져오기 오류:', error);
  }
};

/**
 * 게임 상태 업데이트
 */
const updateGameState = (room) => {
  // 보드 상태 업데이트
  if (room.board_state) {
    try {
      // board_state가 문자열이면 파싱, 아니면 그대로 사용
      cells = typeof room.board_state === 'string' 
        ? JSON.parse(room.board_state) 
        : room.board_state;
        
      drawBoard();
    } catch (e) {
      console.error('보드 상태 파싱 오류:', e);
    }
  }
  
  // 게임 상태에 따른 UI 업데이트
  if (room.status === 'waiting') {
    statusText.textContent = '상대방을 기다리는 중...';
    isMyTurn = false;
  } else if (room.status === 'playing') {
    // 현재 턴 확인
    isMyTurn = room.current_turn === currentPlayer.id;
    
    // 턴 표시 업데이트
    player1Info.classList.toggle('active', room.current_turn === room.host_id);
    player2Info.classList.toggle('active', room.current_turn === room.guest_id);
    
    statusText.textContent = isMyTurn ? '당신의 턴입니다!' : '상대방의 턴입니다';
  } else if (room.status === 'finished') {
    gameOver(room);
  }
};

/**
 * 게임 초기 설정
 */
const setupGame = () => {
  gameBoard.innerHTML = '';
  gameBoard.style.gridTemplateColumns = `repeat(${boardSize}, minmax(50px, 1fr))`;
  
  cells = Array(boardSize * boardSize).fill('');
  drawBoard();
};

/**
 * 실시간 게임 구독 설정
 */
const setupRealtimeGame = () => {
  // 이전 구독이 있으면 해제
  if (gameSubscription) {
    gameSubscription.unsubscribe();
  }
  
  // 새 구독 설정
  gameSubscription = supabase
    .channel(`room:${currentGame.id}`)
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${currentGame.id}` },
      (payload) => {
        // 방 정보가 업데이트되면 게임 상태 업데이트
        updateGameState(payload.new);
      }
    )
    .subscribe();
};

/**
 * 게임 보드 그리기
 */
function drawBoard() {
  gameBoard.innerHTML = '';
  
  cells.forEach((cell, index) => {
    const div = document.createElement("div");
    div.classList.add("cell");

    if (cell === "X" || cell === "O") {
      const span = document.createElement("span");
      span.textContent = cell;
      span.classList.add(cell === "X" ? "x" : "o", "pop");
      div.appendChild(span);
    }

    div.addEventListener("click", () => handleCellClick(index), { passive: true });
    gameBoard.appendChild(div);
  });
}

/**
 * 셀 클릭 처리
 */
async function handleCellClick(index) {
  // 내 턴이 아니거나 이미 채워진 셀이면 클릭 무시
  if (!isMyTurn || cells[index] !== '') return;
  
  try {
    // 로컬 상태 업데이트
    cells[index] = playerSymbol;
    
    // 승리 확인
    const isWinner = checkWin(playerSymbol);
    const isDraw = !cells.includes('') && !isWinner; // 모든 셀이 채워졌고 승자가 없으면 무승부
    
    // 게임 상태 결정
    const newStatus = isWinner || isDraw ? 'finished' : 'playing';
    
    // 상대방 ID
    const opponentId = currentPlayer.id === currentGame.host_id
      ? currentGame.guest_id
      : currentGame.host_id;
    
    // 다음 턴 설정 (게임 종료면 현재 플레이어, 아니면 상대방)
    const nextTurn = isWinner || isDraw ? currentPlayer.id : opponentId;
    
    // Supabase 업데이트
    const { error } = await supabase
      .from('rooms')
      .update({
        board_state: cells,
        current_turn: nextTurn,
        status: newStatus,
        winner_id: isWinner ? currentPlayer.id : null
      })
      .eq('id', currentGame.id);
    
    if (error) throw error;
    
    // 게임이 끝나면 히스토리 저장
    if (isWinner || isDraw) {
      await saveGameHistory(isWinner ? currentPlayer.id : null);
    }
  } catch (error) {
    console.error('게임 업데이트 오류:', error);
  }
}

/**
 * 승리 확인
 */
function checkWin(symbol) {
  // 가로줄 확인
  for (let r = 0; r < boardSize; r++) {
    let row = true;
    for (let c = 0; c < boardSize; c++) {
      if (cells[r*boardSize + c] !== symbol) row = false;
    }
    if (row) return true;
  }
  
  // 세로줄 확인
  for (let c = 0; c < boardSize; c++) {
    let col = true;
    for (let r = 0; r < boardSize; r++) {
      if (cells[r*boardSize + c] !== symbol) col = false;
    }
    if (col) return true;
  }
  
  // 대각선 (왼쪽 위에서 오른쪽 아래)
  let diag1 = true;
  for (let i = 0; i < boardSize; i++) {
    if (cells[i*(boardSize+1)] !== symbol) diag1 = false;
  }
  if (diag1) return true;
  
  // 대각선 (오른쪽 위에서 왼쪽 아래)
  let diag2 = true;
  for (let i = 0; i < boardSize; i++) {
    if (cells[i*boardSize + (boardSize-1-i)] !== symbol) diag2 = false;
  }
  if (diag2) return true;
  
  return false;
}

/**
 * 게임 종료 처리
 */
function gameOver(room) {
  if (room.winner_id) {
    const isWinner = room.winner_id === currentPlayer.id;
    statusText.textContent = isWinner ? '승리했습니다! 🎉' : '패배했습니다! 😢';
    
    // 승자 하이라이트
    const winnerPlayerInfo = room.winner_id === room.host_id ? player1Info : player2Info;
    winnerPlayerInfo.classList.add('winner');
  } else {
    statusText.textContent = "무승부입니다! 🤝";
  }
}

/**
 * 게임 히스토리 저장
 */
async function saveGameHistory(winnerId) {
  try {
    await supabase
      .from('game_history')
      .insert({
        room_id: currentGame.id,
        player1_id: currentGame.host_id,
        player2_id: currentGame.guest_id,
        winner_id: winnerId,
        board_size: boardSize,
        moves: cells
      });
  } catch (error) {
    console.error('게임 히스토리 저장 오류:', error);
  }
}

/**
 * 게임 나가기
 */
async function leaveGame() {
  // 구독 해제
  if (gameSubscription) {
    gameSubscription.unsubscribe();
  }
  
  // 게임 중이었다면 상대방 승리로 처리
  if (currentGame && currentGame.status === 'playing') {
    const opponentId = currentGame.host_id === currentPlayer.id
      ? currentGame.guest_id
      : currentGame.host_id;
    
    try {
      await supabase
        .from('rooms')
        .update({
          status: 'finished',
          winner_id: opponentId
        })
        .eq('id', currentGame.id);
        
      await saveGameHistory(opponentId);
    } catch (error) {
      console.error('게임 종료 오류:', error);
    }
  }
  
  // 로비로 돌아가기
  gameScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
}

// 이벤트 리스너
leaveGameButton.addEventListener('click', leaveGame);

// 게임 보드에 필요한 추가 스타일
document.head.insertAdjacentHTML('beforeend', `
  <style>
    #game-board {
      display: grid;
      gap: 5px;
      margin: 20px auto;
      max-width: 500px;
    }
    
    .cell {
      aspect-ratio: 1;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .cell:hover {
      background: rgba(255, 255, 255, 0.7);
    }
    
    .x {
      color: #3b82f6;
    }
    
    .o {
      color: #ef4444;
    }
    
    .pop {
      animation: pop 0.3s ease-out;
    }
    
    @keyframes pop {
      0% { transform: scale(0.5); opacity: 0.5; }
      70% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
  </style>
`);