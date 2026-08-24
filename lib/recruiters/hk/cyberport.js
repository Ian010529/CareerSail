const BaseCrawler = require('./base_crawler');
const PlaywrightMixin = require('./playwright_mixin');

class CyberportCrawler extends PlaywrightMixin(BaseCrawler) {
  static BASE_URL = 'https://www.cyberport.hk/job-vacancy/';

  constructor(options = {}) {
    super({ ...options, timeout: options.timeout || 60000 });
  }

  async fetchPage(keyword, page = 1) {
    await this.startBrowser();
    try {
      const url = `${CyberportCrawler.BASE_URL}?search=${encodeURIComponent(keyword)}&page=${page}`;
      const success = await this.navigate(url, '.job-listing', 3000);
      if (!success) return null;
      return await this.page.$$eval('.job-card', items => items.map((item, index) => {
        const title = item.querySelector('.job-title a');
        const company = item.querySelector('.company');
        const description = item.querySelector('.description');
        return {
          job_id: `cyberport_${index}`,
          title: title ? title.textContent.trim() : '',
          company: company ? company.textContent.trim() : '',
          location: 'Cyberport',
          jd_raw: description ? description.textContent.trim() : '',
          url: title ? title.href : '',
          source: 'cyberport'
        };
      }));
    } finally {
      await this.closeBrowser();
    }
  }

  parse(rawData) {
    return rawData || [];
  }

  async run(keyword, maxPages = 5) {
    const allJobs = [];
    for (let page = 1; page <= maxPages; page++) {
      const jobs = this.parse(await this.fetchPage(keyword, page));
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
    }
    return allJobs;
  }
}

module.exports = CyberportCrawler;
