// DOM 요소
// 이미 선언된 변수인지 확인 후 선언
if (typeof lobbyScreen === 'undefined') {
  var lobbyScreen = document.getElementById('lobby-screen');
}

if (typeof gameScreen === 'undefined') {
  var gameScreen = document.getElementById('game-screen');
}

if (typeof playerDisplayName === 'undefined') {
  var playerDisplayName = document.getElementById('player-display-name');
}

// 상태 변수
if (typeof currentPlayer === 'undefined') {
  var currentPlayer = null;
}
if (typeof selectedBoardSize === 'undefined') {
  var selectedBoardSize = 3;
}
if (typeof roomSubscription === 'undefined') {
  var roomSubscription = null;
}

// 전역 스코프에 var로 선언
if (typeof supabase === 'undefined') {
  var supabase = window.supabaseClient;
}

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
 * 실시간 방 목록 업데이트를 위한 구독 설정
 */
function setupRealtimeSubscription() {
  // 이전 구독이 있으면 해제
  if (roomSubscription) {
    roomSubscription.unsubscribe();
  }
  
  // Supabase가 준비되지 않은 경우 처리
  if (!supabase) {
    console.error('Supabase 클라이언트가 준비되지 않아 실시간 구독을 설정할 수 없습니다.');
    return;
  }
  
  try {
    roomSubscription = supabase
      .channel('room-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' }, 
        () => loadRooms()
      )
      .subscribe();
  } catch (error) {
    console.error('실시간 구독 설정 오류:', error);
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
  
  // 게임 초기화 이벤트 발생
  const gameInitEvent = new CustomEvent('gameInitialize', { 
    detail: { room, player: currentPlayer } 
  });
  document.dispatchEvent(gameInitEvent);
  
  // 화면 전환
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
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

// 이벤트 리스너
createRoomButton.addEventListener('click', createRoom);
refreshRoomsButton.addEventListener('click', loadRooms);
size3x3CreateBtn.addEventListener('click', () => setBoardSize(3));
size5x5CreateBtn.addEventListener('click', () => setBoardSize(5));
roomNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') createRoom();
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 로드됨, 요소 확인:');
  console.log('createRoomButton:', createRoomButton);
  console.log('roomNameInput:', roomNameInput);
  
  if (createRoomButton) {
    createRoomButton.addEventListener('click', () => {
      console.log('방 생성 버튼 클릭됨');
      createRoom();
    });
  }
});