class AdaptiveDelayController {
  constructor(delayMin = 2500, delayMax = 5000, windowSize = 20) {
    this.delayMin = delayMin;
    this.delayMax = delayMax;
    this.windowSize = windowSize;
    this.history = [];
    this.currentDelay = delayMin;
  }

  get successRate() {
    if (this.history.length === 0) return 1;
    return this.history.filter(Boolean).length / this.history.length;
  }

  record(success) {
    this.history.push(!!success);
    if (this.history.length > this.windowSize) this.history.shift();
    if (this.successRate < 0.7) {
      this.currentDelay = Math.min(this.currentDelay * 1.5, this.delayMax);
    } else if (this.successRate > 0.95 && this.currentDelay > this.delayMin) {
      this.currentDelay = Math.max(this.currentDelay * 0.9, this.delayMin);
    }
  }

  async wait() {
    const jitter = (Math.random() * 600) - 300;
    const delay = Math.max(500, this.currentDelay + jitter);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  reset() {
    this.history = [];
    this.currentDelay = this.delayMin;
  }
}

module.exports = AdaptiveDelayController;
