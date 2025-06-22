const fs = require('fs');
const path = require('path');

try {
  console.log('빌드 프로세스 시작...');
  
  // public 디렉토리 생성
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  } else {
    // 기존 public 디렉토리 내의 파일 삭제 (중복 방지)
    const files = fs.readdirSync(publicDir);
    for (const file of files) {
      const filePath = path.join(publicDir, file);
      fs.unlinkSync(filePath);
    }
  }
  
  // 파일 복사
  const filesToCopy = [
    'index.html',
    'style.css',
    'supabase.js',
    'login.js',
    'lobby.js',
    'game.js'
  ];
  
  console.log('파일 복사 시작...');
  for (const file of filesToCopy) {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(publicDir, file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`${file} 복사 완료`);
    } else {
      console.warn(`${file} 파일을 찾을 수 없습니다.`);
    }
  }
  
  console.log('빌드 완료!');
} catch (error) {
  console.error('빌드 오류:', error);
  process.exit(1);
}

// build.js에 추가
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('필수 환경 변수가 설정되지 않았습니다!');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '설정됨' : '없음');
  console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '설정됨' : '없음');
  process.exit(1);
}