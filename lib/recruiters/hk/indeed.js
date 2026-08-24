const BaseCrawler = require('./base_crawler');
const PlaywrightMixin = require('./playwright_mixin');

class IndeedCrawler extends PlaywrightMixin(BaseCrawler) {
  static BASE_URL = 'https://hk.indeed.com/jobs';

  constructor(options = {}) {
    super({ ...options, timeout: options.timeout || 60000 });
  }

  async fetchPage(keyword, page = 1) {
    await this.startBrowser();
    try {
      const start = (page - 1) * 10;
      const url = `${IndeedCrawler.BASE_URL}?q=${encodeURIComponent(keyword)}&l=Hong+Kong&start=${start}`;
      const success = await this.navigate(url, '#mosaic-jobResults', 5000, 'domcontentloaded');
      if (!success) return null;
      return await this.page.$$eval('.job_seen_beacon', items => items.map((item, index) => {
        const title = item.querySelector('h2.jobTitle a');
        const company = item.querySelector('.companyName');
        const location = item.querySelector('.companyLocation');
        const salary = item.querySelector('.salary-snippet');
        const description = item.querySelector('.job-snippet');
        return {
          job_id: `indeed_${index}`,
          title: title ? title.textContent.trim() : '',
          company: company ? company.textContent.trim() : '',
          location: location ? location.textContent.trim() : 'Hong Kong',
          salary_raw: salary ? salary.textContent.trim() : '',
          jd_raw: description ? description.textContent.trim() : '',
          url: title ? title.href : '',
          source: 'indeed'
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

module.exports = IndeedCrawler;
