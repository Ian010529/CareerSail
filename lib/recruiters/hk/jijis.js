const BaseCrawler = require('./base_crawler');
const AdaptiveDelayController = require('./delay');

class JIJISCrawler extends BaseCrawler {
  static BASE_URL = 'https://www.jijis.org.hk/api/jobs';

  static HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://www.jijis.org.hk/',
    Accept: 'application/json'
  };

  constructor(options = {}) {
    const proxyConfig = options.proxyServer
      ? { http: options.proxyServer, https: options.proxyServer }
      : null;
    super({ ...options, proxyConfig });
    this.delayController = new AdaptiveDelayController(2000, 5000);
  }

  async fetchPage(keyword, page = 1) {
    const response = await this.request(JIJISCrawler.BASE_URL, {
      params: { keyword, page, lang: 'en' },
      headers: JIJISCrawler.HEADERS,
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
    const jobs = rawData.jobs || rawData.data || [];
    return jobs.map(job => ({
      job_id: `jijis_${job.id || ''}`,
      title: job.title || '',
      company: typeof job.company === 'object' ? (job.company.name || '') : (job.company || ''),
      location: job.location || 'Hong Kong',
      salary_raw: job.salary || '',
      jd_raw: job.description || '',
      url: job.url || '',
      source: 'jijis'
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

module.exports = JIJISCrawler;
