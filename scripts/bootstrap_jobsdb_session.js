const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const statePath = process.env.JOBSDB_STORAGE_STATE || path.join(ROOT, 'data', 'auth', 'jobsdb_state.json');
const browserChannel = process.env.JOBSDB_BROWSER_CHANNEL || '';

function waitForEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(message, () => {
    rl.close();
    resolve();
  }));
}

async function main() {
  const launchOptions = {
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  };
  if (browserChannel) launchOptions.channel = browserChannel;

  const browser = await chromium.launch(launchOptions);
  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    locale: 'en-HK'
  };
  if (fs.existsSync(statePath)) contextOptions.storageState = statePath;

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  console.log('Opening JobsDB in a normal visible browser session...');
  console.log('If JobsDB asks you to sign in or complete a verification step, do it manually in this window.');
  console.log('This helper does not solve or bypass website challenges; it only saves your normal browser session afterward.');

  await page.goto('https://hk.jobsdb.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await waitForEnter('\nWhen the JobsDB home/search page is usable, press Enter here to save the session... ');

  const searchCount = await page.locator('[data-automation="searchKeywordsField"]').count().catch(() => 0);
  if (!searchCount) {
    console.error('JobsDB search field is not visible. Session was not saved.');
    await browser.close();
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await context.storageState({ path: statePath });
  console.log(`Session saved to: ${statePath}`);
  await browser.close();
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
