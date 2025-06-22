const fs = require('fs');
const path = require('path');

// HTML 파일 읽기
const htmlFilePath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

// 환경 변수 값 가져오기
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// 환경 변수 플레이스홀더 대체
htmlContent = htmlContent.replace('window.ENV_SUPABASE_URL = "";', 
  `window.ENV_SUPABASE_URL = "${supabaseUrl}";`);
htmlContent = htmlContent.replace('window.ENV_SUPABASE_ANON_KEY = "";', 
  `window.ENV_SUPABASE_ANON_KEY = "${supabaseAnonKey}";`);

// 변경된 HTML 파일 저장
fs.writeFileSync(htmlFilePath, htmlContent);

console.log('환경 변수가 HTML 파일에 적용되었습니다.');