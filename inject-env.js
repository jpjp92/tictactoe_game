const fs = require('fs');
const path = require('path');

try {
  // public 디렉토리 생성
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public', { recursive: true });
    console.log('public 디렉토리 생성됨');
  }

  // HTML 파일 읽기
  const htmlPath = path.join(__dirname, 'index.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // 환경 변수 가져오기
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('환경 변수가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_ANON_KEY를 확인하세요.');
    process.exit(1);
  }

  // 환경 변수를 HTML에 삽입
  htmlContent = htmlContent.replace('"__SUPABASE_URL__"', `"${supabaseUrl}"`);
  htmlContent = htmlContent.replace('"__SUPABASE_ANON_KEY__"', `"${supabaseAnonKey}"`);

  // public 디렉토리에 수정된 HTML 저장
  fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), htmlContent);
  
  // 다른 파일들 복사
  ['style.css', 'supabase.js', 'login.js', 'lobby.js', 'game.js'].forEach(file => {
    fs.copyFileSync(
      path.join(__dirname, file),
      path.join(__dirname, 'public', file)
    );
  });
  
  console.log('환경 변수가 HTML 파일에 성공적으로 주입되었습니다.');
  console.log('모든 파일이 public 디렉토리로 복사되었습니다.');
} catch (error) {
  console.error('환경 변수 주입 중 오류 발생:', error);
  process.exit(1);
}