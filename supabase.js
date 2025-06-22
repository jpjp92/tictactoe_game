/**
 * Supabase 클라이언트 설정 및 초기화
 * 로컬 개발 환경과 배포 환경에서 적절하게 동작하도록 설계
 * GitHub Actions secrets 및 variables 사용
 */

// 전역 객체 초기화 (중복 실행 방지)
window.supabaseUtils = window.supabaseUtils || {};

// 이미 초기화된 경우 재실행 방지
if (!window.supabaseUtils.initialized) {
  // Supabase 설정 관련 변수
  let SUPABASE_URL;
  let SUPABASE_ANON_KEY;

  // 환경에 따른 설정 분기
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 로컬 개발 환경 - config.js에서 설정 로드
    const config = window.supabaseConfig || {};
    SUPABASE_URL = config.SUPABASE_URL || '';
    SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || '';
    console.log('로컬 개발 환경에서 실행 중입니다.');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('로컬 개발 환경에서는 config.js 파일이 필요합니다.');
      console.error('config.js 파일을 생성하고 Supabase 설정을 추가해주세요.');
    }
  } else {
    // 배포 환경 - 환경 변수를 사용 (GitHub Actions secrets/variables에서 주입됨)
    SUPABASE_URL = window.ENV_SUPABASE_URL || '';
    SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || '';
    
    // 환경 변수가 플레이스홀더인 경우 오류 처리
    if (SUPABASE_URL === '__SUPABASE_URL__' || SUPABASE_URL.includes('{{') || !SUPABASE_URL) {
      console.error('GitHub Actions에서 SUPABASE_URL이 제대로 주입되지 않았습니다.');
      console.error('GitHub Repository Settings에서 Secrets 설정을 확인해주세요.');
      SUPABASE_URL = '';
    }
    
    if (SUPABASE_ANON_KEY === '__SUPABASE_ANON_KEY__' || SUPABASE_ANON_KEY.includes('{{') || !SUPABASE_ANON_KEY) {
      console.error('GitHub Actions에서 SUPABASE_ANON_KEY가 제대로 주입되지 않았습니다.');
      console.error('GitHub Repository Settings에서 Secrets 설정을 확인해주세요.');
      SUPABASE_ANON_KEY = '';
    }
  }

  // 환경 변수 상태 로깅 (값은 보안상 출력하지 않음)
  console.log('Supabase URL 설정됨:', !!SUPABASE_URL);
  console.log('Supabase Anon Key 설정됨:', !!SUPABASE_ANON_KEY);
  if (SUPABASE_URL) {
    console.log('사용 중인 Supabase URL 도메인:', SUPABASE_URL.substring(0, 30) + '...');
  }
  if (SUPABASE_ANON_KEY) {
    console.log('사용 중인 Anon Key 길이:', SUPABASE_ANON_KEY.length);
  }

  /**
   * Supabase 클라이언트 초기화
   */
  try {
    // 필수 환경 변수 확인
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다. 설정을 확인해주세요.');
    }

    // URL 형식 보정 (프로토콜 확인)
    if (SUPABASE_URL && !SUPABASE_URL.startsWith('http')) {
      SUPABASE_URL = 'https://' + SUPABASE_URL;
    }
    
    // URL 유효성 검사
    try {
      new URL(SUPABASE_URL);
    } catch (urlError) {
      console.error('Supabase URL이 유효하지 않습니다:', SUPABASE_URL);
      throw new Error('Supabase URL 형식이 올바르지 않습니다');
    }
    
    // 키 유효성 검사
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
      console.error('Supabase Anon Key가 유효하지 않습니다.');
      throw new Error('Supabase Anon Key가 올바르지 않습니다');
    }
    
    // Supabase 클라이언트 생성
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // 전역 변수로 내보내기
    window.supabaseClient = supabase;
    console.log('Supabase 클라이언트가 성공적으로 초기화되었습니다.');
    
    // 연결 테스트
    supabase.from('players').select('count', { count: 'exact', head: true })
      .then(({ error }) => {
        if (error) {
          console.error('Supabase API 연결 테스트 실패:', error);
          const loginError = document.getElementById('login-error');
          if (loginError) {
            loginError.textContent = '서버 연결에 문제가 있습니다. 나중에 다시 시도해주세요.';
          }
        } else {
          console.log('Supabase API 연결이 성공적으로 확인되었습니다.');
        }
      })
      .catch(err => {
        console.error('Supabase 연결 테스트 중 오류:', err);
      });
    
  } catch (error) {
    console.error('Supabase 클라이언트 초기화 오류:', error);
    window.supabaseClient = null;
    
    // 오류 메시지 UI 표시
    const loginError = document.getElementById('login-error');
    if (loginError) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        loginError.textContent = 'config.js 파일을 생성하고 Supabase 설정을 추가해주세요.';
      } else {
        loginError.textContent = 'Supabase 환경 설정에 문제가 있습니다. 관리자에게 문의하세요.';
      }
    }
  }

  // 유틸리티 함수 추가
  window.supabaseUtils = {
    initialized: true,
    
    // 로그인 상태 확인 함수
    isLoggedIn: async () => {
      try {
        if (!window.supabaseClient) return false;
        const { data } = await window.supabaseClient.auth.getSession();
        return !!data.session;
      } catch (error) {
        console.error('로그인 상태 확인 오류:', error);
        return false;
      }
    },
    
    // 연결 상태 확인 함수
    checkConnection: () => {
      return new Promise((resolve) => {
        if (!window.supabaseClient) {
          resolve(false);
          return;
        }
        
        window.supabaseClient.from('players').select('count', { count: 'exact', head: true })
          .then(({ error }) => {
            resolve(!error);
          })
          .catch(() => {
            resolve(false);
          });
      });
    }
  };
}