const { request } = require('playwright');

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class BaseCrawler {
  constructor(options = {}) {
    this.proxyConfig = options.proxyConfig || null;
    this.maxWorkers = options.maxWorkers || 3;
    this.requestContext = null;
  }

  async createRequestContext(headers = {}) {
    if (this.requestContext) return this.requestContext;
    const proxyServer = this.proxyConfig && (this.proxyConfig.https || this.proxyConfig.http);
    this.requestContext = await request.newContext({
      extraHTTPHeaders: headers,
      ...(proxyServer ? { proxy: { server: proxyServer } } : {})
    });
    return this.requestContext;
  }

  async request(url, options = {}) {
    const context = await this.createRequestContext(options.headers || {});
    const params = options.params || {};
    const target = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        target.searchParams.set(key, String(value));
      }
    });

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await context.get(target.toString(), {
          timeout: options.timeout || 30000,
          headers: options.headers || {}
        });
        if (response.ok()) return response;
        if (!RETRY_STATUS.has(response.status()) || attempt === 3) return null;
      } catch (error) {
        if (attempt === 3) return null;
      }
      await sleep(1000 * Math.pow(2, attempt));
    }
    return null;
  }

  async runConcurrent(keywords, maxPages = 5) {
    const entries = [];
    for (let index = 0; index < keywords.length; index += this.maxWorkers) {
      const batch = keywords.slice(index, index + this.maxWorkers);
      entries.push(...await Promise.all(
        batch.map(async keyword => [keyword, await this.run(keyword, maxPages)])
      ));
    }
    return Object.fromEntries(entries);
  }

  async close() {
    if (this.requestContext) {
      await this.requestContext.dispose();
      this.requestContext = null;
    }
  }

  async fetchPage() {
    throw new Error('fetchPage must be implemented by subclass');
  }

  parse() {
    throw new Error('parse must be implemented by subclass');
  }

  async run() {
    throw new Error('run must be implemented by subclass');
  }
}

module.exports = BaseCrawler;
