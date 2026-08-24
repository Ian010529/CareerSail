const assert = require('assert');
const path = require('path');

const hk = require(path.join(__dirname, '..', 'lib', 'recruiters', 'hk'));
const JobsDBBrowserCrawler = require(path.join(__dirname, '..', 'lib', 'recruiters', 'hk', 'jobsdb_browser'));
const JobsDBApiCrawler = require(path.join(__dirname, '..', 'lib', 'recruiters', 'hk', 'jobsdb'));

function run() {
  assert.strictEqual(hk.CRAWLER_REGISTRY.jobsdb, JobsDBBrowserCrawler,
    'jobsdb must route to the persistent browser crawler');
  assert.strictEqual(hk.CRAWLER_REGISTRY.jobsdb_api, JobsDBApiCrawler,
    'legacy API crawler must remain available as jobsdb_api');

  assert.strictEqual(
    JobsDBBrowserCrawler.stableJobId('https://hk.jobsdb.com/job/92217058?type=standard'),
    'jobsdb_92217058',
    'stable ID should come from the JobsDB job URL'
  );

  assert.strictEqual(
    JobsDBBrowserCrawler.stableJobId('', 'abc_def'),
    'jobsdb_abc_def',
    'stable ID should have a deterministic fallback'
  );

  const crawler = new JobsDBBrowserCrawler();
  assert.strictEqual(crawler.connectionMode, 'cdp',
    'JobsDB browser crawler should default to CDP connection mode');
  assert.strictEqual(crawler.cdpEndpoint, 'http://127.0.0.1:9222',
    'JobsDB browser crawler should default to the local Chrome CDP endpoint');
  assert.strictEqual(typeof crawler.submitSearch, 'function');
  assert.strictEqual(typeof crawler.readCards, 'function');
  assert.strictEqual(typeof crawler.readDetailFromPanel, 'function');
  assert.strictEqual(typeof crawler.readDetailFromUrl, 'function');
  assert.strictEqual(typeof crawler.detectAccessState, 'function');
  assert.strictEqual(typeof crawler.searchFieldVisible, 'function');

  const managed = new JobsDBBrowserCrawler({
    connectionMode: 'managed',
    headless: true,
    storageStatePath: path.join(__dirname, '.tmp-jobsdb-state.json')
  });
  assert.strictEqual(managed.connectionMode, 'managed');
  assert.strictEqual(managed.headless, true);

  console.log('HK crawler tests passed');
}

run();
