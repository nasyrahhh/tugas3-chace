// ================================================
// CACHE-ASIDE (LAZY LOADING) — Perpustakaan Digital
// READ  ? cek cache ? HIT: return cache
//                   ? MISS: baca DB ? simpan ke cache ? return
// WRITE ? tulis ke DB ? invalidasi cache
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');
const CACHE_TTL = 60;

const CacheAside = {
  async getBuku(id) {
    const t0 = Date.now(), cacheKey = `buku:${id}`;
    const cached = redis.get(cacheKey);
    if (cached) return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now()-t0}ms`, explanation: 'Buku ditemukan di cache Redis. Database tidak dikonsultasi.' };
    const buku = await db.getBuku(id);
    if (!buku) return { source: 'DATABASE', cacheStatus: 'MISS', data: null, latency: `${Date.now()-t0}ms`, explanation: 'Buku tidak ditemukan di cache maupun database.' };
    redis.set(cacheKey, JSON.stringify(buku), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'MISS', data: buku, latency: `${Date.now()-t0}ms`, explanation: `Cache miss. Buku diambil dari DB (${buku._dbQueryTime}), disimpan ke cache (TTL: ${CACHE_TTL}s).`, cacheTtl: CACHE_TTL };
  },

  async getAllBuku() {
    const t0 = Date.now(), cacheKey = 'buku:all';
    const cached = redis.get(cacheKey);
    if (cached) return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now()-t0}ms`, explanation: 'Daftar buku dari cache.' };
    const semuaBuku = await db.getAllBuku();
    redis.set(cacheKey, JSON.stringify(semuaBuku), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'MISS', data: semuaBuku, latency: `${Date.now()-t0}ms`, explanation: `Cache miss. ${semuaBuku.length} buku diambil dari DB, disimpan ke cache (TTL: ${CACHE_TTL}s).` };
  },

  async createBuku(data) {
    const t0 = Date.now(), buku = await db.createBuku(data);
    redis.del('buku:all');
    return { source: 'DATABASE', cacheStatus: 'WRITE', data: buku, latency: `${Date.now()-t0}ms`, explanation: 'Buku disimpan ke DB. Cache list dihapus (invalidasi).', invalidated: ['buku:all'] };
  },

  async updateBuku(id, data) {
    const t0 = Date.now(), buku = await db.updateBuku(id, data);
    if (!buku) return { error: 'Buku tidak ditemukan' };
    const keys = [`buku:${id}`, 'buku:all'];
    redis.del(...keys);
    return { source: 'DATABASE', cacheStatus: 'WRITE', data: buku, latency: `${Date.now()-t0}ms`, explanation: 'Buku diperbarui di DB. Cache buku ini dan list dihapus.', invalidated: keys };
  },

  async deleteBuku(id) {
    const t0 = Date.now(), deleted = await db.deleteBuku(id);
    if (!deleted) return { error: 'Buku tidak ditemukan' };
    const keys = [`buku:${id}`, 'buku:all'];
    redis.del(...keys);
    return { source: 'DATABASE', cacheStatus: 'WRITE', data: { deleted: true, id }, latency: `${Date.now()-t0}ms`, explanation: 'Buku dihapus dari DB. Cache diinvalidasi.', invalidated: keys };
  },
};
module.exports = CacheAside;
