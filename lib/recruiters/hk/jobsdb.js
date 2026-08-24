const BaseCrawler = require('./base_crawler');
const AdaptiveDelayController = require('./delay');
const ProxyManager = require('./proxy');

class JobsDBCrawler extends BaseCrawler {
  static BASE_URL = 'https://hk.jobsdb.com/api/jobs';

  static HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://hk.jobsdb.com/',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-HK,en-HK;q=0.9,en;q=0.8,zh-CN;q=0.7'
  };

  constructor(options = {}) {
    const proxyManager = ProxyManager.fromSettings(options.proxyHttp, options.proxyHttps);
    super({ ...options, proxyConfig: proxyManager.getRandom() });
    this.delayController = new AdaptiveDelayController(
      options.delayMin || 2500,
      options.delayMax || 5000
    );
    this.timeout = options.timeout || 30000;
  }

  async fetchPage(keyword, page = 1) {
    const response = await this.request(JobsDBCrawler.BASE_URL, {
      params: { keyword, page, location: 'Hong Kong' },
      headers: JobsDBCrawler.HEADERS,
      timeout: this.timeout
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
    const jobs = rawData.jobs || (rawData.data && rawData.data.jobs) || [];
    return jobs.map(job => ({
      job_id: job.id || job.jobId || '',
      title: job.title || '',
      company: typeof job.company === 'object' ? (job.company.name || '') : (job.company || ''),
      location: job.location || '',
      salary_raw: job.salary || '',
      jd_raw: job.description || (job.advertiser && job.advertiser.description) || '',
      url: job.url || job.jobUrl || '',
      source: 'jobsdb'
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

module.exports = JobsDBCrawler;
