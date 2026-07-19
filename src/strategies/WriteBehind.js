// ================================================
// WRITE-BEHIND (WRITE-BACK) — Perpustakaan Digital
// WRITE ? tulis ke CACHE saja, segera return
//         ? DB ditulis secara ASYNC (antrian)
// READ  ? dari cache
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');
const CACHE_TTL  = 120;
const FLUSH_DELAY = 5000;

class WriteBehindStrategy {
  constructor() {
    this.writeQueue = [];
    this.flushing   = false;
    this.flushLog   = [];
    this.stats      = { queuedWrites: 0, flushedWrites: 0, pendingWrites: 0 };
    this._flushTimer = setInterval(() => this._flushQueue(), FLUSH_DELAY);
  }

  async createBuku(data) {
    const t0 = Date.now(), tempId = `wb-${Date.now()}`;
    const buku = { id: tempId, ...data, status: 'menunggu_tulis_db', createdAt: new Date().toISOString() };
    const cacheKey = `wb:buku:${tempId}`;
    redis.set(cacheKey, JSON.stringify(buku), { EX: CACHE_TTL });
    redis.del('wb:buku:all');
    this.writeQueue.push({ op: 'CREATE', data: { ...data }, cacheKey, queuedAt: new Date().toISOString() });
    this.stats.queuedWrites++;
    this.stats.pendingWrites = this.writeQueue.length;
    return { source: 'CACHE', cacheStatus: 'WRITE-BEHIND', data: buku, latency: `${Date.now()-t0}ms`, explanation: `Write-Behind: buku langsung ke cache (<1ms). DB write dimasukkan ke antrian (${this.writeQueue.length} item). Flush setiap ${FLUSH_DELAY/1000}s.`, queueSize: this.writeQueue.length };
  }

  async updateBuku(id, data) {
    const t0 = Date.now(), cacheKey = `wb:buku:${id}`;
    const cached = redis.get(cacheKey);
    const current = cached ? JSON.parse(cached) : { id };
    const updated = { ...current, ...data, updatedAt: new Date().toISOString(), status: 'menunggu_tulis_db' };
    redis.set(cacheKey, JSON.stringify(updated), { EX: CACHE_TTL });
    redis.del('wb:buku:all');
    this.writeQueue.push({ op: 'UPDATE', id, data, cacheKey, queuedAt: new Date().toISOString() });
    this.stats.queuedWrites++;
    this.stats.pendingWrites = this.writeQueue.length;
    return { source: 'CACHE', cacheStatus: 'WRITE-BEHIND', data: updated, latency: `${Date.now()-t0}ms`, explanation: 'Cache diperbarui segera. DB update dijadwalkan.', queueSize: this.writeQueue.length };
  }

  async getBuku(id) {
    const t0 = Date.now(), cacheKey = `wb:buku:${id}`;
    const cached = redis.get(cacheKey);
    if (cached) return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now()-t0}ms`, explanation: 'Buku dari cache (mungkin belum di-flush ke DB).' };
    const buku = await db.getBuku(id);
    if (!buku) return { error: 'Buku tidak ditemukan' };
    redis.set(cacheKey, JSON.stringify(buku), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'MISS', data: buku, latency: `${Date.now()-t0}ms`, explanation: 'Cache miss, diambil dari DB.' };
  }

  async _flushQueue() {
    if (this.flushing || this.writeQueue.length === 0) return;
    this.flushing = true;
    const batch = [...this.writeQueue];
    this.writeQueue.length = 0;
    const results = [];
    for (const item of batch) {
      try {
        if (item.op === 'CREATE') { const saved = await db.createBuku(item.data); results.push({ op: item.op, status: 'flushed', id: saved.id }); this.stats.flushedWrites++; }
        else if (item.op === 'UPDATE') { await db.updateBuku(item.id, item.data); results.push({ op: item.op, status: 'flushed', id: item.id }); this.stats.flushedWrites++; }
      } catch (e) { results.push({ op: item.op, status: 'error', error: e.message }); this.writeQueue.push(item); }
    }
    this.stats.pendingWrites = this.writeQueue.length;
    this.flushLog.push({ flushedAt: new Date().toISOString(), count: batch.length, results });
    if (this.flushLog.length > 10) this.flushLog.shift();
    this.flushing = false;
  }

  async forceFlush() { await this._flushQueue(); return { message: 'Antrian berhasil ditulis ke DB', log: this.flushLog.slice(-1)[0] || null }; }

  getQueueStatus() {
    return { pendingWrites: this.writeQueue.length, queue: this.writeQueue, stats: this.stats, flushIntervalMs: FLUSH_DELAY, recentFlushes: this.flushLog.slice(-3) };
  }

  destroy() { clearInterval(this._flushTimer); }
}
module.exports = new WriteBehindStrategy();
