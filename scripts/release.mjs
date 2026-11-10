// npm run release: bump the patch version (manifest + package.json), build,
// and copy dist/ to the Windows Downloads folder Chrome loads EarsUp from.
import { readFileSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = ['public/manifest.json', 'package.json'];
const manifest = JSON.parse(readFileSync(files[0], 'utf8'));
const [maj, min, patch] = manifest.version.split('.').map(Number);
const next = `${maj}.${min}.${patch + 1}`;
for (const f of files) {
  const json = JSON.parse(readFileSync(f, 'utf8'));
  json.version = next;
  writeFileSync(f, JSON.stringify(json, null, 2) + '\n');
}
console.log(`EarsUp ${manifest.version} -> ${next}`);

execSync('npm run build', { stdio: 'inherit' });

const target = process.env.EARSUP_INSTALL_DIR ?? '/mnt/c/Users/maneshwarh/Downloads/EarsUp';
if (existsSync(target.split('/').slice(0, -1).join('/'))) {
  rmSync(target, { recursive: true, force: true });
  cpSync('dist', target, { recursive: true });
  console.log(`Copied to ${target}. Reload EarsUp in chrome://extensions.`);
}
