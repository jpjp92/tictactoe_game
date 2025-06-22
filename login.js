// Supabase 클라이언트를 전역 변수로 가져오기
const supabase = window.supabaseClient;

// DOM 요소
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const playerNameInput = document.getElementById('player-name');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const playerDisplayName = document.getElementById('player-display-name');

// 현재 로그인한 플레이어 정보
let currentPlayer = null;

/**
 * 로컬 스토리지에서 이전 로그인 정보 확인
 */
const checkExistingLogin = async () => {
  const playerJson = localStorage.getItem('tictactoe_player');
  
  if (playerJson) {
    try {
      const player = JSON.parse(playerJson);
      
      // 플레이어가 유효한지 확인
      const { data, error } = await supabase
        .from('players')
        .select()
        .eq('id', player.id)
        .single();
      
      if (data) {
        currentPlayer = data;
        showLobby();
        return true;
      } else {
        localStorage.removeItem('tictactoe_player');
      }
    } catch (e) {
      console.error('로그인 확인 오류:', e);
      localStorage.removeItem('tictactoe_player');
    }
  }
  
  return false;
};

/**
 * 플레이어 로그인/등록 처리
 */
const loginPlayer = async () => {
  const playerName = playerNameInput.value.trim();
  
  if (!playerName) {
    loginError.textContent = '이름을 입력해주세요';
    return;
  }
  
  loginButton.disabled = true;
  
  try {
    // 해당 이름의 플레이어 찾기
    let { data: existingPlayer } = await supabase
      .from('players')
      .select()
      .eq('name', playerName)
      .single();
    
    // 플레이어가 없으면 새로 생성
    if (!existingPlayer) {
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ name: playerName })
        .select()
        .single();
        
      if (error) throw error;
      currentPlayer = newPlayer;
    } else {
      currentPlayer = existingPlayer;
    }
    
    // 로컬 스토리지에 플레이어 정보 저장
    localStorage.setItem('tictactoe_player', JSON.stringify(currentPlayer));
    
    // 로비 화면으로 이동
    showLobby();
  } catch (error) {
    console.error('로그인 오류:', error);
    loginError.textContent = error.message || '로그인 과정에서 오류가 발생했습니다';
  } finally {
    loginButton.disabled = false;
  }
};

/**
 * 로비 화면으로 전환
 */
const showLobby = () => {
  playerDisplayName.textContent = currentPlayer.name;
  loginScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  
  // 로비 초기화 이벤트 발생
  const lobbyInitEvent = new CustomEvent('lobbyInitialize', { 
    detail: { player: currentPlayer } 
  });
  document.dispatchEvent(lobbyInitEvent);
};

/**
 * 로그아웃 처리
 */
const logout = () => {
  localStorage.removeItem('tictactoe_player');
  currentPlayer = null;
  loginScreen.classList.remove('hidden');
  lobbyScreen.classList.add('hidden');
};

// 이벤트 리스너
loginButton.addEventListener('click', loginPlayer);
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginPlayer();
});

// 페이지 로드 시 로그인 상태 확인
window.addEventListener('DOMContentLoaded', checkExistingLogin);

// 전역 객체에 함수 내보내기
window.getPlayer = () => currentPlayer;
window.logout = logout;