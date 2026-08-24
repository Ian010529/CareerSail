const { chromium } = require('playwright');

function PlaywrightMixin(Base) {
  return class extends Base {
    constructor(options = {}) {
      super(options);
      this.headless = options.headless !== false;
      this.timeout = options.timeout || 30000;
      this.proxyServer = options.proxyServer || null;
      this.browser = null;
      this.context = null;
      this.page = null;
    }

    async startBrowser() {
      const args = [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ];
      if (this.proxyServer) args.push(`--proxy-server=${this.proxyServer}`);
      this.browser = await chromium.launch({ headless: this.headless, args });
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      this.page = await this.context.newPage();
    }

    async navigate(url, waitSelector = null, waitMs = 3000, waitUntil = 'networkidle') {
      if (!this.page) return false;
      try {
        await this.page.goto(url, { waitUntil, timeout: this.timeout });
        await this.page.waitForTimeout(waitMs);
        if (waitSelector) await this.page.waitForSelector(waitSelector, { timeout: this.timeout });
        return true;
      } catch (error) {
        return false;
      }
    }

    async closeBrowser() {
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
  };
}

module.exports = PlaywrightMixin;
