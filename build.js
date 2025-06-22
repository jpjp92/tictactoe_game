const fs = require('fs');
const path = require('path');

try {
  console.log('빌드 프로세스 시작...');
  
  // public 디렉토리 생성
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  console.log('public 디렉토리 준비 완료');

  // 기존 파일 삭제
  fs.readdirSync(publicDir).forEach(file => {
    fs.unlinkSync(path.join(publicDir, file));
  });

  // 주요 파일 목록
  const filesToCopy = [
    'index.html',
    'style.css',
    'supabase.js',
    'login.js',
    'lobby.js',
    'game.js'
  ];
  
  // 파일 복사
  filesToCopy.forEach(file => {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(publicDir, file);
    
    if (fs.existsSync(sourcePath)) {
      // HTML 파일의 경우 환경 변수 주입
      if (file === 'index.html') {
        let content = fs.readFileSync(sourcePath, 'utf8');
        
        // 환경 변수 가져오기
        const supabaseUrl = process.env.SUPABASE_URL || 'https://axpvmgndefueicehdetu.supabase.co';
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
        
        // 환경 변수 주입
        content = content.replace('window.ENV_SUPABASE_URL = "__SUPABASE_URL__"', `window.ENV_SUPABASE_URL = "${supabaseUrl}"`);
        content = content.replace('window.ENV_SUPABASE_ANON_KEY = "__SUPABASE_ANON_KEY__"', `window.ENV_SUPABASE_ANON_KEY = "${supabaseAnonKey}"`);
        
        fs.writeFileSync(destPath, content);
        console.log(`${file} 파일이 환경 변수와 함께 복사됨`);
      } else {
        // 다른 파일들은 그대로 복사
        fs.copyFileSync(sourcePath, destPath);
        console.log(`${file} 파일이 복사됨`);
      }
    } else {
      console.warn(`${file} 파일을 찾을 수 없음`);
    }
  });
  
  console.log('빌드 완료!');
} catch (error) {
  console.error('빌드 중 오류 발생:', error);
  process.exit(1);
}

// build.js에 추가
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('필수 환경 변수가 설정되지 않았습니다!');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '설정됨' : '없음');
  console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '설정됨' : '없음');
  process.exit(1);
}