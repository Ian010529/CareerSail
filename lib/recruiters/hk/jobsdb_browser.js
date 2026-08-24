const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const BaseCrawler = require('./base_crawler');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_STATE_PATH = path.join(ROOT, 'data', 'auth', 'jobsdb_state.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stableJobId(url, fallback = '') {
  const match = String(url || '').match(/\/job\/(\d+)/i);
  if (match) return `jobsdb_${match[1]}`;
  if (fallback) return `jobsdb_${fallback}`;
  return '';
}

class JobsDBBrowserCrawler extends BaseCrawler {
  constructor(options = {}) {
    super(options);
    this.headless = options.headless !== undefined
      ? !!options.headless
      : process.env.JOBSDB_HEADLESS !== '0';
    this.browserChannel = options.browserChannel || process.env.JOBSDB_BROWSER_CHANNEL || '';
    this.storageStatePath = options.storageStatePath || process.env.JOBSDB_STORAGE_STATE || DEFAULT_STATE_PATH;
    this.timeout = options.timeout || 60000;
    this.waitMs = options.waitMs || 1500;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.lastStatus = { status: 'idle', reason: '' };
  }

  async startBrowser() {
    if (this.browser) return;

    const launchOptions = {
      headless: this.headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    };
    if (this.browserChannel) launchOptions.channel = this.browserChannel;

    this.browser = await chromium.launch(launchOptions);

    const contextOptions = {
      viewport: { width: 1440, height: 900 },
      locale: 'en-HK'
    };
    if (fs.existsSync(this.storageStatePath)) {
      contextOptions.storageState = this.storageStatePath;
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
  }

  async saveState() {
    if (!this.context) return;
    fs.mkdirSync(path.dirname(this.storageStatePath), { recursive: true });
    await this.context.storageState({ path: this.storageStatePath });
  }

  async closeBrowser() {
    try { await this.saveState(); } catch (_) {}
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  async close() {
    await this.closeBrowser();
    await super.close();
  }

  async detectAccessState(page = this.page) {
    const title = (await page.title().catch(() => '')) || '';
    const body = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')) || '';
    const text = `${title}\n${body}`.toLowerCase();
    const currentUrl = String(page.url() || '').toLowerCase();

    if (/request blocked|access denied|verify you are human|checking your browser|captcha|security verification/.test(text)) {
      return { status: 'blocked', reason: title || 'Site requested browser verification' };
    }
    if (/\/(login|signin|sign-in)(\/|\?|$)/.test(currentUrl) || /please sign in to continue|please log in to continue|login required|sign in required/.test(text)) {
      return { status: 'auth_required', reason: 'JobsDB requires an authenticated browser session' };
    }
    return { status: 'ok', reason: '' };
  }

  async openHome() {
    await this.startBrowser();
    const response = await this.page.goto('https://hk.jobsdb.com/', {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout
    });
    await this.page.waitForTimeout(2000);

    const state = await this.detectAccessState();
    if (state.status !== 'ok') {
      this.lastStatus = state;
      const statusCode = response ? response.status() : 0;
      throw new Error(`JobsDB browser unavailable (${state.status}${statusCode ? ` HTTP ${statusCode}` : ''}): ${state.reason}. Run scripts/bootstrap_jobsdb_session.js if normal login/verification is required.`);
    }
    return response;
  }

  async submitSearch(keyword) {
    await this.openHome();

    const keywordRegion = this.page.locator('[data-automation="searchKeywordsField"]');
    await keywordRegion.waitFor({ state: 'visible', timeout: 15000 });
    await keywordRegion.click();

    const keywordInput = this.page.locator('input[type="text"]').first();
    await keywordInput.fill(String(keyword || '').trim());

    const whereInput = this.page.locator('[data-automation="SearchBar__Where"]');
    if (await whereInput.count()) {
      await whereInput.fill('Hong Kong');
    }

    const searchButton = this.page.locator('[data-automation="searchButton"]');
    if (await searchButton.count()) await searchButton.click();
    else await keywordInput.press('Enter');

    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForTimeout(2500);

    const state = await this.detectAccessState();
    if (state.status !== 'ok') {
      this.lastStatus = state;
      throw new Error(`JobsDB search blocked (${state.status}): ${state.reason}`);
    }

    await this.page.waitForSelector('[data-automation="jobTitle"]', { timeout: 20000 });
    return this.page.url();
  }

  async readCards() {
    return this.page.$$eval('[data-automation="normalJob"]', cards => cards.slice(0, 30).map((card, index) => {
      const title = card.querySelector('[data-automation="jobTitle"]');
      const company = card.querySelector('[data-automation="jobCompany"]');
      const location = card.querySelector('[data-automation="jobCardLocation"], [data-automation="jobLocation"]');
      const salary = card.querySelector('[data-automation="jobSalary"]');
      const description = card.querySelector('[data-automation="jobShortDescription"]');
      const posted = card.querySelector('[data-automation="jobListingDate"]');
      const workType = card.querySelector('[data-automation="jobCardWorkType"]');
      return {
        index,
        title: title ? title.textContent.trim() : '',
        company: company ? company.textContent.trim() : '',
        location: location ? location.textContent.trim() : 'Hong Kong',
        salary_raw: salary ? salary.textContent.trim() : '',
        jd_raw: description ? description.textContent.trim() : '',
        posted_at: posted ? posted.textContent.trim() : '',
        employment_type: workType ? workType.textContent.trim() : '',
        url: title && title.href ? title.href : ''
      };
    }).filter(job => job.title));
  }

  async readDetailFromPanel(cardIndex) {
    try {
      const card = this.page.locator('[data-automation="normalJob"]').nth(cardIndex);
      if (!await card.count()) return null;
      await card.click();
      await this.page.waitForTimeout(this.waitMs);
      const detail = this.page.locator('[data-automation="jobAdDetails"]');
      if (!await detail.count()) return null;
      const text = (await detail.innerText()).trim();
      return text.length >= 100 ? text : null;
    } catch (_) {
      return null;
    }
  }

  async readDetailFromUrl(url) {
    if (!url || !this.context) return null;
    const detailPage = await this.context.newPage();
    try {
      await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await detailPage.waitForTimeout(this.waitMs);
      const state = await this.detectAccessState(detailPage);
      if (state.status !== 'ok') return null;

      const detail = detailPage.locator('[data-automation="jobAdDetails"]');
      if (await detail.count()) {
        const text = (await detail.innerText()).trim();
        if (text.length >= 100) return text;
      }
      const main = detailPage.locator('[data-automation="jobDetailsPage"]');
      if (await main.count()) {
        const text = (await main.innerText()).trim();
        if (text.length >= 100) return text;
      }
      return null;
    } catch (_) {
      return null;
    } finally {
      await detailPage.close().catch(() => {});
    }
  }

  async fetchPage(keyword, page = 1, searchUrl = '') {
    if (page === 1 || !searchUrl) {
      searchUrl = await this.submitSearch(keyword);
    } else {
      const pageUrl = new URL(searchUrl);
      pageUrl.searchParams.set('page', String(page));
      await this.page.goto(pageUrl.toString(), { waitUntil: 'domcontentloaded', timeout: this.timeout });
      await this.page.waitForTimeout(2000);
      const state = await this.detectAccessState();
      if (state.status !== 'ok') {
        this.lastStatus = state;
        throw new Error(`JobsDB pagination blocked (${state.status}): ${state.reason}`);
      }
      const count = await this.page.locator('[data-automation="jobTitle"]').count();
      if (!count) return { jobs: [], searchUrl };
    }

    const cards = await this.readCards();
    const jobs = [];

    for (const card of cards) {
      let jd = await this.readDetailFromPanel(card.index);
      if (!jd) jd = await this.readDetailFromUrl(card.url);

      const fallbackKey = `${card.company}|${card.title}|${card.location}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .slice(0, 80);

      jobs.push({
        job_id: stableJobId(card.url, fallbackKey),
        title: card.title,
        company: card.company,
        location: card.location,
        salary_raw: card.salary_raw,
        jd_raw: jd || card.jd_raw,
        url: card.url,
        source: 'jobsdb',
        posted_at: card.posted_at,
        employment_type: card.employment_type
      });
      await sleep(250);
    }

    this.lastStatus = { status: 'ok', reason: '' };
    return { jobs, searchUrl };
  }

  parse(rawData) {
    return rawData && Array.isArray(rawData.jobs) ? rawData.jobs : [];
  }

  async run(keyword, maxPages = 3) {
    await this.startBrowser();
    const allJobs = [];
    let searchUrl = '';

    try {
      for (let page = 1; page <= maxPages; page++) {
        const raw = await this.fetchPage(keyword, page, searchUrl);
        searchUrl = raw.searchUrl || searchUrl;
        const jobs = this.parse(raw);
        if (!jobs.length) break;
        allJobs.push(...jobs);
        await sleep(800);
      }

      const seen = new Set();
      return allJobs.filter(job => {
        const key = job.job_id || job.url || `${job.company}|${job.title}|${job.location}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } finally {
      await this.closeBrowser();
    }
  }
}

module.exports = JobsDBBrowserCrawler;
module.exports.stableJobId = stableJobId;
