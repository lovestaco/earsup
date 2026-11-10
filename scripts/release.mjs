// npm run release: bump the patch version (manifest + package.json), build,
// and copy dist/ to the folder Chrome loads EarsUp from.
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

// Where Chrome loads EarsUp from. Set EARSUP_INSTALL_DIR, or on WSL it
// defaults to <Windows user folder>/Downloads/EarsUp.
function windowsDownloads() {
  try {
    const profile = execSync('/mnt/c/Windows/System32/cmd.exe /c echo %USERPROFILE%', { cwd: '/mnt/c', stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return execSync(`wslpath -u '${profile}'`).toString().trim() + '/Downloads/EarsUp';
  } catch {
    return null; // not on WSL
  }
}
const target = process.env.EARSUP_INSTALL_DIR || windowsDownloads();
if (!target) {
  console.log('Built dist/. Set EARSUP_INSTALL_DIR to also copy it to the folder Chrome loads.');
} else if (existsSync(target.split('/').slice(0, -1).join('/'))) {
  rmSync(target, { recursive: true, force: true });
  cpSync('dist', target, { recursive: true });
  console.log(`Copied to ${target}. Reload EarsUp in chrome://extensions.`);
}
