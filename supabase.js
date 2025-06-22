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
  // 배포 환경 - 환경 변수 또는 기본값
  SUPABASE_URL = window.ENV_SUPABASE_URL || '';
  SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || '';
  
  if (SUPABASE_URL === '__SUPABASE_URL__' || SUPABASE_URL.includes('{{') || !SUPABASE_URL) {
    console.log('기본 Supabase URL을 사용합니다.');
    SUPABASE_URL = "https://axpvmgndefueicehdetu.supabase.co";
  }
  
  if (SUPABASE_ANON_KEY === '__SUPABASE_ANON_KEY__' || SUPABASE_ANON_KEY.includes('{{') || !SUPABASE_ANON_KEY) {
    console.log('기본 Supabase Anon Key를 사용합니다.');
    SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cHZtZ25kZWZ1ZWljZWhkZXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMDI2MjYsImV4cCI6MjA0OTU3ODYyNn0.9fOKvYNUWWX4JxYHvW4-iHQ5UkuglEhM3b8l1OC4A9Q";
  }
}

// URL 유효성 검사와 수정
try {
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
  window.supabaseClient = null;
}

// supabase.js
try {
  // API 키 유효성 확인을 위한 테스트
  if (supabase) {
    // 간단한 테스트 쿼리
    supabase.from('players').select('count', { count: 'exact', head: true })
      .then(({ error }) => {
        if (error) {
          console.error('Supabase API 키 테스트 실패:', error);
          // 오류 메시지 표시
          const loginError = document.getElementById('login-error');
          if (loginError) {
            loginError.textContent = 'Supabase 연결에 문제가 있습니다. API 키를 확인하세요.';
          }
        } else {
          console.log('Supabase API 키가 유효합니다.');
        }
      });
  }
} catch (err) {
  console.error('Supabase 테스트 중 오류:', err);
}