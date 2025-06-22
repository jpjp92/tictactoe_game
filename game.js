// 변수가 이미 정의되어 있는지 확인 후 선언
window.gameJS = window.gameJS || {};

// 이미 실행되었는지 확인
if (!window.gameJS.initialized) {
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
  document.addEventListener('gameInitialize', (e) => {
    console.log('게임 초기화 이벤트 수신:', e.detail);
    
    const { room, player } = e.detail;
    currentGame = room;
    currentPlayer = player;
    boardSize = room.board_size || 3;
    
    // 현재 게임 상태 확인용 로그
    console.log('게임 초기화:', {
      room_id: room.id,
      boardSize,
      player: player.name,
      isHost: room.host_id === player.id
    });
    
    // 방 제목 설정
    if (roomTitle) {
      roomTitle.textContent = room.name || '방 제목 없음';
    }
    
    // 내가 X(방장)인지 O(게스트)인지 설정
    const isHost = room.host_id === player.id;
    playerSymbol = isHost ? 'X' : 'O';
    
    // 플레이어 이름 표시
    if (player1Name) {
      player1Name.textContent = room.host?.name || player.name;
    }
    if (player2Name && room.guest_id) {
      player2Name.textContent = room.guest?.name || '게스트';
    } else if (player2Name) {
      player2Name.textContent = '대기 중...';
    }
    
    // 게임 보드 초기화 (보드 그리기)
    setupGame();
    
    // 실시간 게임 상태 구독
    setupRealtimeGame();
    
    // 현재 턴 확인
    isMyTurn = room.current_turn === player.id;
    statusText.textContent = isMyTurn ? '당신의 턴입니다!' : '상대방의 턴입니다';
    
    // 턴 표시 업데이트
    player1Info.classList.toggle('active', room.current_turn === room.host_id);
    player2Info.classList.toggle('active', room.current_turn === room.guest_id);
    
    // 보드 가시성 확인을 위한 디버깅 로그
    setTimeout(() => {
      if (gameBoard) {
        console.log('게임 보드 요소 스타일:', {
          display: getComputedStyle(gameBoard).display,
          width: getComputedStyle(gameBoard).width,
          height: getComputedStyle(gameBoard).height,
          children: gameBoard.children.length
        });
      }
    }, 500);
  });

  /**
   * 게임 초기 설정
   */
  const setupGame = () => {
    console.log('게임 보드 초기화 시작');
    
    // gameBoard 요소가 존재하는지 확인
    if (!gameBoard) {
      console.error('게임 보드 요소를 찾을 수 없습니다!');
      return;
    }
    
    // 보드 크기 설정
    gameBoard.innerHTML = '';
    
    // 게임 보드 스타일 직접 설정
    gameBoard.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
    gameBoard.style.display = 'grid';
    gameBoard.style.width = '100%';
    gameBoard.style.maxWidth = boardSize === 3 ? '300px' : '400px';
    gameBoard.style.margin = '20px auto';
    gameBoard.style.padding = '10px';
    gameBoard.style.gap = '10px';
    gameBoard.style.background = 'rgba(0, 0, 0, 0.05)';
    gameBoard.style.borderRadius = '8px';
    gameBoard.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    
    // 초기 보드 상태 설정 (이미 보드 상태가 있으면 사용, 없으면 빈 배열 생성)
    if (!cells || !cells.length || cells.length !== boardSize * boardSize) {
      cells = Array(boardSize * boardSize).fill('');
    }
    
    // 보드 그리기
    drawBoard();
    console.log('게임 보드 초기화 완료:', { boardSize, cells });
  };

  /**
   * 실시간 게임 구독 설정
   */
  const setupRealtimeGame = () => {
    // 이전 구독이 있으면 해제
    if (gameSubscription) {
      try {
        gameSubscription.unsubscribe();
      } catch (e) {
        console.log('구독 해제 오류:', e);
      }
    }
    
    // 새 구독 설정
    try {
      gameSubscription = supabase
        .channel(`room:${currentGame.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${currentGame.id}` },
          (payload) => {
            // 방 정보가 업데이트되면 게임 상태 업데이트
            console.log('실시간 업데이트 수신:', payload.new);
            updateGameState(payload.new);
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });
    } catch (error) {
      console.error('실시간 구독 설정 오류:', error);
    }
  };

  /**
   * 게임 보드 그리기
   */
  function drawBoard() {
    console.log('게임 보드 그리기 시작');
    gameBoard.innerHTML = '';
    
    cells.forEach((cell, index) => {
      const div = document.createElement("div");
      div.className = "cell";
      div.dataset.index = index;
      
      // 셀 스타일 직접 적용
      div.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
      div.style.borderRadius = "6px";
      div.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
      div.style.border = "1px solid rgba(0, 0, 0, 0.05)";
      div.style.aspectRatio = "1";
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";
      div.style.fontSize = boardSize === 3 ? "2.5rem" : "2rem";
      div.style.fontWeight = "bold";
      div.style.cursor = "pointer";
      div.style.transition = "all 0.2s";

      if (cell === "X" || cell === "O") {
        const span = document.createElement("span");
        span.textContent = cell;
        span.className = cell === "X" ? "x" : "o";
        span.style.color = cell === "X" ? "#3b82f6" : "#ef4444";
        div.appendChild(span);
      }

      // 셀 클릭 이벤트
      div.addEventListener("click", () => {
        console.log(`셀 ${index} 클릭됨, 현재 턴: ${isMyTurn}, 셀 값: '${cell}'`);
        handleCellClick(index);
      });
      
      // 호버 효과
      div.addEventListener("mouseenter", () => {
        if (cell === '' && isMyTurn) {
          div.style.backgroundColor = "rgba(255, 255, 255, 1)";
          div.style.transform = "scale(1.05)";
        }
      });
      div.addEventListener("mouseleave", () => {
        div.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
        div.style.transform = "scale(1)";
      });
      
      gameBoard.appendChild(div);
    });
    
    console.log('게임 보드 그리기 완료');
  }

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
          
        // 보드 다시 그리기
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
      
      // 플레이어 이름 업데이트
      if (room.host && player1Name) {
        player1Name.textContent = room.host.name;
      }
      if (room.guest && player2Name) {
        player2Name.textContent = room.guest.name;
      }
    } else if (room.status === 'finished') {
      gameOver(room);
    }
  };

  /**
   * 셀 클릭 처리
   */
  async function handleCellClick(index) {
    // 내 턴이 아니거나 이미 채워진 셀이면 클릭 무시
    if (!isMyTurn || cells[index] !== '') {
      console.log('유효하지 않은 클릭:', { isMyTurn, cellValue: cells[index] });
      return;
    }
    
    console.log(`셀 ${index}에 ${playerSymbol} 표시`);
    
    try {
      // 로컬 상태 업데이트
      cells[index] = playerSymbol;
      
      // 임시로 보드 업데이트 (즉각적인 피드백)
      drawBoard();
      
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
      console.log('Supabase 업데이트:', {
        board_state: cells,
        current_turn: nextTurn,
        status: newStatus,
        winner_id: isWinner ? currentPlayer.id : null
      });
      
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
      
      // 임시 UI 업데이트 (즉시 피드백)
      isMyTurn = false;
      statusText.textContent = isWinner ? '승리했습니다! 🎉' : isDraw ? '무승부입니다! 🤝' : '상대방의 턴입니다';
      
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
      if (cells[i*boardSize + i] !== symbol) diag1 = false;
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
  if (leaveGameButton) {
    leaveGameButton.addEventListener('click', leaveGame);
  }
  
  // 이미 실행되었음을 표시
  window.gameJS.initialized = true;
  console.log('Game JS 초기화 완료');
}