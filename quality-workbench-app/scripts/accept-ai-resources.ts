/**
 * Static acceptance checks for AI resources merge (no server required).
 * Run: npx tsx scripts/accept-ai-resources.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const failures: string[] = [];

function walk(dir: string, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(root);
const banned = [
  /ai_resource_session/,
  /\/api\/resources(?!\/)/,
  /\/api\/review-requests/,
  /from ['"]@\/lib\/session['"]/,
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of banned) {
    if (pattern.test(text) && !file.includes(`${path.sep}modules${path.sep}ai-resources${path.sep}`)) {
      // allow mentions inside comments in migration scripts only under scripts/
      failures.push(`${path.relative(process.cwd(), file)} matches ${pattern}`);
    }
  }
}

const constantsPath = path.join(root, 'platform', 'auth', 'constants.ts');
const constants = fs.readFileSync(constantsPath, 'utf8');
if (!constants.includes("DEFAULT_AFTER_LOGIN = '/portal'")) {
  failures.push('DEFAULT_AFTER_LOGIN is not /portal');
}

const entryFiles = [
  'app/page.tsx',
  'app/login/page.tsx',
  'app/login/quick-login-bar.tsx',
  'app/api/auth/login/route.ts',
  'app/api/auth/dingtalk/callback/route.ts',
].map((p) => path.join(root, p));

for (const file of entryFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('DEFAULT_AFTER_LOGIN')) {
    failures.push(`${path.relative(process.cwd(), file)} missing DEFAULT_AFTER_LOGIN`);
  }
}

if (!fs.existsSync(path.join(process.cwd(), 'src/app/(portal)/portal/page.tsx'))) {
  failures.push('missing /portal page');
}
if (!fs.existsSync(path.join(process.cwd(), 'src/app/(ai-resources)/ai-resources/page.tsx'))) {
  failures.push('missing /ai-resources page');
}

if (failures.length) {
  console.error('ACCEPTANCE FAILED');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log('ACCEPTANCE OK');
console.log('- DEFAULT_AFTER_LOGIN=/portal on 5 entry points');
console.log('- no legacy portal session/API paths in src');
console.log('- portal + ai-resources routes present');
console.log('Manual remaining: ENABLED gate UI, login smoke, approve/archive/last-admin concurrency');
