// ================================================
// WRITE-THROUGH
// Alur:
//   WRITE → tulis ke CACHE + DB secara bersamaan
//   READ  → selalu dari cache (dijamin ada)
//
// Keuntungan : Cache selalu konsisten dengan DB
// Kekurangan : Write lebih lambat (2x round-trip)
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');

const CACHE_TTL = 120; // seconds

const WriteThrough = {
  // ── WRITE (sync to both cache & DB) ──────────
  async createProduct(data) {
    const t0      = Date.now();

    // 1. Write to DB first
    const product = await db.createProduct(data);

    // 2. Immediately write to cache as well
    const cacheKey = `wt:product:${product.id}`;
    redis.set(cacheKey, JSON.stringify(product), { EX: CACHE_TTL });

    // Invalidate list
    redis.del('wt:products:all');

    return {
      source:      'DATABASE + CACHE',
      cacheStatus: 'WRITE-THROUGH',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Write-Through: data ditulis ke DB DAN cache sekaligus. Cache langsung konsisten.',
      cachedKey:   cacheKey,
    };
  },

  async updateProduct(id, data) {
    const t0      = Date.now();
    const product = await db.updateProduct(id, data);
    if (!product) return { error: 'Product not found' };

    // Update cache immediately
    const cacheKey = `wt:product:${id}`;
    redis.set(cacheKey, JSON.stringify(product), { EX: CACHE_TTL });
    redis.del('wt:products:all');

    return {
      source:      'DATABASE + CACHE',
      cacheStatus: 'WRITE-THROUGH',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Data diperbarui di DB dan cache secara bersamaan.',
      updatedKey:  cacheKey,
    };
  },

  // ── READ ─────────────────────────────────────
  async getProduct(id) {
    const t0       = Date.now();
    const cacheKey = `wt:product:${id}`;

    const cached = redis.get(cacheKey);
    if (cached) {
      return {
        source:      'CACHE',
        cacheStatus: 'HIT',
        data:        JSON.parse(cached),
        latency:     `${Date.now() - t0}ms`,
        explanation: 'Write-Through garantees data always in cache after first write.',
      };
    }

    // First access (never written through yet) → fallback to DB
    const product = await db.getProduct(id);
    if (!product) return { error: 'Product not found' };

    redis.set(cacheKey, JSON.stringify(product), { EX: CACHE_TTL });
    return {
      source:      'DATABASE',
      cacheStatus: 'COLD-MISS',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Data belum pernah di-write-through. Diambil dari DB dan di-cache sekarang.',
    };
  },

  async getAllProducts() {
    const t0       = Date.now();
    const cacheKey = 'wt:products:all';

    const cached = redis.get(cacheKey);
    if (cached) {
      return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now() - t0}ms`, explanation: 'List dari cache.' };
    }

    const products = await db.getAllProducts();
    redis.set(cacheKey, JSON.stringify(products), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'COLD-MISS', data: products, latency: `${Date.now() - t0}ms`, explanation: 'Diambil dari DB.' };
  },
};

module.exports = WriteThrough;
