// ================================================
// READ-THROUGH — Perpustakaan Digital
// Cache layer otomatis load dari DB saat miss
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');
const CACHE_TTL = 90;

class ReadThroughLayer {
  constructor(namespace = 'rt') {
    this.ns    = namespace;
    this.stats = { transparentMisses: 0, hits: 0, dbLoads: 0 };
  }
  _key(k) { return `${this.ns}:${k}`; }
  async read(key, loaderFn) {
    const t0 = Date.now(), cacheKey = this._key(key);
    const cached = redis.get(cacheKey);
    if (cached) { this.stats.hits++; return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now()-t0}ms`, explanation: 'Read-Through: cache hit. Aplikasi tidak perlu tahu tentang DB.' }; }
    this.stats.transparentMisses++;
    this.stats.dbLoads++;
    const data = await loaderFn();
    if (data) redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'MISS (auto-loaded)', data, latency: `${Date.now()-t0}ms`, explanation: `Read-Through: cache miss ? cache layer otomatis load dari DB (TTL: ${CACHE_TTL}s).` };
  }
  invalidate(key) { return redis.del(this._key(key)); }
  getStats() { return this.stats; }
}

const layer = new ReadThroughLayer('rt');
const ReadThrough = {
  async getBuku(id)      { return layer.read(`buku:${id}`, () => db.getBuku(id)); },
  async getAllBuku()      { return layer.read('buku:all',   () => db.getAllBuku()); },
  async getPengarang(id) { return layer.read(`pengarang:${id}`, () => db.getPengarang(id)); },
  invalidate(key)  { return { invalidated: key, deleted: layer.invalidate(key) > 0 }; },
  getStats()       { return layer.getStats(); },
};
module.exports = ReadThrough;
