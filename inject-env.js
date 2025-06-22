const fs = require('fs');
const path = require('path');

try {
  // HTML 파일 읽기
  const htmlPath = path.join(__dirname, 'index.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // 환경 변수 가져오기
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  console.log('환경 변수 확인:', {
    SUPABASE_URL_EXISTS: !!supabaseUrl,
    SUPABASE_ANON_KEY_EXISTS: !!supabaseAnonKey
  });

  // 환경 변수를 HTML에 삽입
  htmlContent = htmlContent.replace('"__SUPABASE_URL__"', `"${supabaseUrl || ''}"`);
  htmlContent = htmlContent.replace('"__SUPABASE_ANON_KEY__"', `"${supabaseAnonKey || ''}"`);

  // public 디렉토리 확인 및 생성
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 수정된 HTML을 public 디렉토리에 저장
  fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent);
  
  // 나머지 필요한 파일들 복사
  const filesToCopy = ['style.css', 'supabase.js', 'login.js', 'lobby.js', 'game.js'];
  
  filesToCopy.forEach(file => {
    try {
      const sourcePath = path.join(__dirname, file);
      const destPath = path.join(publicDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`${file} 파일이 복사되었습니다.`);
      } else {
        console.warn(`${file} 파일을 찾을 수 없습니다.`);
      }
    } catch (err) {
      console.error(`${file} 복사 중 오류:`, err);
    }
  });
  
  // config.js가 있는 경우 복사 (로컬 개발용)
  if (fs.existsSync(path.join(__dirname, 'config.js'))) {
    fs.copyFileSync(
      path.join(__dirname, 'config.js'),
      path.join(publicDir, 'config.js')
    );
  }

  console.log('빌드 프로세스가 완료되었습니다.');
} catch (error) {
  console.error('빌드 프로세스 중 오류 발생:', error);
  process.exit(1);
}