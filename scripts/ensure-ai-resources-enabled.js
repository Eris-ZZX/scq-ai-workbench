const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (/^AI_RESOURCES_ENABLED=/m.test(content)) {
  content = content.replace(/^AI_RESOURCES_ENABLED=.*$/m, 'AI_RESOURCES_ENABLED=true');
} else {
  content = `${content.replace(/\s+$/, '')}\nAI_RESOURCES_ENABLED=true\n`;
}

fs.writeFileSync(envPath, content, 'utf8');
console.log('  .env ready (AI_RESOURCES_ENABLED=true)');
