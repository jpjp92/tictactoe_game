const fs = require('fs');

const indexHtml = fs.readFileSync('src/index.html', 'utf8');

const env = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
};

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('Missing environment variables:', env);
  process.exit(1);
}

const replacedHtml = indexHtml
  .replace('${VITE_SUPABASE_URL}', env.VITE_SUPABASE_URL)
  .replace('${VITE_SUPABASE_ANON_KEY}', env.VITE_SUPABASE_ANON_KEY);

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}
fs.writeFileSync('dist/index.html', replacedHtml);