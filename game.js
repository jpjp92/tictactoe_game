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
   * 게임 초기화 이벤트 처리기
   */
  document.addEventListener('gameInitialize', (e) => {
    console.log('🎮 게임 초기화 이벤트 수신:', e.detail);
    
    const { room, player, isHost, waitingForGuest } = e.detail;
    currentGame = room;
    currentPlayer = player;
    boardSize = room.board_size || 3;
    
    // 상세 디버깅 정보 추가
    console.log('📋 게임 초기화 상세 정보:', {
      '게임 ID': room.id,
      '현재 플레이어 ID': player.id,
      '현재 플레이어 이름': player.name,
      '방장 ID': room.host_id,
      '게스트 ID': room.guest_id,
      '현재 턴 ID': room.current_turn,
      '내가 방장인가': room.host_id === player.id,
      '내가 게스트인가': room.guest_id === player.id,
      '게스트 대기 중': waitingForGuest
    });
    
    // 게스트 대기 상태 확인
    if (waitingForGuest && !room.guest_id) {
      console.log('🔄 게스트를 기다리는 중...');
      if (statusText) {
        statusText.textContent = '상대방을 기다리는 중...';
        statusText.style.color = '#6b7280';
      }
    }
    
    // ⚠️ 안전장치: 방장과 게스트가 동일하면 오류
    if (room.host_id === room.guest_id && room.guest_id) {
      console.error('🚨 치명적 오류: 방장과 게스트가 동일한 사람입니다!');
      alert('게임 설정 오류: 방장과 게스트가 동일한 사람으로 설정되었습니다. 게임을 다시 시작해주세요.');
      return;
    }
    
    // ⚠️ 안전장치: 게스트가 없으면 경고 (방장 모드에서는 정상)
    if (!room.guest_id && !waitingForGuest) {
      console.warn('⚠️ 게스트가 아직 입장하지 않았습니다.');
    }
    
    // 내가 X(방장)인지 O(게스트)인지 설정
    const isHostPlayer = room.host_id === player.id;
    playerSymbol = isHostPlayer ? 'X' : 'O';
    
    console.log('🎯 플레이어 심볼 설정:', {
      '내 ID': player.id,
      '방장 ID': room.host_id,
      '내가 방장': isHostPlayer,
      '내 심볼': playerSymbol
    });
    
    // 방 제목 설정
    if (roomTitle) {
      roomTitle.textContent = room.name || '방 제목 없음';
    }
    
    // 플레이어 이름 표시
    updatePlayerInfo(room);
    
    // 게임 보드 초기화 (보드 그리기)
    setupGame();
    
    // 실시간 게임 상태 구독
    setupRealtimeGame();
    
    // 상태 업데이트
    updateGameState(room);
    
    // 디버깅을 위한 DOM 요소 출력
    setTimeout(checkBoardVisibility, 1000);
  });

  /**
   * 플레이어 정보 업데이트
   */
  function updatePlayerInfo(room) {
    // 방장 정보
    if (player1Name) {
      if (room.host) {
        player1Name.textContent = room.host.name || '방장';
      } else {
        player1Name.textContent = '방장 (연결 중...)';
      }
    }
    
    // 게스트 정보
    if (player2Name) {
      if (room.guest_id) {
        if (room.guest) {
          player2Name.textContent = room.guest.name || '게스트';
        } else {
          player2Name.textContent = '게스트 (연결 중...)';
        }
      } else {
        player2Name.textContent = '대기 중...';
      }
    }
    
    // 활성 플레이어 표시
    if (player1Info && player2Info) {
      const isHost = currentPlayer.id === room.host_id;
      player1Info.classList.toggle('active', room.current_turn === room.host_id);
      player2Info.classList.toggle('active', room.current_turn === room.guest_id);
      
      // 내 정보 강조
      if (isHost) {
        player1Info.classList.add('my-info');
      } else {
        player2Info.classList.add('my-info');
      }
    }
  }

  /**
   * 게임 상태 업데이트
   */
  function updateGameStatus(room) {
    if (!statusText) return;
    
    // 게임 상태에 따라 메시지 설정
    if (room.status === 'waiting') {
      if (room.host_id === currentPlayer.id) {
        statusText.textContent = '상대방이 입장하기를 기다리는 중입니다...';
      } else {
        statusText.textContent = '게임 준비 중...';
      }
    } else if (room.status === 'playing') {
      isMyTurn = room.current_turn === currentPlayer.id;
      statusText.textContent = isMyTurn ? '당신의 턴입니다!' : '상대방의 턴입니다';
    } else if (room.status === 'finished') {
      if (room.winner_id) {
        const isWinner = room.winner_id === currentPlayer.id;
        statusText.textContent = isWinner ? '승리했습니다! 🎉' : '패배했습니다! 😢';
      } else {
        statusText.textContent = '무승부입니다! 🤝';
      }
    }
  }

  /**
   * 게임 보드 가시성 확인 (디버깅용)
   */
  function checkBoardVisibility() {
    if (gameBoard) {
      console.log('게임 보드 요소 스타일:', {
        display: getComputedStyle(gameBoard).display,
        width: getComputedStyle(gameBoard).width,
        height: getComputedStyle(gameBoard).height,
        children: gameBoard.children.length,
        visibility: getComputedStyle(gameBoard).visibility,
        opacity: getComputedStyle(gameBoard).opacity
      });
      
      // 보드가 보이지 않으면 스타일 강제 적용
      if (getComputedStyle(gameBoard).display === 'none') {
        gameBoard.style.display = 'grid';
        gameBoard.style.visibility = 'visible';
        gameBoard.style.opacity = '1';
        console.log('게임 보드 가시성 수정 적용됨');
      }
    } else {
      console.error('게임 보드 요소를 찾을 수 없음!');
    }
  }

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
        console.log('이전 게임 구독이 해제되었습니다.');
      } catch (e) {
        console.log('게임 구독 해제 중 오류 (무시 가능):', e);
      }
      gameSubscription = null;
    }
    
    if (!currentGame || !currentGame.id) {
      console.error('❌ currentGame이 설정되지 않아 실시간 구독을 설정할 수 없습니다.');
      return;
    }
    
    try {
      console.log(`🔌 게임 ID: ${currentGame.id}에 대한 실시간 구독 설정`);
      
      // 고유한 채널 ID 생성
      const channelId = `game-${currentGame.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      gameSubscription = supabase
        .channel(channelId)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'rooms', 
            filter: `id=eq.${currentGame.id}` 
          },
          (payload) => {
            console.log('🎮 게임 상태 업데이트 수신:', payload.new);
            
            try {
              // 게임 상태 업데이트
              updateGameState(payload.new);
            } catch (updateError) {
              console.error('❌ 게임 상태 업데이트 중 오류:', updateError);
            }
          }
        )
        .subscribe((status) => {
          console.log('🎮 게임 구독 상태:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ 게임 실시간 구독이 성공했습니다.');
            // 구독 성공 시 초기 게임 상태 설정
            updateGameState(currentGame);
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.error('❌ 게임 구독 실패, 재시도 중...', status);
            setTimeout(() => {
              setupRealtimeGame();
            }, 3000);
          }
        });
      
    } catch (error) {
      console.error('❌ 실시간 게임 구독 설정 오류:', error);
      
      // 오류 발생 시 재시도
      setTimeout(() => {
        console.log('🔄 게임 구독 재시도...');
        setupRealtimeGame();
      }, 5000);
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
    console.log('🎮 게임 상태 업데이트:', room);
    
    // ID 검증 및 디버깅 추가
    console.log('🔍 ID 검증:', {
      '현재 플레이어 ID': currentPlayer?.id,
      '방장 ID': room.host_id,
      '게스트 ID': room.guest_id,
      '현재 턴 ID': room.current_turn,
      '게임 ID': room.id
    });
    
    // currentPlayer가 제대로 설정되어 있는지 확인
    if (!currentPlayer || !currentPlayer.id) {
      console.error('❌ currentPlayer가 설정되지 않았습니다!');
      return;
    }
    
    // 내가 이 방에 속해 있는지 확인
    const isHost = room.host_id === currentPlayer.id;
    const isGuest = room.guest_id === currentPlayer.id;
    
    if (!isHost && !isGuest) {
      console.error('❌ 내가 이 방에 속해 있지 않습니다!', {
        '내 ID': currentPlayer.id,
        '방장 ID': room.host_id,
        '게스트 ID': room.guest_id
      });
      return;
    }
    
    console.log('✅ 방 멤버십 확인:', {
      '내가 방장': isHost,
      '내가 게스트': isGuest,
      '내 심볼': isHost ? 'X' : 'O'
    });
    
    // 현재 게임 정보 업데이트
    currentGame = room;
    
    // 보드 상태 업데이트
    if (room.board_state) {
      try {
        // board_state가 문자열이면 파싱, 아니면 그대로 사용
        const newCells = typeof room.board_state === 'string' 
          ? JSON.parse(room.board_state) 
          : room.board_state;
        
        // 보드 상태가 변경된 경우에만 업데이트
        if (JSON.stringify(cells) !== JSON.stringify(newCells)) {
          cells = newCells;
          console.log('📋 보드 상태 업데이트:', cells);
          drawBoard();
        }
      } catch (e) {
        console.error('보드 상태 파싱 오류:', e);
      }
    }
    
    // 턴 상태 업데이트
    const previousTurn = isMyTurn;
    isMyTurn = room.current_turn === currentPlayer.id;
    
    console.log('🔄 턴 상태 분석:', {
      '현재 턴 ID': room.current_turn,
      '내 ID': currentPlayer.id,
      '턴 매치': room.current_turn === currentPlayer.id,
      '이전 내 턴': previousTurn,
      '현재 내 턴': isMyTurn
    });
    
    if (previousTurn !== isMyTurn) {
      console.log(`🔄 턴 변경: ${previousTurn} → ${isMyTurn}`);
    }
    
    // 플레이어 정보 업데이트
    updatePlayerInfo(room);
    
    // 게임 상태에 따른 UI 업데이트
    if (room.status === 'waiting') {
      // 🎯 방장이 게스트를 기다리는 상태
      if (isHost) {
        statusText.textContent = '상대방을 기다리는 중...';
        statusText.style.color = '#f59e0b';
        statusText.style.fontWeight = 'bold';
      } else {
        statusText.textContent = '게임 준비 중...';
        statusText.style.color = '#6b7280';
      }
      isMyTurn = false;
    } else if (room.status === 'playing') {
      // 게임 진행 중
      updateTurnDisplay(room);
      
      if (isMyTurn) {
        statusText.textContent = `당신의 턴입니다! (${playerSymbol})`;
        statusText.style.color = '#10b981';
        statusText.style.fontWeight = 'bold';
      } else {
        statusText.textContent = '상대방의 턴입니다...';
        statusText.style.color = '#6b7280';
        statusText.style.fontWeight = 'normal';
      }
      
      console.log(`🎯 현재 턴: ${isMyTurn ? '내 턴' : '상대방 턴'} (${playerSymbol})`);
    } else if (room.status === 'finished') {
      gameOver(room);
    }
  };

  /**
   * 턴 표시 업데이트
   */
  function updateTurnDisplay(room) {
    if (player1Info && player2Info) {
      // 모든 active 클래스 제거
      player1Info.classList.remove('active');
      player2Info.classList.remove('active');
      
      // 현재 턴인 플레이어에게 active 클래스 추가
      if (room.current_turn === room.host_id) {
        player1Info.classList.add('active');
      } else if (room.current_turn === room.guest_id) {
        player2Info.classList.add('active');
      }
      
      console.log('👥 플레이어 활성 상태 업데이트:', {
        host_active: room.current_turn === room.host_id,
        guest_active: room.current_turn === room.guest_id,
        current_turn: room.current_turn,
        my_id: currentPlayer.id
      });
    }
  }

  /**
   * 플레이어 정보 업데이트 개선
   */
  function updatePlayerInfo(room) {
    // 방장 정보 (X)
    if (player1Name) {
      if (room.host && room.host.name) {
        player1Name.textContent = `${room.host.name} (X)`;
      } else {
        player1Name.textContent = '방장 (X)';
      }
    }
    
    // 게스트 정보 (O)
    if (player2Name) {
      if (room.guest_id && room.guest && room.guest.name) {
        player2Name.textContent = `${room.guest.name} (O)`;
      } else if (room.guest_id) {
        player2Name.textContent = '게스트 (O)';
      } else {
        player2Name.textContent = '대기 중...';
      }
    }
    
    // 내 정보 강조
    if (player1Info && player2Info) {
      const isHost = currentPlayer.id === room.host_id;
      
      // 모든 my-info 클래스 제거
      player1Info.classList.remove('my-info');
      player2Info.classList.remove('my-info');
      
      // 내 정보에 강조 표시
      if (isHost) {
        player1Info.classList.add('my-info');
      } else {
        player2Info.classList.add('my-info');
      }
    }
  }

  /**
   * 셀 클릭 처리 개선
   */
  async function handleCellClick(index) {
    console.log(`🎯 셀 ${index} 클릭 이벤트 시작`);
    
    // 현재 상태 상세 로그
    console.log('📊 클릭 시점 상태:', {
      '셀 인덱스': index,
      '현재 셀 값': cells[index],
      '내 턴 여부': isMyTurn,
      '내 심볼': playerSymbol,
      '내 ID': currentPlayer?.id,
      '현재 턴 ID': currentGame?.current_turn,
      '게임 상태': currentGame?.status,
      '방장 ID': currentGame?.host_id,
      '게스트 ID': currentGame?.guest_id
    });
    
    // 기본 유효성 검사
    if (!currentPlayer || !currentPlayer.id) {
      console.error('❌ 플레이어 정보가 없습니다.');
      showTempMessage('플레이어 정보 오류!');
      return;
    }
    
    if (!currentGame || !currentGame.id) {
      console.error('❌ 게임 정보가 없습니다.');
      showTempMessage('게임 정보 오류!');
      return;
    }
    
    // ⚠️ 중요: 게스트가 없으면 게임 진행 불가
    if (!currentGame.guest_id) {
      console.error('❌ 게스트가 없어서 게임을 진행할 수 없습니다.');
      showTempMessage('상대방이 아직 입장하지 않았습니다!');
      return;
    }
    
    // ⚠️ 중요: 혼자 게임하는 상황 방지
    if (currentGame.host_id === currentGame.guest_id) {
      console.error('❌ 방장과 게스트가 동일한 사람입니다. 게임을 진행할 수 없습니다.');
      showTempMessage('게임 설정 오류: 같은 사람이 방장과 게스트로 설정되었습니다!');
      return;
    }
    
    // 유효성 검사
    if (!isMyTurn) {
      console.log('❌ 현재 내 턴이 아닙니다.');
      console.log('턴 상태 상세:', {
        '현재 턴 ID': currentGame.current_turn,
        '내 ID': currentPlayer.id,
        '매치 여부': currentGame.current_turn === currentPlayer.id
      });
      showTempMessage('상대방의 턴입니다!');
      return;
    }
    
    if (cells[index] !== '') {
      console.log('❌ 이미 채워진 셀입니다.');
      showTempMessage('이미 선택된 칸입니다!');
      return;
    }
    
    if (currentGame.status !== 'playing') {
      console.log('❌ 게임이 진행 중이 아닙니다. 상태:', currentGame.status);
      return;
    }
    
    try {
      console.log(`✅ 셀 ${index}에 ${playerSymbol} 표시 시작`);
      
      // 임시로 턴 비활성화 (중복 클릭 방지)
      isMyTurn = false;
      statusText.textContent = '처리 중...';
      
      // 로컬 상태 업데이트
      const newCells = [...cells];
      newCells[index] = playerSymbol;
      
      // 승리 확인
      const isWinner = checkWin(newCells, playerSymbol);
      const isDraw = !newCells.includes('') && !isWinner;
      
      // 게임 상태 결정
      const newStatus = isWinner || isDraw ? 'finished' : 'playing';
      
      // ⚠️ 중요: 상대방 ID 정확히 계산
      const isHost = currentPlayer.id === currentGame.host_id;
      let opponentId;
      
      if (isHost) {
        // 내가 방장이면 상대방은 게스트
        opponentId = currentGame.guest_id;
      } else {
        // 내가 게스트면 상대방은 방장
        opponentId = currentGame.host_id;
      }
      
      // ⚠️ 안전장치: 상대방 ID가 내 ID와 같으면 오류
      if (opponentId === currentPlayer.id) {
        console.error('❌ 치명적 오류: 상대방 ID가 내 ID와 동일합니다!', {
          '내 ID': currentPlayer.id,
          '방장 ID': currentGame.host_id,
          '게스트 ID': currentGame.guest_id,
          '내가 방장': isHost,
          '계산된 상대방 ID': opponentId
        });
        showTempMessage('게임 설정 오류가 발생했습니다. 다시 시작해주세요.');
        return;
      }
      
      const nextTurn = isWinner || isDraw ? null : opponentId;
      
      console.log('🔄 업데이트 준비:', {
        '내가 방장': isHost,
        '내 ID': currentPlayer.id,
        '방장 ID': currentGame.host_id,
        '게스트 ID': currentGame.guest_id,
        '상대방 ID': opponentId,
        '다음 턴': nextTurn,
        '새 상태': newStatus,
        '승리 여부': isWinner
      });
      
      console.log('🔄 Supabase 업데이트 시작:', {
        board_state: newCells,
        current_turn: nextTurn,
        status: newStatus,
        winner_id: isWinner ? currentPlayer.id : null
      });
      
      // Supabase 업데이트
      const { error } = await supabase
        .from('rooms')
        .update({
          board_state: newCells,
          current_turn: nextTurn,
          status: newStatus,
          winner_id: isWinner ? currentPlayer.id : null
        })
        .eq('id', currentGame.id);
      
      if (error) throw error;
      
      console.log('✅ Supabase 업데이트 완료');
      
      // 게임이 끝나면 히스토리 저장
      if (isWinner || isDraw) {
        await saveGameHistory(isWinner ? currentPlayer.id : null);
      }
      
    } catch (error) {
      console.error('❌ 게임 업데이트 오류:', error);
      // 오류 발생 시 상태 복구
      isMyTurn = currentGame.current_turn === currentPlayer.id;
      statusText.textContent = isMyTurn ? '당신의 턴입니다!' : '상대방의 턴입니다';
      showTempMessage('오류가 발생했습니다. 다시 시도해주세요.');
    }
  }

  /**
   * 승리 확인 함수 개선
   */
  function checkWin(boardCells, symbol) {
    // 가로줄 확인
    for (let r = 0; r < boardSize; r++) {
      let row = true;
      for (let c = 0; c < boardSize; c++) {
        if (boardCells[r * boardSize + c] !== symbol) row = false;
      }
      if (row) return true;
    }
    
    // 세로줄 확인
    for (let c = 0; c < boardSize; c++) {
      let col = true;
      for (let r = 0; r < boardSize; r++) {
        if (boardCells[r * boardSize + c] !== symbol) col = false;
      }
      if (col) return true;
    }
    
    // 대각선 (왼쪽 위에서 오른쪽 아래)
    let diag1 = true;
    for (let i = 0; i < boardSize; i++) {
      if (boardCells[i * boardSize + i] !== symbol) diag1 = false;
    }
    if (diag1) return true;
    
    // 대각선 (오른쪽 위에서 왼쪽 아래)
    let diag2 = true;
    for (let i = 0; i < boardSize; i++) {
      if (boardCells[i * boardSize + (boardSize - 1 - i)] !== symbol) diag2 = false;
    }
    if (diag2) return true;
    
    return false;
  }

  /**
   * 임시 메시지 표시
   */
  function showTempMessage(message) {
    // 기존 메시지가 있으면 제거
    const existingMessage = document.getElementById('temp-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.id = 'temp-message';
    tempDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(239, 68, 68, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: fadeInOut 2s ease-in-out;
    `;
    tempDiv.textContent = message;
    
    // CSS 애니메이션 추가
    if (!document.getElementById('temp-message-styles')) {
      const style = document.createElement('style');
      style.id = 'temp-message-styles';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(tempDiv);
    
    // 2초 후 자동 제거
    setTimeout(() => {
      if (tempDiv.parentNode) {
        tempDiv.remove();
      }
    }, 2000);
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

  /**
   * 방 참여 처리
   */
  async function joinRoom(roomId) {
    try {
      console.log('방 참여 시도:', roomId);
      
      // 방 정보 먼저 가져오기
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*, host:host_id(name)')
        .eq('id', roomId)
        .single();
      
      if (roomError) throw roomError;
      
      // 이미 게스트가 있는지 확인
      if (room.guest_id) {
        alert('이미 다른 플레이어가 참여한 방입니다.');
        return;
      }
      
      // 방에 참여 (게스트로 등록하고 동시에 게임 시작)
      const { error } = await supabase
        .from('rooms')
        .update({
          guest_id: currentPlayer.id,
          status: 'playing',
          current_turn: room.host_id, // 방장이 항상 첫 턴
          board_state: Array(room.board_size * room.board_size).fill('')
        })
        .eq('id', roomId);
      
      if (error) throw error;
      
      console.log('✅ 방 참여 및 게임 시작 성공');
      
      // 게임 화면으로 전환
      const updatedRoom = {
        ...room,
        guest_id: currentPlayer.id,
        status: 'playing',
        current_turn: room.host_id,
        board_state: Array(room.board_size * room.board_size).fill(''),
        guest: currentPlayer // 게스트 정보 추가
      };
      
      startGame(updatedRoom);
      
    } catch (error) {
      console.error('방 참여 오류:', error);
      alert('방 참여에 실패했습니다.');
    }
  }

  /**
   * 실시간 이벤트 처리 개선
   */
  function setupRealtimeSubscription() {
    // 이전 구독 해제
    if (roomSubscription) {
      try {
        roomSubscription.unsubscribe();
      } catch (e) {
        console.log('이전 구독 해제 중 오류 (무시 가능):', e);
      }
      roomSubscription = null;
    }
    
    try {
      console.log('실시간 방 목록 구독 시작...');
      
      const channelId = `rooms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      roomSubscription = supabase
        .channel(channelId)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'rooms' },
          (payload) => {
            console.log('실시간 방 목록 업데이트 수신:', payload);
            
            try {
              if (payload.eventType === 'INSERT') {
                console.log('새 방 추가:', payload.new);
                addRoomToList(payload.new);
              } else if (payload.eventType === 'UPDATE') {
                console.log('방 정보 업데이트:', payload.new);
                updateRoomInList(payload.new);
                
                // 내가 호스트인 방에 게스트가 참여한 경우
                if (currentPlayer && payload.new.host_id === currentPlayer.id && 
                    payload.new.guest_id && payload.new.status === 'playing') {
                  console.log('✅ 내 방에 게스트가 참여하고 게임이 시작되었습니다!');
                  
                  // 게스트 정보 가져오기
                  supabase
                    .from('players')
                    .select('*')
                    .eq('id', payload.new.guest_id)
                    .single()
                    .then(({ data: guest }) => {
                      const updatedRoom = {
                        ...payload.new,
                        host: currentPlayer,
                        guest: guest
                      };
                      
                      showNotification('상대방이 입장했습니다! 게임을 시작합니다.');
                      setTimeout(() => {
                        startGame(updatedRoom);
                      }, 1000);
                    });
                }
              } else if (payload.eventType === 'DELETE') {
                console.log('방 삭제:', payload.old);
                removeRoomFromList(payload.old.id);
              }
            } catch (handlerError) {
              console.error('실시간 이벤트 처리 중 오류:', handlerError);
            }
          }
        )
        .subscribe((status) => {
          console.log('방 목록 구독 상태:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ 실시간 방 목록 구독이 성공했습니다.');
          } else if (status === 'TIMED_OUT') {
            console.warn('⚠️ 구독 시간 초과, 재시도 중...');
            setTimeout(setupRealtimeSubscription, 3000);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ 채널 오류 발생, 재시도 중...');
            setTimeout(setupRealtimeSubscription, 5000);
          } else if (status === 'CLOSED') {
            console.log('🔌 구독이 닫혔습니다.');
          }
        });
      
    } catch (error) {
      console.error('❌ 실시간 구독 설정 오류:', error);
      setTimeout(setupRealtimeSubscription, 5000);
    }
  }

  // 이벤트 리스너
  if (leaveGameButton) {
    leaveGameButton.addEventListener('click', leaveGame);
  }
  
  // 게임 화면에 디버깅 도구 추가
  function addDebugTools() {
    // 이미 있으면 추가하지 않음
    if (document.getElementById('debug-tools')) return;
    
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debug-tools';
    debugContainer.style.margin = '20px 0';
    debugContainer.style.padding = '10px';
    debugContainer.style.backgroundColor = 'rgba(0,0,0,0.05)';
    debugContainer.style.borderRadius = '8px';
    
    const debugTitle = document.createElement('h3');
    debugTitle.textContent = '디버깅 도구';
    debugTitle.style.marginTop = '0';
    
    const roomIdText = document.createElement('p');
    roomIdText.textContent = `방 ID: ${currentGame?.id || 'N/A'}`;
    
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '게임 상태 새로고침';
    refreshButton.onclick = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*, host:host_id(name), guest:guest_id(name)')
          .eq('id', currentGame.id)
          .single();
        
        if (error) throw error;
        
        console.log('수동 새로고침 데이터:', data);
        updateGameState(data);
        alert('게임 상태가 새로고침되었습니다.');
      } catch (err) {
        console.error('새로고침 오류:', err);
      }
    };
    
    const reconnectButton = document.createElement('button');
    reconnectButton.textContent = '실시간 구독 재연결';
    reconnectButton.style.marginLeft = '10px';
    reconnectButton.onclick = () => {
      setupRealtimeGame();
      alert('실시간 구독이 재설정되었습니다.');
    };
    
    debugContainer.appendChild(debugTitle);
    debugContainer.appendChild(roomIdText);
    debugContainer.appendChild(refreshButton);
    debugContainer.appendChild(reconnectButton);
    
    // 게임 화면에 추가
    const gameScreenElement = document.getElementById('game-screen');
    if (gameScreenElement) {
      gameScreenElement.appendChild(debugContainer);
    }
  }

  // 게임 초기화 후 디버깅 도구 추가
  document.addEventListener('gameInitialize', () => {
    setTimeout(addDebugTools, 1500);
  });
  
  // 이미 실행되었음을 표시
  window.gameJS.initialized = true;
  console.log('Game JS 초기화 완료');
}