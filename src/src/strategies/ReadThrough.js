// ================================================
// READ-THROUGH
// Alur:
//   READ → App hanya berbicara ke "cache layer"
//          Cache layer yang handle miss:
//          fetch DB → simpan ke cache → return ke app
//
// Berbeda dari Cache-Aside: pada Cache-Aside,
// aplikasi yang mengisi cache saat miss.
// Pada Read-Through, cache layer (library) yang otomatis
// mengisi dari DB (application-transparent).
//
// Keuntungan : Logika cache tersembunyi dari aplikasi
// Kekurangan : Data awal selalu miss (cold start)
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');

const CACHE_TTL = 90;

// Simulate a "cache library" that transparently loads from DB on miss
class ReadThroughLayer {
  constructor(namespace = 'rt') {
    this.ns    = namespace;
    this.stats = { transparentMisses: 0, hits: 0, dbLoads: 0 };
  }

  _key(k) { return `${this.ns}:${k}`; }

  async read(key, loaderFn) {
    const t0       = Date.now();
    const cacheKey = this._key(key);

    // Try cache
    const cached = redis.get(cacheKey);
    if (cached) {
      this.stats.hits++;
      return {
        source:      'CACHE',
        cacheStatus: 'HIT',
        data:        JSON.parse(cached),
        latency:     `${Date.now() - t0}ms`,
        explanation: 'Read-Through: cache hit. App tidak perlu tahu tentang DB.',
      };
    }

    // Cache miss → cache layer transparently loads from DB
    this.stats.transparentMisses++;
    this.stats.dbLoads++;

    const data = await loaderFn();     // application provides loader function
    if (data) {
      redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
    }

    return {
      source:      'DATABASE',
      cacheStatus: 'MISS (auto-loaded)',
      data,
      latency:     `${Date.now() - t0}ms`,
      explanation: `Read-Through: cache miss → cache layer otomatis load dari DB (TTL: ${CACHE_TTL}s). App tidak perlu menulis ke cache secara manual.`,
    };
  }

  invalidate(key) {
    return redis.del(this._key(key));
  }

  getStats() { return this.stats; }
}

const layer = new ReadThroughLayer('rt');

const ReadThrough = {
  async getProduct(id) {
    return layer.read(`product:${id}`, () => db.getProduct(id));
  },

  async getAllProducts() {
    return layer.read('products:all', () => db.getAllProducts());
  },

  async getUser(id) {
    return layer.read(`user:${id}`, () => db.getUser(id));
  },

  invalidate(key) {
    const deleted = layer.invalidate(key);
    return { invalidated: key, deleted: deleted > 0 };
  },

  getStats() { return layer.getStats(); },
};

module.exports = ReadThrough;
