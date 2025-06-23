// 변수가 이미 정의되어 있는지 확인 후 선언
window.lobbyJS = window.lobbyJS || {};

// 이미 실행되었는지 확인
if (!window.lobbyJS.initialized) {
  // DOM 요소
  const lobbyScreen = document.getElementById('lobby-screen');
  const gameScreen = document.getElementById('game-screen');
  const roomNameInput = document.getElementById('room-name');
  const createRoomButton = document.getElementById('create-room-button');
  const roomList = document.getElementById('room-list');
  const refreshRoomsButton = document.getElementById('refresh-rooms');
  const size3x3CreateBtn = document.getElementById('size-3x3-create');
  const size5x5CreateBtn = document.getElementById('size-5x5-create');
  const playerDisplayName = document.getElementById('player-display-name');

  // 상태 변수
  let currentPlayer = null;
  let selectedBoardSize = 3;
  let roomSubscription = null;

  // Supabase 클라이언트 가져오기
  const supabase = window.supabaseClient;
  
  /**
   * 로비 초기화
   */
  document.addEventListener('lobbyInitialize', (e) => {
    currentPlayer = e.detail.player;
    
    // 사용자 이름 표시
    if (playerDisplayName) {
      playerDisplayName.textContent = currentPlayer.name;
    }
    
    loadRooms();
    setupRealtimeSubscription();
  });

  /**
   * 방 목록 불러오기
   */
  async function loadRooms() {
    try {
      roomList.innerHTML = '<p class="loading">방 목록을 불러오는 중...</p>';
      
      // Supabase가 준비되지 않은 경우 처리
      if (!supabase) {
        roomList.innerHTML = '<p class="error">서버 연결에 실패했습니다. 나중에 다시 시도해주세요.</p>';
        return;
      }
      
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select(`
          id, 
          name, 
          board_size,
          host_id,
          guest_id,
          status,
          host:host_id(name)
        `)
        .eq('status', 'waiting')  // 대기 중인 방만 가져옴
        .order('created_at', { ascending: false });  // 최신순 정렬
      
      if (error) throw error;
      
      displayRooms(rooms || []);
    } catch (error) {
      console.error('방 목록 불러오기 오류:', error);
      roomList.innerHTML = '<p class="error">방 목록을 불러오는 데 실패했습니다.</p>';
    }
  }

  /**
   * 방 목록 화면에 표시
   */
  function displayRooms(rooms) {
    if (!rooms || rooms.length === 0) {
      roomList.innerHTML = '<p>현재 참여 가능한 방이 없습니다.</p>';
      return;
    }
    
    roomList.innerHTML = '';
    
    rooms.forEach(room => {
      const roomElement = document.createElement('div');
      roomElement.className = 'room-item';
      
      roomElement.innerHTML = `
        <div class="room-info">
          <h4>${room.name}</h4>
          <span class="room-size">${room.board_size}x${room.board_size}</span>
          <span class="host-name">방장: ${room.host?.name || '알 수 없음'}</span>
        </div>
        <button class="join-button">참여</button>
      `;
      
      const joinButton = roomElement.querySelector('.join-button');
      joinButton.addEventListener('click', () => joinRoom(room.id));
      
      roomList.appendChild(roomElement);
    });
  }

  /**
   * 실시간 방 목록 구독 설정
   */
  function setupRealtimeSubscription() {
    // 이전 구독이 있으면 해제
    if (roomSubscription) {
      try {
        roomSubscription.unsubscribe();
        console.log('이전 구독이 해제되었습니다.');
      } catch (e) {
        console.log('이전 구독 해제 중 오류 (무시 가능):', e);
      }
      roomSubscription = null;
    }
    
    try {
      console.log('실시간 방 목록 구독 시작...');
      
      // 고유한 채널 ID 생성
      const channelId = `rooms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      roomSubscription = supabase
        .channel(channelId)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'rooms'
          },
          (payload) => {
            console.log('실시간 방 목록 업데이트 수신:', payload);
            
            try {
              // payload.eventType에 따라 처리
              if (payload.eventType === 'INSERT') {
                console.log('새 방 추가:', payload.new);
                addRoomToList(payload.new);
              } else if (payload.eventType === 'UPDATE') {
                console.log('방 정보 업데이트:', payload.new);
                updateRoomInList(payload.new);
                
                // 내가 참여중인 방인 경우 - 상대방이 참여했으면 알림
                if (currentGame && currentGame.id === payload.new.id) {
                  if (payload.new.guest_id && !currentGame.guest_id) {
                    console.log('상대방이 입장했습니다!', payload.new);
                    currentGame = payload.new; // 게임 상태 업데이트
                    
                    // 게임 시작 알림
                    showNotification('상대방이 입장했습니다! 게임을 시작합니다.');
                    
                    // 잠시 후 게임 화면으로 전환
                    setTimeout(() => {
                      startGame(payload.new);
                    }, 1000);
                  }
                }
                
                // 내가 초대받은 방인 경우 - 게임 상태 변경
                if (payload.new.guest_id === currentPlayer.id && payload.new.status === 'playing') {
                  console.log('게임이 시작되었습니다.', payload.new);
                  currentGame = payload.new; // 게임 상태 업데이트
                  startGame(payload.new);
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
            setTimeout(() => {
              setupRealtimeSubscription();
            }, 3000);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ 채널 오류 발생, 재시도 중...');
            setTimeout(() => {
              setupRealtimeSubscription();
            }, 5000);
          } else if (status === 'CLOSED') {
            console.log('🔌 구독이 닫혔습니다.');
          }
        });
      
    } catch (error) {
      console.error('❌ 실시간 구독 설정 오류:', error);
      
      // 오류 발생 시 재시도
      setTimeout(() => {
        console.log('🔄 실시간 구독 재시도...');
        setupRealtimeSubscription();
      }, 5000);
    }
  }

  /**
   * 알림 표시 함수
   */
  function showNotification(message) {
    // 기존 알림이 있으면 제거
    const existingNotification = document.getElementById('game-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.id = 'game-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-weight: bold;
      animation: slideDown 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // CSS 애니메이션 추가
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (notification) {
        notification.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  /**
   * 방 목록에서 특정 방 정보 업데이트
   */
  function updateRoomInList(room) {
    // 방 목록에서 해당 ID의 방 찾기
    const roomElement = document.querySelector(`.room-item[data-id="${room.id}"]`);
    
    if (roomElement) {
      // 방 상태가 'waiting'이고 주인이 내가 아닌 경우에만 참여 가능
      const isMyRoom = room.host_id === currentPlayer.id;
      const canJoin = room.status === 'waiting' && !isMyRoom && !room.guest_id;
      const hasGuest = !!room.guest_id;
      const joinButton = roomElement.querySelector('.join-button');
      
      // 이미 게스트가 있으면 버튼 비활성화
      if (joinButton) {
        if (hasGuest) {
          joinButton.textContent = '진행 중';
          joinButton.disabled = true;
          joinButton.classList.add('in-progress');
        } else {
          joinButton.disabled = false;
          joinButton.textContent = '참여';
          joinButton.classList.remove('in-progress');
        }
      }
      
      // 상태 텍스트 업데이트
      const statusElement = roomElement.querySelector('.room-status');
      if (statusElement) {
        statusElement.textContent = hasGuest ? '진행 중' : '대기 중';
        statusElement.className = `room-status ${hasGuest ? 'in-progress' : 'waiting'}`;
      }
    } else {
      // 방이 목록에 없으면 추가
      addRoomToList(room);
    }
  }

  /**
   * 새 방 생성
   */
  async function createRoom() {
    try {
      const roomName = roomNameInput.value.trim();
      
      if (!roomName) {
        alert('방 이름을 입력해주세요.');
        return;
      }
      
      if (!currentPlayer || !currentPlayer.id) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      createRoomButton.disabled = true;
      console.log('방 생성 시도:', { roomName, boardSize: selectedBoardSize, playerId: currentPlayer.id });
      
      // 빈 보드 상태 생성 (배열 형식으로)
      const emptyBoardState = Array(selectedBoardSize * selectedBoardSize).fill('');
      
      const newRoom = {
        name: roomName,
        board_size: selectedBoardSize,
        host_id: currentPlayer.id,
        current_turn: currentPlayer.id,
        status: 'waiting',
        board_state: emptyBoardState,
        created_at: new Date().toISOString()
      };
      
      console.log('Supabase에 전송할 데이터:', newRoom);
      
      const { data: room, error } = await supabase
        .from('rooms')
        .insert(newRoom)
        .select()
        .single();
      
      if (error) {
        console.error('방 생성 중 Supabase 오류:', error);
        throw error;
      }
      
      console.log('방 생성 성공:', room);
      
      // 방 생성 성공 후 입장
      joinRoom(room.id);
      
    } catch (error) {
      console.error('방 생성 오류:', error);
      alert('방 생성에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      createRoomButton.disabled = false;
    }
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
   * 게임 시작
   */
  function startGame(room) {
    // 구독 해제 (게임 화면으로 이동)
    if (roomSubscription) {
      roomSubscription.unsubscribe();
      roomSubscription = null;
    }
    
    // 화면 전환
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    console.log('화면 전환 완료:', {
      lobbyHidden: lobbyScreen.classList.contains('hidden'),
      gameVisible: !gameScreen.classList.contains('hidden')
    });
    
    // 게임 초기화 이벤트 발생
    const gameInitEvent = new CustomEvent('gameInitialize', { 
      detail: { room, player: currentPlayer } 
    });
    document.dispatchEvent(gameInitEvent);
  }

  /**
   * 보드 크기 변경
   */
  function setBoardSize(size) {
    selectedBoardSize = size;
    size3x3CreateBtn.classList.toggle('active', size === 3);
    size5x5CreateBtn.classList.toggle('active', size === 5);
  }

  // 페이지 언로드 시 구독 정리
  window.addEventListener('beforeunload', () => {
    if (roomSubscription) {
      roomSubscription.unsubscribe();
      roomSubscription = null;
    }
  });

  // 이벤트 리스너 설정
  // 버튼에 이벤트 리스너 추가
  if (createRoomButton) {
    createRoomButton.addEventListener('click', createRoom);
  }
  
  if (refreshRoomsButton) {
    refreshRoomsButton.addEventListener('click', loadRooms);
  }
  
  if (size3x3CreateBtn) {
    size3x3CreateBtn.addEventListener('click', () => {
      selectedBoardSize = 3;
      size3x3CreateBtn.classList.add('active');
      size5x5CreateBtn.classList.remove('active');
    });
  }
  
  if (size5x5CreateBtn) {
    size5x5CreateBtn.addEventListener('click', () => {
      selectedBoardSize = 5;
      size5x5CreateBtn.classList.add('active');
      size3x3CreateBtn.classList.remove('active');
    });
  }
  
  // 이미 실행되었음을 표시
  window.lobbyJS.initialized = true;
  console.log('Lobby JS 초기화 완료');
}