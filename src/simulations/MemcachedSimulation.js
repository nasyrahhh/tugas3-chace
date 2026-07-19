// ================================================
// MEMCACHED SIMULATION
// Mensimulasikan Memcached:
//   - Key-value only (no complex data types)
//   - TTL per item
//   - CAS (Check-And-Set) optimistic locking
//   - add / replace / append / prepend
//   - incr / decr on numeric values
//   - Max key size: 250 bytes, max value: 1 MB
//   - Slab stats (simplified)
// ================================================

const MAX_KEY_SIZE   = 250;
const MAX_VALUE_SIZE = 1024 * 1024; // 1 MB

class MemcachedSimulation {
  constructor() {
    this.store   = new Map(); // key → { value, flags, ttl, expiresAt, casToken, bytes }
    this.stats   = {
      curr_items:     0,
      total_items:    0,
      bytes:          0,
      get_hits:       0,
      get_misses:     0,
      set_hits:       0,
      delete_hits:    0,
      delete_misses:  0,
      incr_hits:      0,
      incr_misses:    0,
      cas_hits:       0,
      cas_misses:     0,
      cas_badval:     0,
      evictions:      0,
      startTime:      Date.now(),
    };
    this._casCounter = 1n;
    this._sweepInterval = setInterval(() => this._sweep(), 1000);
  }

  // ── Internal helpers ──────────────────────────
  _nextCas()  { return String(this._casCounter++); }

  _validate(key, value = '') {
    if (!key || String(key).length > MAX_KEY_SIZE) throw new Error(`CLIENT_ERROR key too long (max ${MAX_KEY_SIZE})`);
    if (Buffer.byteLength(String(value)) > MAX_VALUE_SIZE) throw new Error('SERVER_ERROR object too large for cache');
  }

  _expired(item) { return item.expiresAt && Date.now() > item.expiresAt; }

  _getItem(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (this._expired(item)) {
      this.stats.bytes    -= item.bytes;
      this.stats.curr_items--;
      this.store.delete(key);
      this.stats.evictions++;
      return null;
    }
    return item;
  }

  _sweep() {
    for (const [k, item] of this.store) {
      if (this._expired(item)) {
        this.stats.bytes    -= item.bytes;
        this.stats.curr_items--;
        this.store.delete(k);
        this.stats.evictions++;
      }
    }
  }

  // ── Core commands ─────────────────────────────

  /**
   * SET — store key, always
   */
  set(key, value, ttlSec = 0, flags = 0) {
    this._validate(key, value);
    const strVal = String(value);
    const bytes  = Buffer.byteLength(strVal);

    const existing = this.store.get(key);
    if (existing) {
      this.stats.bytes      -= existing.bytes;
      this.stats.curr_items--;
    }

    this.store.set(key, {
      value:     strVal,
      flags:     Number(flags),
      ttl:       Number(ttlSec),
      expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : null,
      casToken:  this._nextCas(),
      bytes,
      storedAt:  Date.now(),
    });

    this.stats.bytes      += bytes;
    this.stats.curr_items++;
    this.stats.total_items++;
    this.stats.set_hits++;
    return 'STORED';
  }

  /**
   * ADD — store only if key does NOT exist
   */
  add(key, value, ttlSec = 0, flags = 0) {
    this._validate(key, value);
    if (this._getItem(key)) return 'NOT_STORED';
    return this.set(key, value, ttlSec, flags);
  }

  /**
   * REPLACE — store only if key DOES exist
   */
  replace(key, value, ttlSec = 0, flags = 0) {
    this._validate(key, value);
    if (!this._getItem(key)) return 'NOT_STORED';
    return this.set(key, value, ttlSec, flags);
  }

  /**
   * GET
   */
  get(key) {
    const item = this._getItem(key);
    if (!item) { this.stats.get_misses++; return null; }
    this.stats.get_hits++;
    return { value: item.value, flags: item.flags };
  }

