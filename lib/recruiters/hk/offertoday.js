const BaseCrawler = require('./base_crawler');
const AdaptiveDelayController = require('./delay');

class OfferTodayCrawler extends BaseCrawler {
  static BASE_URL = 'https://www.ofhr.com.hk/api/job/search';

  static HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://www.ofhr.com.hk/',
    Accept: 'application/json'
  };

  constructor(options = {}) {
    const proxyConfig = options.proxyServer
      ? { http: options.proxyServer, https: options.proxyServer }
      : null;
    super({ ...options, proxyConfig });
    this.delayController = new AdaptiveDelayController(2000, 4000);
  }

  async fetchPage(keyword, page = 1) {
    const response = await this.request(OfferTodayCrawler.BASE_URL, {
      params: { keyword, page, pageSize: 20 },
      headers: OfferTodayCrawler.HEADERS,
      timeout: 15000
    });
    this.delayController.record(!!response);
    if (!response) return null;
    try {
      return await response.json();
    } catch (error) {
      this.delayController.record(false);
      return null;
    }
  }

  parse(rawData) {
    if (!rawData) return [];
    const jobs = rawData.data && !Array.isArray(rawData.data)
      ? (rawData.data.list || [])
      : (rawData.jobs || []);
    return jobs.map(job => ({
      job_id: `offertoday_${job.id || ''}`,
      title: job.title || '',
      company: job.companyName || '',
      location: job.location || 'Hong Kong',
      salary_raw: job.salary || '',
      jd_raw: job.description || '',
      url: job.url || '',
      source: 'offertoday'
    }));
  }

  async run(keyword, maxPages = 5) {
    const allJobs = [];
    for (let page = 1; page <= maxPages; page++) {
      const jobs = this.parse(await this.fetchPage(keyword, page));
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
      await this.delayController.wait();
    }
    return allJobs;
  }
}

module.exports = OfferTodayCrawler;
