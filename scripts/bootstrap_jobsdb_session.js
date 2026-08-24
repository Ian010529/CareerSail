const http = require('http');
const { chromium } = require('playwright');

const endpoint = process.env.JOBSDB_CDP_ENDPOINT || 'http://127.0.0.1:9222';

function waitForJsonVersion(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Chrome CDP endpoint returned HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Chrome CDP endpoint timed out')));
    req.on('error', reject);
  });
}

async function main() {
  console.log(`Checking user-controlled Chrome at ${endpoint} ...`);
  try {
    await waitForJsonVersion(`${endpoint}/json/version`);
  } catch (error) {
    console.error('No compatible Chrome CDP session is running.');
    console.error('Run: npm run jobsdb:chrome');
    console.error('Then complete any normal JobsDB verification/login in that Chrome window and leave it open.');
    process.exitCode = 2;
    return;
  }

  const browser = await chromium.connectOverCDP(endpoint, { timeout: 10000, isLocal: true });
  try {
    const contexts = browser.contexts();
    if (!contexts.length) {
      console.error('Chrome exposes no browser context.');
      process.exitCode = 2;
      return;
    }

    const context = contexts[0];
    let page = context.pages().find(p => /https?:\/\/hk\.jobsdb\.com/i.test(p.url() || ''));
    if (!page) page = await context.newPage();
    if (!/https?:\/\/hk\.jobsdb\.com/i.test(page.url() || '')) {
      await page.goto('https://hk.jobsdb.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    const title = await page.title().catch(() => '');
    const search = page.locator('[data-automation="searchKeywordsField"]');
    const visible = await search.count().then(async count => count > 0 && await search.first().isVisible()).catch(() => false);

    if (!visible) {
      console.error(`JobsDB is not ready in the attached Chrome session. Current title: ${title || '(unknown)'}`);
      console.error('Complete the normal website verification/login in that SAME Chrome window, then rerun this check.');
      process.exitCode = 2;
      return;
    }

    console.log('JobsDB search field is visible in the persistent Chrome session.');
    console.log('CareerSail can now attach to this Chrome with JOBSDB_BROWSER_MODE=cdp (the default).');
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
