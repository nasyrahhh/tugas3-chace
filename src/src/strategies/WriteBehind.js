// ================================================
// WRITE-BEHIND (WRITE-BACK)
// Alur:
//   WRITE → tulis ke CACHE saja, segera return
//           → DB ditulis secara ASYNC (queue)
//   READ  → dari cache
//
// Keuntungan : Write sangat cepat (non-blocking DB)
// Kekurangan : Risiko kehilangan data jika crash sebelum flush
// ================================================
const redis = require('../simulations/RedisSimulation');
const db    = require('../data/mockDatabase');

const CACHE_TTL  = 120;
const FLUSH_DELAY = 5000; // ms – simulate periodic flush to DB

class WriteBehindStrategy {
  constructor() {
    this.writeQueue   = [];   // pending DB writes
    this.flushing     = false;
    this.flushLog     = [];   // log of past flushes
    this.stats        = { queuedWrites: 0, flushedWrites: 0, pendingWrites: 0 };

    // Periodic flush every FLUSH_DELAY ms
    this._flushTimer = setInterval(() => this._flushQueue(), FLUSH_DELAY);
  }

  // ── WRITE (to cache only) ─────────────────────
  async createProduct(data) {
    const t0 = Date.now();

    // Generate a temporary id for the cache key
    const tempId   = `wb-${Date.now()}`;
    const product  = { id: tempId, ...data, status: 'pending_db_write', createdAt: new Date().toISOString() };
    const cacheKey = `wb:product:${tempId}`;

    redis.set(cacheKey, JSON.stringify(product), { EX: CACHE_TTL });
    redis.del('wb:products:all');

    // Enqueue DB write
    this.writeQueue.push({ op: 'CREATE', data: { ...data }, cacheKey, queuedAt: new Date().toISOString() });
    this.stats.queuedWrites++;
    this.stats.pendingWrites = this.writeQueue.length;

    return {
      source:      'CACHE',
      cacheStatus: 'WRITE-BEHIND',
      data:        product,
      latency:     `${Date.now() - t0}ms`,
      explanation: `Write-Behind: data langsung ke cache (< 1ms). DB write dimasukkan ke queue (${this.writeQueue.length} item pending). Flush setiap ${FLUSH_DELAY / 1000}s.`,
      queueSize:   this.writeQueue.length,
    };
  }

  async updateProduct(id, data) {
    const t0       = Date.now();
    const cacheKey = `wb:product:${id}`;
    const cached   = redis.get(cacheKey);

    const current  = cached ? JSON.parse(cached) : { id };
    const updated  = { ...current, ...data, updatedAt: new Date().toISOString(), status: 'pending_db_write' };
    redis.set(cacheKey, JSON.stringify(updated), { EX: CACHE_TTL });
    redis.del('wb:products:all');

    this.writeQueue.push({ op: 'UPDATE', id, data, cacheKey, queuedAt: new Date().toISOString() });
    this.stats.queuedWrites++;
    this.stats.pendingWrites = this.writeQueue.length;

    return {
      source:      'CACHE',
      cacheStatus: 'WRITE-BEHIND',
      data:        updated,
      latency:     `${Date.now() - t0}ms`,
      explanation: 'Cache diperbarui segera. DB update dijadwalkan.',
      queueSize:   this.writeQueue.length,
    };
  }

  // ── READ ─────────────────────────────────────
  async getProduct(id) {
    const t0       = Date.now();
    const cacheKey = `wb:product:${id}`;

    const cached = redis.get(cacheKey);
    if (cached) {
      return { source: 'CACHE', cacheStatus: 'HIT', data: JSON.parse(cached), latency: `${Date.now() - t0}ms`, explanation: 'Data dari cache (mungkin belum di-flush ke DB).' };
    }

    const product = await db.getProduct(id);
    if (!product) return { error: 'Product not found' };
    redis.set(cacheKey, JSON.stringify(product), { EX: CACHE_TTL });
    return { source: 'DATABASE', cacheStatus: 'MISS', data: product, latency: `${Date.now() - t0}ms`, explanation: 'Cache miss, diambil dari DB.' };
  }

  // ── Queue management ─────────────────────────
  async _flushQueue() {
    if (this.flushing || this.writeQueue.length === 0) return;
    this.flushing = true;
    const batch   = [...this.writeQueue];
    this.writeQueue.length = 0;

    const results = [];
    for (const item of batch) {
      try {
        if (item.op === 'CREATE') {
          const saved = await db.createProduct(item.data);
          results.push({ op: item.op, status: 'flushed', id: saved.id });
          this.stats.flushedWrites++;
        } else if (item.op === 'UPDATE') {
          await db.updateProduct(item.id, item.data);
          results.push({ op: item.op, status: 'flushed', id: item.id });
          this.stats.flushedWrites++;
        }
      } catch (e) {
        results.push({ op: item.op, status: 'error', error: e.message });
        // Re-enqueue failed writes
        this.writeQueue.push(item);
      }
    }

    this.stats.pendingWrites = this.writeQueue.length;
    this.flushLog.push({ flushedAt: new Date().toISOString(), count: batch.length, results });
    if (this.flushLog.length > 10) this.flushLog.shift();
    this.flushing = false;
  }

  async forceFlush() {
    await this._flushQueue();
    return { message: 'Queue flushed to DB', log: this.flushLog.slice(-1)[0] || null };
  }

  getQueueStatus() {
    return {
      pendingWrites:  this.writeQueue.length,
      queue:          this.writeQueue,
      stats:          this.stats,
      flushIntervalMs: FLUSH_DELAY,
      recentFlushes:  this.flushLog.slice(-3),
    };
  }

  destroy() { clearInterval(this._flushTimer); }
}

module.exports = new WriteBehindStrategy();
