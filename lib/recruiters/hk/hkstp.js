const BaseCrawler = require('./base_crawler');

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

class HKSTPCrawler extends BaseCrawler {
  static BASE_URL = 'https://talentjobseeker.hkstp.org/api/position';
  static JOB_URL = 'https://talentjobseeker.hkstp.org/job';

  constructor(options = {}) {
    super(options);
    this.timeout = options.timeout || 30000;
  }

  buildSearchData(keyword) {
    const normalized = String(keyword || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!normalized) return '';
    return Buffer.from(JSON.stringify({ keyword: normalized })).toString('base64url');
  }

  async fetchPage(keyword, page = 1) {
    const bdata = this.buildSearchData(keyword);
    const response = await this.request(HKSTPCrawler.BASE_URL, {
      params: {
        order: 'publish_at',
        page,
        per_page: 20,
        ...(bdata ? { bdata } : {})
      },
      headers: {
        Accept: 'application/json',
        Referer: 'https://talentjobseeker.hkstp.org/search'
      },
      timeout: this.timeout
    });
    if (!response) return null;
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  parse(rawData) {
    if (!rawData || !Array.isArray(rawData.data)) return [];
    return rawData.data.map(job => ({
      job_id: `hkstp_${job.id}`,
      title: job.job_title || '',
      company: job.company && job.company.company_name || '',
      location: 'Hong Kong',
      salary_raw: '',
      jd_raw: stripHtml(job.job_description),
      url: `${HKSTPCrawler.JOB_URL}/${job.id}/${job.slug || ''}`,
      source: 'hkstp',
      posted_at: job.publish_at || '',
      industry_category: job.industry_id ? String(job.industry_id) : '',
      employment_type: Array.isArray(job.employment_type_id) ? job.employment_type_id.join(',') : '',
      reference_number: job.reference_number || '',
      expires_at: job.expire_at || ''
    }));
  }

  async run(keyword, maxPages = 5) {
    const allJobs = [];
    for (let page = 1; page <= maxPages; page++) {
      const raw = await this.fetchPage(keyword, page);
      const jobs = this.parse(raw);
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
      const lastPage = raw && raw.meta && raw.meta.last_page;
      if (lastPage && page >= lastPage) break;
    }
    return allJobs;
  }
}

module.exports = HKSTPCrawler;