  /**
   * GETS — GET with CAS token
   */
  gets(key) {
    const item = this._getItem(key);
    if (!item) { this.stats.get_misses++; return null; }
    this.stats.get_hits++;
    return { value: item.value, flags: item.flags, casToken: item.casToken };
  }

  /**
   * CAS — Check-And-Set (optimistic locking)
   */
  cas(key, value, ttlSec, casToken, flags = 0) {
    this._validate(key, value);
    const item = this._getItem(key);
    if (!item) { this.stats.cas_misses++; return 'NOT_FOUND'; }
    if (item.casToken !== String(casToken)) { this.stats.cas_badval++; return 'EXISTS'; }
    this.stats.cas_hits++;
    return this.set(key, value, ttlSec, flags);
  }

  /**
   * DELETE
   */
  delete(key) {
    const item = this._getItem(key);
    if (!item) { this.stats.delete_misses++; return 'NOT_FOUND'; }
    this.stats.bytes      -= item.bytes;
    this.stats.curr_items--;
    this.store.delete(key);
    this.stats.delete_hits++;
    return 'DELETED';
  }

  /**
   * APPEND — append to existing value
   */
  append(key, value) {
    const item = this._getItem(key);
    if (!item) return 'NOT_STORED';
    return this.set(key, item.value + String(value), item.ttl, item.flags);
  }

  /**
   * PREPEND — prepend to existing value
   */
  prepend(key, value) {
    const item = this._getItem(key);
    if (!item) return 'NOT_STORED';
    return this.set(key, String(value) + item.value, item.ttl, item.flags);
  }

  /**
   * INCR
   */
  incr(key, amount = 1) {
    const item = this._getItem(key);
    if (!item) { this.stats.incr_misses++; return 'NOT_FOUND'; }
    const n = parseInt(item.value, 10);
    if (isNaN(n)) return 'CLIENT_ERROR cannot increment or decrement non-numeric value';
    const newVal = Math.max(0, n + Number(amount));
    this.set(key, String(newVal), item.ttl, item.flags);
    this.stats.incr_hits++;
    return newVal;
  }

  /**
   * DECR
   */
  decr(key, amount = 1) {
    return this.incr(key, -Math.abs(Number(amount)));
  }

  /**
   * FLUSH_ALL — wipe everything
   */
  flush_all() {
    this.store.clear();
    this.stats.curr_items = 0;
    this.stats.bytes      = 0;
    return 'OK';
  }

  /**
   * STATS
   */
  stats_cmd() {
    const total = this.stats.get_hits + this.stats.get_misses;
    return {
      pid:              process.pid,
      uptime:           Math.floor((Date.now() - this.stats.startTime) / 1000),
      version:          '1.6.22-sim',
      curr_items:       this.stats.curr_items,
      total_items:      this.stats.total_items,
      bytes:            this.stats.bytes,
      max_value_size:   `${MAX_VALUE_SIZE / 1024}KB`,
      get_hits:         this.stats.get_hits,
      get_misses:       this.stats.get_misses,
      hit_rate:         total > 0 ? `${((this.stats.get_hits / total) * 100).toFixed(2)}%` : '0%',
      set_hits:         this.stats.set_hits,
      delete_hits:      this.stats.delete_hits,
      delete_misses:    this.stats.delete_misses,
      incr_hits:        this.stats.incr_hits,
      incr_misses:      this.stats.incr_misses,
      cas_hits:         this.stats.cas_hits,
      cas_misses:       this.stats.cas_misses,
      cas_badval:       this.stats.cas_badval,
      evictions:        this.stats.evictions,
    };
  }

  resetStats() {
    Object.assign(this.stats, {
      total_items: 0, get_hits: 0, get_misses: 0, set_hits: 0,
      delete_hits: 0, delete_misses: 0, incr_hits: 0, incr_misses: 0,
      cas_hits: 0, cas_misses: 0, cas_badval: 0, evictions: 0,
      startTime: Date.now(),
    });
  }

  destroy() { clearInterval(this._sweepInterval); }
}

module.exports = new MemcachedSimulation();
