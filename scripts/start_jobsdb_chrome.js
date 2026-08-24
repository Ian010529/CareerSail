const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const USER_DATA_DIR = process.env.JOBSDB_CHROME_PROFILE || path.join(ROOT, 'data', 'auth', 'jobsdb_chrome_profile');
const PORT = Number(process.env.JOBSDB_CDP_PORT || 9222);

function candidateChromePaths() {
  const platform = process.platform;
  const paths = [];

  if (process.env.CHROME_PATH) paths.push(process.env.CHROME_PATH);

  if (platform === 'win32') {
    const pf = process.env['PROGRAMFILES'];
    const pfx86 = process.env['PROGRAMFILES(X86)'];
    const local = process.env.LOCALAPPDATA;
    if (pf) paths.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (pfx86) paths.push(path.join(pfx86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (local) paths.push(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (platform === 'darwin') {
    paths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    paths.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }

  return [...new Set(paths)];
}

function findChrome() {
  const found = candidateChromePaths().find(p => p && fs.existsSync(p));
  if (!found) {
    throw new Error(
      'Google Chrome was not found. Set CHROME_PATH to your Chrome executable path and retry.'
    );
  }
  return found;
}

function main() {
  const chrome = findChrome();
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://hk.jobsdb.com/'
  ];

  console.log('Starting user-controlled Chrome for JobsDB...');
  console.log(`Chrome: ${chrome}`);
  console.log(`Profile: ${USER_DATA_DIR}`);
  console.log(`CDP: http://127.0.0.1:${PORT}`);
  console.log('');
  console.log('Use this Chrome window normally. Complete any website verification or login yourself.');
  console.log('Leave this Chrome process running while CareerSail searches JobsDB.');

  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
