// ================================================
// WRITE-THROUGH — Perpustakaan Digital
// WRITE ? tulis ke CACHE + DB bersamaan
// READ  ? selalu dari cache
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');
const CACHE_TTL = 120;

const WriteThrough = {
  async createBuku(data) {
    const t0 = Date.now(), buku = await db.createBuku(data);
    const cacheKey = `wt:buku:${buku.id}`;
    redis.set(cacheKey, JSON.stringify(buku), { EX: CACHE_TTL });
    redis.del('wt:buku:all');
    return { source: 'DATABASE + CACHE', cacheStatus: 'WRITE-THROUGH', data: buku, latency: `${Date.now()-t0}ms`, explanation: 'Write-Through: buku ditulis ke DB DAN cache sekaligus.', cachedKey: cacheKey };
  },

  async updateBuku(id, data) {
    const t0 = Date.now(), buku = await db.updateBuku(id, data);
    if (!buku) return { error: 'Buku tidak ditemukan' };
    const cacheKey = `wt:buku:${id}`;
    redis.set(cacheKey, JSON.stringify(buku), { EX: CACHE_TTL });
    redis.del('wt:buku:all');
    return { source: 'DATABASE + CACHE', cacheStatus: 'WRITE-THROUGH', data: buku, latency: `${Date.now()-t0}ms`, explanation: 'Buku diperbarui di DB dan cache secara bersamaan.', updatedKey: cacheKey };
  },

  async getBuku(id) {
    const t0 = Date.now(), cacheKey = `wt:buku:${id}`;
    const cached = redis.get(cacheKey);
    if (cached) return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now()-t0}ms`, explanation: 'Write-Through menjamin buku selalu ada di cache setelah write pertama.' };
    const buku = await db.getBuku(id);
    if (!buku) return { error: 'Buku tidak ditemukan' };
    redis.set(cacheKey, JSON.stringify(buku), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'COLD-MISS', data: buku, latency: `${Date.now()-t0}ms`, explanation: 'Buku belum pernah di-write-through. Diambil dari DB dan di-cache sekarang.' };
  },

  async getAllBuku() {
    const t0 = Date.now(), cacheKey = 'wt:buku:all';
    const cached = redis.get(cacheKey);
    if (cached) return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now()-t0}ms`, explanation: 'List buku dari cache.' };
    const semuaBuku = await db.getAllBuku();
    redis.set(cacheKey, JSON.stringify(semuaBuku), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'MISS', data: semuaBuku, latency: `${Date.now()-t0}ms`, explanation: `${semuaBuku.length} buku diambil dari DB dan disimpan ke cache.` };
  },
};
module.exports = WriteThrough;
