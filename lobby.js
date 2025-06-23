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
          created_at,
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
          { event: '*', schema: 'public', table: 'rooms' },
          (payload) => {
            console.log('📡 실시간 방 목록 업데이트 수신:', payload);
            
            try {
              if (payload.eventType === 'INSERT') {
                console.log('➕ 새 방 추가:', payload.new);
                addRoomToList(payload.new);
              } else if (payload.eventType === 'UPDATE') {
                console.log('🔄 방 정보 업데이트:', payload.new);
                
                // 데이터 유효성 검증
                if (payload.new.host_id === payload.new.guest_id && payload.new.guest_id) {
                  console.error('🚨 실시간 데이터 오류: 방장과 게스트가 동일합니다!', payload.new);
                  return; // 잘못된 데이터는 처리하지 않음
                }
                
                updateRoomInList(payload.new);
                
                // 내가 호스트인 방에 게스트가 참여한 경우
                if (currentPlayer && 
                    payload.new.host_id === currentPlayer.id && 
                    payload.new.guest_id && 
                    payload.new.guest_id !== currentPlayer.id && // 게스트가 나와 다른 사람인지 확인
                    payload.new.status === 'playing') {
                  
                  console.log('🎉 내 방에 게스트가 참여하고 게임이 시작되었습니다!');
                  
                  // 게스트 정보 가져오기
                  supabase
                    .from('players')
                    .select('*')
                    .eq('id', payload.new.guest_id)
                    .single()
                    .then(({ data: guest, error: guestError }) => {
                      if (guestError) {
                        console.error('게스트 정보 조회 오류:', guestError);
                        return;
                      }
                      
                      const updatedRoom = {
                        ...payload.new,
                        host: currentPlayer,
                        guest: guest
                      };
                      
                      console.log('🎮 호스트로 게임 시작:', {
                        '방 ID': updatedRoom.id,
                        '방장': currentPlayer.name,
                        '게스트': guest.name
                      });
                      
                      showNotification(`${guest.name}님이 입장했습니다! 게임을 시작합니다.`);
                      setTimeout(() => {
                        startGame(updatedRoom);
                      }, 1000);
                    });
                }
              } else if (payload.eventType === 'DELETE') {
                console.log('🗑️ 방 삭제:', payload.old);
                removeRoomFromList(payload.old.id);
              }
            } catch (handlerError) {
              console.error('❌ 실시간 이벤트 처리 중 오류:', handlerError);
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
   * 방 목록에 새 방 추가
   */
  function addRoomToList(room) {
    // 이미 존재하는 방인지 확인
    const existingRoom = document.querySelector(`.room-item[data-id="${room.id}"]`);
    if (existingRoom) {
      // 이미 존재하면 업데이트
      updateRoomInList(room);
      return;
    }
    
    // 대기 중인 방만 표시
    if (room.status !== 'waiting') {
      return;
    }
    
    const roomElement = document.createElement('div');
    roomElement.className = 'room-item';
    roomElement.setAttribute('data-id', room.id);
    
    // 내가 만든 방인지 확인
    const isMyRoom = room.host_id === currentPlayer.id;
    const canJoin = !isMyRoom && !room.guest_id;
    
    roomElement.innerHTML = `
      <div class="room-info">
        <h4>${room.name}</h4>
        <span class="room-size">${room.board_size}x${room.board_size}</span>
        <span class="host-name">방장: ${room.host?.name || '알 수 없음'}</span>
        <span class="room-status ${room.guest_id ? 'in-progress' : 'waiting'}">
          ${room.guest_id ? '진행 중' : '대기 중'}
        </span>
      </div>
      <button class="join-button ${isMyRoom ? 'my-room' : ''}" ${!canJoin ? 'disabled' : ''}>
        ${isMyRoom ? '내 방' : (room.guest_id ? '진행 중' : '참여')}
      </button>
    `;
    
    const joinButton = roomElement.querySelector('.join-button');
    if (canJoin) {
      joinButton.addEventListener('click', () => joinRoom(room.id));
    }
    
    // 방 목록의 맨 앞에 추가 (최신 방이 위에 오도록)
    if (roomList.firstChild && !roomList.firstChild.classList?.contains('loading')) {
      roomList.insertBefore(roomElement, roomList.firstChild);
    } else {
      roomList.appendChild(roomElement);
    }
    
    // 로딩 메시지가 있으면 제거
    const loadingMessage = roomList.querySelector('.loading, .error');
    if (loadingMessage) {
      loadingMessage.remove();
    }
  }

  /**
   * 방 목록에서 특정 방 제거
   */
  function removeRoomFromList(roomId) {
    const roomElement = document.querySelector(`.room-item[data-id="${roomId}"]`);
    if (roomElement) {
      roomElement.remove();
      console.log('방 목록에서 제거됨:', roomId);
    }
    
    // 방 목록이 비어있으면 메시지 표시
    if (roomList.children.length === 0) {
      roomList.innerHTML = '<p>현재 참여 가능한 방이 없습니다.</p>';
    }
  }

  /**
   * 새 방 생성
   */
  async function createRoom() {
    // DOM 요소 안전하게 가져오기
    const roomNameElement = document.getElementById('room-name');
    const boardSizeElement = document.getElementById('board-size');
    
    // 요소가 존재하는지 확인
    if (!roomNameElement) {
      console.error('❌ room-name 요소를 찾을 수 없습니다.');
      alert('방 이름 입력 필드를 찾을 수 없습니다.');
      return;
    }
    
    if (!boardSizeElement) {
      console.error('❌ board-size 요소를 찾을 수 없습니다.');
      console.log('선택된 보드 크기 사용:', selectedBoardSize);
    }
    
    const roomName = roomNameElement.value.trim();
    const boardSize = boardSizeElement ? parseInt(boardSizeElement.value) : selectedBoardSize;
    
    if (!roomName) {
      alert('방 이름을 입력해주세요.');
      roomNameElement.focus();
      return;
    }
    
    // 보드 크기 유효성 검사
    if (![3, 5].includes(boardSize)) {
      console.error('❌ 유효하지 않은 보드 크기:', boardSize);
      alert('보드 크기는 3x3 또는 5x5만 가능합니다.');
      return;
    }
    
    try {
      console.log('🏠 방 생성 시도:', {
        '방 이름': roomName,
        '보드 크기': boardSize,
        '방장 ID': currentPlayer.id,
        '방장 이름': currentPlayer.name
      });
      
      // 안전한 데이터 생성 함수 사용
      const roomData = createSafeRoomData(roomName, boardSize, currentPlayer.id);
      
      console.log('📝 방 생성 데이터:', roomData);
      
      const { data: newRoom, error } = await supabase
        .from('rooms')
        .insert([roomData])
        .select('*')
        .single();
      
      if (error) {
        console.error('방 생성 오류:', error);
        throw error;
      }
      
      console.log('✅ 방 생성 성공:', newRoom);
      
      // 입력 필드 초기화
      roomNameElement.value = '';
      
      // 🎯 방 생성 후 방장이 바로 대기실로 입장
      const hostRoom = {
        ...newRoom,
        host: currentPlayer,
        guest: null // 아직 게스트 없음
      };
      
      console.log('🎮 방장으로 대기실 입장:', {
        '방 ID': hostRoom.id,
        '방 이름': hostRoom.name,
        '방장': currentPlayer.name,
        '상태': hostRoom.status
      });
      
      alert(`방 "${roomName}"이 생성되었습니다! 상대방을 기다리는 중...`);
      
      // 게임 화면으로 전환 (대기 모드)
      startGameAsHost(hostRoom);
      
    } catch (error) {
      console.error('❌ 방 생성 오류:', error);
      alert('방 생성에 실패했습니다: ' + error.message);
    }
  }

  /**
   * 방 참여 처리
   */
  async function joinRoom(roomId) {
    try {
      console.log('🔗 방 참여 시도:', {
        '방 ID': roomId,
        '현재 플레이어 ID': currentPlayer.id,
        '현재 플레이어 이름': currentPlayer.name
      });
      
      // 방 정보 먼저 가져오기
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      if (roomError) {
        console.error('방 정보 조회 오류:', roomError);
        throw roomError;
      }
      
      console.log('📋 방 정보 확인:', {
        '방 ID': room.id,
        '방 이름': room.name,
        '방장 ID': room.host_id,
        '게스트 ID': room.guest_id,
        '상태': room.status,
        '현재 플레이어 ID': currentPlayer.id
      });
      
      // 내가 이미 방장인지 확인
      if (room.host_id === currentPlayer.id) {
        console.error('❌ 이미 내가 방장인 방에는 게스트로 참여할 수 없습니다.');
        alert('자신이 만든 방에는 참여할 수 없습니다.');
        return;
      }
      
      // 이미 게스트가 있는지 확인
      if (room.guest_id && room.guest_id !== currentPlayer.id) {
        console.error('❌ 이미 다른 플레이어가 참여한 방입니다.');
        alert('이미 다른 플레이어가 참여한 방입니다.');
        return;
      }
      
      // 게임이 이미 진행 중인지 확인
      if (room.status === 'playing' && room.guest_id && room.guest_id !== currentPlayer.id) {
        console.error('❌ 이미 게임이 진행 중인 방입니다.');
        alert('이미 게임이 진행 중인 방입니다.');
        return;
      }
      
      console.log('✅ 방 참여 가능 확인 완료');
      
      // 안전한 업데이트 데이터 생성
      const updateData = createSafeUpdateData({
        guest_id: currentPlayer.id,
        status: 'playing',
        current_turn: room.host_id, // 방장이 항상 첫 턴
        board_state: Array(room.board_size * room.board_size).fill('')
      });

      console.log('🔄 방 업데이트 데이터:', updateData);
      
      const { data: updatedRoom, error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId)
        .eq('host_id', room.host_id) // 방장이 바뀌지 않았는지 확인
        .select('*')
        .single();
      
      if (error) {
        console.error('방 업데이트 오류:', error);
        throw error;
      }
      
      console.log('✅ 방 참여 및 게임 시작 성공:', updatedRoom);
      
      // 방장과 게스트 정보 가져오기
      const { data: hostPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('id', updatedRoom.host_id)
        .single();
    
      // 게임 화면으로 전환
      const gameRoom = {
        ...updatedRoom,
        host: hostPlayer,
        guest: currentPlayer
      };
      
      console.log('🎮 게임 시작 데이터:', {
        '방 ID': gameRoom.id,
        '방장 ID': gameRoom.host_id,
        '방장 이름': gameRoom.host?.name,
        '게스트 ID': gameRoom.guest_id,
        '게스트 이름': gameRoom.guest?.name,
        '현재 턴': gameRoom.current_turn,
        '상태': gameRoom.status
      });
      
      startGame(gameRoom);
      
    } catch (error) {
      console.error('❌ 방 참여 오류:', error);
      alert('방 참여에 실패했습니다: ' + error.message);
    }
  }

  /**
   * 방장으로 게임 시작 (게스트 대기 모드)
   */
  function startGameAsHost(room) {
    // 구독 해제 (게임 화면으로 이동)
    if (roomSubscription) {
      roomSubscription.unsubscribe();
      roomSubscription = null;
    }
    
    // 화면 전환
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    console.log('방장으로 화면 전환 완료:', {
      lobbyHidden: lobbyScreen.classList.contains('hidden'),
      gameVisible: !gameScreen.classList.contains('hidden')
    });
    
    // 게임 초기화 이벤트 발생 (방장 모드)
    const gameInitEvent = new CustomEvent('gameInitialize', { 
      detail: { 
        room, 
        player: currentPlayer,
        isHost: true,
        waitingForGuest: true
      } 
    });
    document.dispatchEvent(gameInitEvent);
  }

  /**
   * 게임 시작 (게스트용 - 기존 함수)
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
    
    console.log('게스트로 화면 전환 완료:', {
      lobbyHidden: lobbyScreen.classList.contains('hidden'),
      gameVisible: !gameScreen.classList.contains('hidden')
    });
    
    // 게임 초기화 이벤트 발생 (게스트 모드)
    const gameInitEvent = new CustomEvent('gameInitialize', { 
      detail: { 
        room, 
        player: currentPlayer,
        isHost: false,
        waitingForGuest: false
      } 
    });
    document.dispatchEvent(gameInitEvent);
  }

  /**
   * 보드 크기 변경
   */
  function setBoardSize(size) {
    selectedBoardSize = size;
    
    // 안전하게 요소 확인
    if (size3x3CreateBtn) {
      size3x3CreateBtn.classList.toggle('active', size === 3);
    }
    if (size5x5CreateBtn) {
      size5x5CreateBtn.classList.toggle('active', size === 5);
    }
    
    // board-size select 요소가 있으면 업데이트
    const boardSizeElement = document.getElementById('board-size');
    if (boardSizeElement) {
      boardSizeElement.value = size;
    }
    
    console.log('보드 크기 설정됨:', size);
  }

  /**
   * 안전한 방 데이터 생성 (테이블 스키마에 맞춤)
   */
  function createSafeRoomData(roomName, boardSize, hostId) {
    return {
      name: roomName,
      host_id: hostId,
      guest_id: null,
      board_size: boardSize,
      status: 'waiting',
      current_turn: null,
      board_state: Array(boardSize * boardSize).fill(''),
      winner_id: null
      // created_at은 자동 생성되므로 포함하지 않음
    };
  }

  /**
   * 안전한 방 업데이트 데이터 생성
   */
  function createSafeUpdateData(updates) {
    const allowedFields = [
      'name', 'board_size', 'host_id', 'guest_id', 
      'current_turn', 'status', 'board_state', 'winner_id'
    ];
    
    const safeData = {};
    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        safeData[field] = updates[field];
      }
    }
    
    return safeData;
  }

  /**
   * 디버깅: 테이블 구조 확인
   */
  async function debugTableStructure() {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        console.log('🔍 rooms 테이블 구조 (샘플 데이터):', Object.keys(data[0]));
      } else {
        console.log('📝 rooms 테이블이 비어있습니다.');
      }
    } catch (error) {
      console.error('테이블 구조 확인 오류:', error);
    }
  }

  // 개발 모드에서만 실행
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    debugTableStructure();
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
  } else {
    console.warn('⚠️ create-room-button 요소를 찾을 수 없습니다.');
  }

  if (refreshRoomsButton) {
    refreshRoomsButton.addEventListener('click', loadRooms);
    refreshRoomsButton.addEventListener('click', loadRooms);
  } else {
    console.warn('⚠️ refresh-rooms 요소를 찾을 수 없습니다.');
  }

  if (size3x3CreateBtn) {
    size3x3CreateBtn.addEventListener('click', () => {
      setBoardSize(3);
    });
  } else {
    console.warn('⚠️ size-3x3-create 요소를 찾을 수 없습니다.');
  }

  if (size5x5CreateBtn) {
    size5x5CreateBtn.addEventListener('click', () => {
      setBoardSize(5);
    });
  } else {
    console.warn('⚠️ size-5x5-create 요소를 찾을 수 없습니다.');
  }

  // 초기 보드 크기 설정
  setBoardSize(3);

  // 이미 실행되었음을 표시
  window.lobbyJS.initialized = true;
  console.log('Lobby JS 초기화 완료');
}