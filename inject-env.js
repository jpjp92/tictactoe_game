const fs = require('fs');
const path = require('path');

try {
  // index.html 파일 읽기
  const indexPath = path.join(__dirname, 'index.html');
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // 환경 변수 주입
  const envScript = `
  <script>
    // 환경 변수 설정
    window.ENV_SUPABASE_URL = "${process.env.SUPABASE_URL || ''}";
    window.ENV_SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY || ''}";
  </script>
  `;
  
  // head 태그 바로 뒤에 환경 변수 스크립트 삽입
  indexContent = indexContent.replace('</head>', `${envScript}</head>`);
  
  // 수정된 파일 저장
  fs.writeFileSync(indexPath, indexContent);
  
  console.log('환경 변수가 HTML 파일에 성공적으로 주입되었습니다.');
} catch (error) {
  console.error('환경 변수 주입 중 오류 발생:', error);
  process.exit(1);
}