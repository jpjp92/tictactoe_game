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
    if (roomSubscription) {
      try {
        roomSubscription.unsubscribe();
      } catch (e) {
        console.log('이전 구독 해제 오류:', e);
      }
    }
    
    try {
      // 새 구독 설정
      console.log('실시간 방 목록 구독 시작...');
      roomSubscription = supabase
        .channel('rooms-channel')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'rooms' },
          (payload) => {
            console.log('실시간 방 목록 업데이트:', payload);
            
            // payload.eventType에 따라 처리
            if (payload.eventType === 'INSERT') {
              // 새 방 추가
              addRoomToList(payload.new);
            } else if (payload.eventType === 'UPDATE') {
              // 방 정보 업데이트 (상대방 입장 등)
              updateRoomInList(payload.new);
              
              // 내가 참여중인 방인 경우 - 상대방이 참여했으면 알림
              if (currentGame && currentGame.id === payload.new.id) {
                if (payload.new.guest_id && !currentGame.guest_id) {
                  console.log('상대방이 입장했습니다!', payload.new);
                  alert('상대방이 입장했습니다.');
                  
                  // 게임 시작
                  startGame(payload.new);
                }
              }
              
              // 내가 초대받은 방인 경우 - 게임 상태 변경
              if (payload.new.guest_id === currentPlayer.id && payload.new.status === 'playing') {
                console.log('게임이 시작되었습니다.', payload.new);
                
                // 게임 화면으로 전환
                startGame(payload.new);
              }
            } else if (payload.eventType === 'DELETE') {
              // 방 삭제
              removeRoomFromList(payload.old.id);
            }
          }
        )
        .subscribe((status) => {
          console.log('방 목록 구독 상태:', status);
          if (status !== 'SUBSCRIBED') {
            console.error('방 목록 구독 실패:', status);
          }
        });
    } catch (error) {
      console.error('실시간 구독 설정 오류:', error);
    }
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
   * 방 참여
   */
  async function joinRoom(roomId) {
    try {
      // Supabase가 준비되지 않은 경우 처리
      if (!supabase) {
        alert('서버 연결에 실패했습니다. 나중에 다시 시도해주세요.');
        return;
      }
      
      // 방 정보 가져오기
      const { data: room, error: fetchError } = await supabase
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
        .eq('id', roomId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // 방 상태 확인
      if (room.status !== 'waiting') {
        alert('이 방은 더 이상 참여할 수 없습니다.');
        return;
      }
      
      // 내가 방장인 경우
      if (room.host_id === currentPlayer.id) {
        startGame(room);
        return;
      }
      
      // 게스트로 참여
      const { data, error } = await supabase
        .from('rooms')
        .update({ 
          guest_id: currentPlayer.id, 
          status: 'playing' 
        })
        .eq('id', roomId)
        .select()
        .single();
      
      if (error) throw error;
      
      // 게임 시작
      startGame(data);
    } catch (error) {
      console.error('방 참여 오류:', error);
      alert('방 참여에 실패했습니다. 다시 시도해주세요.');
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