// 개발/배포 환경에 따른 Supabase 설정
let SUPABASE_URL;
let SUPABASE_ANON_KEY;

// GitHub에 키를 노출하지 않고 환경에 따라 설정
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // 로컬 개발 환경 - config.js에서 설정 가져오기
  const config = window.supabaseConfig || {};
  SUPABASE_URL = config.SUPABASE_URL || '';
  SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || '';
  
  console.log('로컬 개발 환경에서 실행 중입니다.');
} else {
  // 배포 환경 - Vercel 환경 변수
  SUPABASE_URL = window.ENV_SUPABASE_URL || '';
  SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || '';
  
  // 환경 변수가 플레이스홀더인 경우 처리
  if (SUPABASE_URL === '__SUPABASE_URL__' || SUPABASE_URL.includes('{{')) {
    console.error('환경 변수가 제대로 설정되지 않았습니다.');
    SUPABASE_URL = '';
  }
  
  if (SUPABASE_ANON_KEY === '__SUPABASE_ANON_KEY__' || SUPABASE_ANON_KEY.includes('{{')) {
    console.error('환경 변수가 제대로 설정되지 않았습니다.');
    SUPABASE_ANON_KEY = '';
  }
}

// 설정 확인
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 설정이 없습니다. config.js 파일 또는 환경 변수를 확인하세요.');
}

// URL 유효성 검사와 수정
try {
  // 하드코딩된 기본값은 제거하고, 대신 오류 메시지 표시
  if (!SUPABASE_URL || SUPABASE_URL === '') {
    throw new Error('유효한 Supabase URL이 설정되지 않았습니다');
  }
  
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === '') {
    throw new Error('유효한 Supabase Anon Key가 설정되지 않았습니다');
  }

  // URL이 유효한지 확인 (프로토콜 포함 여부)
  if (!SUPABASE_URL.startsWith('http')) {
    SUPABASE_URL = 'https://' + SUPABASE_URL;
  }
  
  // 유효한 URL인지 테스트
  new URL(SUPABASE_URL);
  
  // Supabase 클라이언트 생성
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // 전역 변수로 내보내기
  window.supabaseClient = supabase;
  console.log('Supabase 클라이언트가 성공적으로 초기화되었습니다.');
} catch (error) {
  console.error('Supabase 클라이언트 생성 오류:', error);
  
  // 오류 메시지를 UI에 표시
  const loginError = document.getElementById('login-error');
  if (loginError) {
    loginError.textContent = '서버 연결에 문제가 있습니다. 나중에 다시 시도해주세요.';
  }
  
  window.supabaseClient = null;
}