/* 멀티플레이어 관련 스타일 */

/* 화면 전환용 클래스 */
.hidden {
  display: none !important;
}

.screen {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

/* 로그인 화면 스타일 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 300px;
  margin: 20px auto;
}

input {
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.error {
  color: #ef4444;
  font-size: 0.9rem;
}

/* 로비 화면 스타일 */
.lobby-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 20px;
}

.create-room {
  background: rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.room-list-container {
  background: rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.room-list {
  flex-grow: 1;
  overflow-y: auto;
  max-height: 300px;
}

.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 10px;
  margin-bottom: 10px;
}

.room-info {
  flex-grow: 1;
}

.room-info h4 {
  margin: 0 0 5px;
  font-size: 1rem;
}

.room-size, .host-name {
  font-size: 0.85rem;
  color: #4b5563;
  margin-right: 10px;
}

.join-button {
  padding: 6px 12px;
  font-size: 0.9rem;
  margin-top: 0;
}

/* 게임 화면 플레이어 정보 */
.player-info {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 15px;
}

.player {
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s;
}

.player.active {
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
  transform: scale(1.05);
}

.player.winner {
  background: linear-gradient(to right, #fef9c3, #fcd34d);
  box-shadow: 0 0 20px rgba(252, 211, 77, 0.5);
}

/* 반응형 스타일 */
@media (max-width: 600px) {
  .lobby-actions {
    grid-template-columns: 1fr;
  }
  
  .room-list {
    max-height: 200px;
  }
}

/* 스크립트 관련 스타일 */
<script type="module">
  import { supabase } from './supabase.js';
  import { getPlayer } from './login.js';

  // DOM 요소
  const lobbyScreen = document.getElementById('lobby-screen');
  const gameScreen = document.getElementById('game-screen');
  const roomNameInput = document.getElementById('room-name');
  const createRoomButton = document.getElementById('create-room-button');
  const roomList = document.getElementById('room-list');
  const refreshRoomsButton = document.getElementById('refresh-rooms');
  const size3x3CreateBtn = document.getElementById('size-3x3-create');
  const size5x5CreateBtn = document.getElementById('size-5x5-create');

  // 상태 변수
  let currentPlayer = null;
  let selectedBoardSize = 3;  // 기본 보드 크기는 3x3

  // 로비 초기화
  document.addEventListener('lobbyInitialize', (e) => {
    currentPlayer = e.detail.player;
    loadRooms();
    setupRealtimeSubscription();
  });

  // 방 목록 로드
  async function loadRooms() {
    // ... 기존 코드 유지 ...
  }

  // 실시간 구독 설정
  function setupRealtimeSubscription() {
    // ... 기존 코드 유지 ...
  }

  // 방 생성
  createRoomButton.addEventListener('click', async () => {
    const roomName = roomNameInput.value.trim();
    if (!roomName) return;

    // 방 생성 로직
    // ... 기존 코드 유지 ...
  });

  // 방 목록 새로 고침
  refreshRoomsButton.addEventListener('click', () => {
    loadRooms();
  });

  // 3x3 보드 크기 선택
  size3x3CreateBtn.addEventListener('click', () => {
    selectedBoardSize = 3;
    // 버튼 스타일 업데이트
    size3x3CreateBtn.classList.add('active');
    size5x5CreateBtn.classList.remove('active');
  });

  // 5x5 보드 크기 선택
  size5x5CreateBtn.addEventListener('click', () => {
    selectedBoardSize = 5;
    // 버튼 스타일 업데이트
    size5x5CreateBtn.classList.add('active');
    size3x3CreateBtn.classList.remove('active');
  });
</script>