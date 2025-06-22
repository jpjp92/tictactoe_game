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
  
  // Vercel의 환경 변수가 템플릿 문자열 그대로 있는 경우 처리
  if (SUPABASE_URL.includes('{{NEXT_PUBLIC_SUPABASE_URL}}')) {
    console.error('환경 변수가 제대로 설정되지 않았습니다.');
    SUPABASE_URL = '';
  }
  
  if (SUPABASE_ANON_KEY.includes('{{NEXT_PUBLIC_SUPABASE_ANON_KEY}}')) {
    console.error('환경 변수가 제대로 설정되지 않았습니다.');
    SUPABASE_ANON_KEY = '';
  }
}

// 설정 확인
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 설정이 없습니다. config.js 파일 또는 환경 변수를 확인하세요.');
}

// Supabase 클라이언트 생성
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// export { supabase }; 대신
window.supabaseClient = supabase;