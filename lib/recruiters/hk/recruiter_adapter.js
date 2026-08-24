const BaseRecruiter = require('../base');

function createRecruiterAdapter(source, displayName, CrawlerClass) {
  return class extends BaseRecruiter {
    constructor(options = {}) {
      super({ name: displayName, ...options });
      this.source = source;
      this.crawlerOptions = options;
    }

    async fetchJobs(params = {}) {
      const crawler = new CrawlerClass(this.crawlerOptions);
      try {
        const rawJobs = await crawler.run(params.keyword || '', params.maxPages || 5);
        const seen = new Set();
        const jobs = [];
        for (const rawJob of rawJobs) {
          const key = `${rawJob.source || this.source}:${rawJob.job_id || rawJob.url || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          jobs.push(this.normalizeJob(rawJob));
        }
        return jobs;
      } finally {
        await crawler.close();
      }
    }

    buildJobUrl(job) {
      return job.url || '';
    }

    normalizeJob(rawJob) {
      const job = super.normalizeJob({
        id: rawJob.job_id || '',
        title: rawJob.title || '',
        company: rawJob.company || '',
        city: rawJob.location || '',
        category: rawJob.industry_category || '',
        publishDate: rawJob.posted_at || rawJob.posted_date || '',
        url: rawJob.url || '',
        description: rawJob.jd_raw || '',
        requirement: rawJob.requirement || '',
        salaryRaw: rawJob.salary_raw || '',
        sourcePlatform: rawJob.source || this.source,
        level: rawJob.employment_type || ''
      });
      job.source = displayName;
      job.salaryRaw = rawJob.salary_raw || '';
      job.sourcePlatform = rawJob.source || this.source;
      return job;
    }
  };
}

module.exports = createRecruiterAdapter;
