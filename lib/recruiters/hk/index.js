const JobsDBApiCrawler = require('./jobsdb');
const JobsDBBrowserCrawler = require('./jobsdb_browser');
const JIJISCrawler = require('./jijis');
const OfferTodayCrawler = require('./offertoday');
const HKSTPCrawler = require('./hkstp');
const CyberportCrawler = require('./cyberport');
const IndeedCrawler = require('./indeed');
const createRecruiterAdapter = require('./recruiter_adapter');

const CRAWLER_REGISTRY = {
  jobsdb: JobsDBBrowserCrawler,
  jobsdb_api: JobsDBApiCrawler,
  jijis: JIJISCrawler,
  offertoday: OfferTodayCrawler,
  hkstp: HKSTPCrawler,
  cyberport: CyberportCrawler,
  indeed: IndeedCrawler
};

const JobsDBRecruiter = createRecruiterAdapter('jobsdb', 'JobsDB 香港站', JobsDBBrowserCrawler);
const JobsDBApiRecruiter = createRecruiterAdapter('jobsdb_api', 'JobsDB 香港站 API', JobsDBApiCrawler);
const JIJISRecruiter = createRecruiterAdapter('jijis', 'JIJIS 香港联校招聘', JIJISCrawler);
const OfferTodayRecruiter = createRecruiterAdapter('offertoday', 'OfferToday 香港招聘', OfferTodayCrawler);
const HKSTPRecruiter = createRecruiterAdapter('hkstp', '香港科技园招聘', HKSTPCrawler);
const CyberportRecruiter = createRecruiterAdapter('cyberport', '香港数码港招聘', CyberportCrawler);
const IndeedRecruiter = createRecruiterAdapter('indeed', 'Indeed 香港站', IndeedCrawler);

const RECRUITER_REGISTRY = {
  jobsdb: JobsDBRecruiter,
  jobsdb_api: JobsDBApiRecruiter,
  jijis: JIJISRecruiter,
  offertoday: OfferTodayRecruiter,
  hkstp: HKSTPRecruiter,
  cyberport: CyberportRecruiter,
  indeed: IndeedRecruiter
};

function registerCrawler(source, crawlerClass) {
  CRAWLER_REGISTRY[source] = crawlerClass;
}

function getCrawler(source = 'jobsdb', options = {}) {
  const CrawlerClass = CRAWLER_REGISTRY[source];
  if (!CrawlerClass) {
    throw new Error(`Unknown crawler source: ${source}. Available: ${listSources().join(', ')}`);
  }
  return new CrawlerClass(options);
}

function listSources() {
  return Object.keys(CRAWLER_REGISTRY);
}

module.exports = {
  CRAWLER_REGISTRY,
  RECRUITER_REGISTRY,
  registerCrawler,
  getCrawler,
  listSources,
  JobsDBCrawler: JobsDBBrowserCrawler,
  JobsDBBrowserCrawler,
  JobsDBApiCrawler,
  JIJISCrawler,
  OfferTodayCrawler,
  HKSTPCrawler,
  CyberportCrawler,
  IndeedCrawler,
  JobsDBRecruiter,
  JobsDBApiRecruiter,
  JIJISRecruiter,
  OfferTodayRecruiter,
  HKSTPRecruiter,
  CyberportRecruiter,
  IndeedRecruiter
};
