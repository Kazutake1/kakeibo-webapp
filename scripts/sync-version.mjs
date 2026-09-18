import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const requestedVersion = args.find(arg => !arg.startsWith('--'));
const versionPattern = /^\d+\.\d+\.\d+$/;

if (checkOnly && requestedVersion) {
  throw new Error('A version cannot be set while using --check.');
}
if (requestedVersion && !versionPattern.test(requestedVersion)) {
  throw new Error(`Invalid version: ${requestedVersion}. Use x.y.z format.`);
}

const read = file => readFile(path.join(root, file), 'utf8');
const scriptAssets = ['app-data.js', 'app-sync.js', 'app-charts.js', 'app-ui.js'];
const packageJson = JSON.parse(await read('package.json'));
if (requestedVersion) packageJson.version = requestedVersion;
const version = packageJson.version;

if (!versionPattern.test(version)) {
  throw new Error(`Invalid package.json version: ${version}`);
}

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`Version marker not found: ${label}`);
  return content.replace(pattern, replacement);
}

const packageLock = JSON.parse(await read('package-lock.json'));
packageLock.version = version;
if (!packageLock.packages?.['']) throw new Error('package-lock.json root package is missing.');
packageLock.packages[''].version = version;

let indexHtml = await read('index.html');
indexHtml = replaceRequired(indexHtml, /style\.css\?v=\d+\.\d+\.\d+/, `style.css?v=${version}`, 'index stylesheet');
for (const asset of scriptAssets) {
  const escaped = asset.replaceAll('.', '\\.');
  indexHtml = replaceRequired(indexHtml, new RegExp(`${escaped}\\?v=\\d+\\.\\d+\\.\\d+`), `${asset}?v=${version}`, `index script ${asset}`);
}
indexHtml = replaceRequired(indexHtml, /v\d+\.\d+\.\d+ Stable/, `v${version} Stable`, 'index version label');

let serviceWorker = await read('sw.js');
serviceWorker = replaceRequired(serviceWorker, /kakeibo-v\d+\.\d+\.\d+-stable/, `kakeibo-v${version}-stable`, 'service worker cache');
serviceWorker = replaceRequired(serviceWorker, /style\.css\?v=\d+\.\d+\.\d+/, `style.css?v=${version}`, 'service worker stylesheet');
for (const asset of scriptAssets) {
  const escaped = asset.replaceAll('.', '\\.');
  serviceWorker = replaceRequired(serviceWorker, new RegExp(`${escaped}\\?v=\\d+\\.\\d+\\.\\d+`), `${asset}?v=${version}`, `service worker script ${asset}`);
}

let readme = await read('README.md');
readme = replaceRequired(readme, /^# 家計簿Webアプリ v\d+\.\d+\.\d+ Stable/m, `# 家計簿Webアプリ v${version} Stable`, 'README title');

const expected = new Map([
  ['package.json', `${JSON.stringify(packageJson, null, 2)}\n`],
  ['package-lock.json', `${JSON.stringify(packageLock, null, 2)}\n`],
  ['index.html', indexHtml],
  ['sw.js', serviceWorker],
  ['README.md', readme]
]);

const mismatches = [];
for (const [file, content] of expected) {
  const current = await read(file);
  if (current !== content) mismatches.push(file);
}
if (!readme.includes(`## v${version} Stable`)) mismatches.push('README.md changelog');

if (checkOnly) {
  if (mismatches.length) {
    console.error(`Version ${version} is not synchronized: ${mismatches.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Version ${version} is synchronized.`);
  }
} else {
  for (const [file, content] of expected) await writeFile(path.join(root, file), content);
  console.log(`Synchronized release version ${version}.`);
}
