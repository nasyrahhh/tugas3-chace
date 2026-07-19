// ================================================
// CACHE-ASIDE (LAZY LOADING)
// Alur:
//   READ  → cek cache → HIT: return cache
//                     → MISS: baca DB → simpan ke cache → return
//   WRITE → tulis ke DB → hapus/update cache (invalidation)
//
// Keuntungan : Hanya data yang diminta yang di-cache
// Kekurangan : Cache miss pertama selalu lambat (cold start)
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');

const CACHE_TTL = 60; // seconds

const CacheAside = {
  // ── READ ─────────────────────────────────────
  async getProduct(id) {
    const t0       = Date.now();
    const cacheKey = `product:${id}`;

    // 1. Check cache
    const cached = redis.get(cacheKey);
    if (cached) {
      return {
        source:      'CACHE',
        cacheStatus: 'HIT',
        data:        JSON.parse(cached),
        latency:     `${Date.now() - t0}ms`,
        explanation: 'Data ditemukan di cache Redis. DB tidak dikonsultasi.',
      };
    }

    // 2. Cache miss → query DB
    const product = await db.getProduct(id);
    if (!product) {
      return { source: 'DATABASE', cacheStatus: 'MISS', data: null, latency: `${Date.now() - t0}ms`, explanation: 'Data tidak ditemukan di cache maupun DB.' };
    }

    // 3. Populate cache
    redis.set(cacheKey, JSON.stringify(product), { EX: CACHE_TTL });

    return {
      source:      'DATABASE',
      cacheStatus: 'MISS',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: `Cache miss. Data diambil dari DB (${product._dbQueryTime}), lalu disimpan ke cache (TTL: ${CACHE_TTL}s).`,
      cacheTtl:    CACHE_TTL,
    };
  },

  async getAllProducts() {
    const t0       = Date.now();
    const cacheKey = 'products:all';

    const cached = redis.get(cacheKey);
    if (cached) {
      return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now() - t0}ms`, explanation: 'Daftar produk dari cache.' };
    }

    const products = await db.getAllProducts();
    redis.set(cacheKey, JSON.stringify(products), { EX: CACHE_TTL });

    return {
      source:      'DATABASE',
      cacheStatus: 'MISS',
      data:        products,
      latency:     `${Date.now() - t0}ms`,
      explanation: `Cache miss. ${products.length} produk diambil dari DB, disimpan ke cache (TTL: ${CACHE_TTL}s).`,
    };
  },

  // ── WRITE ────────────────────────────────────
  async createProduct(data) {
    const t0      = Date.now();
    const product = await db.createProduct(data);

    // Invalidate list cache
    redis.del('products:all');

    return {
      source:      'DATABASE',
      cacheStatus: 'WRITE',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Produk disimpan ke DB. Cache list dihapus (invalidasi) agar data tidak stale.',
      invalidated: ['products:all'],
    };
  },

  async updateProduct(id, data) {
    const t0      = Date.now();
    const product = await db.updateProduct(id, data);
    if (!product) return { error: 'Product not found' };

    // Invalidate both specific and list cache
    const keys = [`product:${id}`, 'products:all'];
    redis.del(...keys);

    return {
      source:      'DATABASE',
      cacheStatus: 'WRITE',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Produk diperbarui di DB. Cache untuk produk ini dan list dihapus.',
      invalidated: keys,
    };
  },

  async deleteProduct(id) {
    const t0      = Date.now();
    const deleted = await db.deleteProduct(id);
    if (!deleted) return { error: 'Product not found' };

    const keys = [`product:${id}`, 'products:all'];
    redis.del(...keys);

    return {
      source:      'DATABASE',
      cacheStatus: 'WRITE',
      data:        { deleted: true, id },
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Produk dihapus dari DB. Cache diinvalidasi.',
      invalidated: keys,
    };
  },
};

module.exports = CacheAside;
