class ProxyManager {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
  }

  static fromSettings(http, https) {
    if (!http && !https) return new ProxyManager();
    return new ProxyManager([{ ...(http ? { http } : {}), ...(https ? { https } : {}) }]);
  }

  addProxy(proxy) {
    this.proxies.push(proxy);
  }

  getNext() {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }

  getRandom() {
    if (this.proxies.length === 0) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }

  get count() {
    return this.proxies.length;
  }

  remove(proxy) {
    this.proxies = this.proxies.filter(item => item !== proxy);
  }
}

module.exports = ProxyManager;
