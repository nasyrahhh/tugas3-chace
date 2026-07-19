// ================================================
// EVICTION STRATEGIES
// Implementasi empat kebijakan eviction:
//
//  1. LRU  — Least Recently Used
//  2. LFU  — Least Frequently Used
//  3. FIFO — First In, First Out
//  4. TTL  — Time To Live (time-based expiry)
// ================================================

// ─────────────────────────────────────────────────
// 1. LRU CACHE  (Doubly-Linked-List + HashMap O(1))
// ─────────────────────────────────────────────────
class LRUCache {
  constructor(capacity = 5) {
    this.capacity = capacity;
    this.cache    = new Map();   // key → value  (Map preserves insertion order)
    this.evicted  = [];          // eviction log
    this.stats    = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  get(key) {
    if (!this.cache.has(key)) { this.stats.misses++; return null; }
    // Move to end (most-recently-used position)
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    this.stats.hits++;
    return val;
  }

  set(key, value) {
    this.stats.sets++;
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      const lruKey = this.cache.keys().next().value;   // first = LRU
      this.evicted.push({ key: lruKey, value: this.cache.get(lruKey), evictedAt: new Date().toISOString(), reason: 'LRU' });
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
    this.cache.set(key, value);
  }

  delete(key) { return this.cache.delete(key); }
  clear()     { this.cache.clear(); this.evicted = []; }

  inspect() {
    const items = [];
    let rank = 1;
    for (const [k, v] of this.cache) items.unshift({ rank: rank++, key: k, value: v });
    // rank 1 = most recently used
    return items;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      capacity:   this.capacity,
      size:       this.cache.size,
      hits:       this.stats.hits,
      misses:     this.stats.misses,
      evictions:  this.stats.evictions,
      sets:       this.stats.sets,
      hitRate:    total > 0 ? `${((this.stats.hits / total) * 100).toFixed(2)}%` : '0%',
      recentEvictions: this.evicted.slice(-5),
    };
  }

  reset() { this.cache.clear(); this.evicted = []; this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 }; }
}

// ─────────────────────────────────────────────────
// 2. LFU CACHE
// ─────────────────────────────────────────────────
class LFUCache {
  constructor(capacity = 5) {
    this.capacity = capacity;
    this.cache    = new Map();   // key → { value, freq }
    this.freqMap  = new Map();   // freq → Set<key>
    this.minFreq  = 0;
    this.evicted  = [];
    this.stats    = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  _incrementFreq(key) {
    const { freq } = this.cache.get(key);
    this.freqMap.get(freq).delete(key);
    if (this.freqMap.get(freq).size === 0) {
      this.freqMap.delete(freq);
      if (this.minFreq === freq) this.minFreq++;
    }
    const nf = freq + 1;
    if (!this.freqMap.has(nf)) this.freqMap.set(nf, new Set());
    this.freqMap.get(nf).add(key);
    this.cache.get(key).freq = nf;
  }

  get(key) {
    if (!this.cache.has(key)) { this.stats.misses++; return null; }
    this._incrementFreq(key);
    this.stats.hits++;
    return this.cache.get(key).value;
  }

  set(key, value) {
    this.stats.sets++;
    if (this.capacity <= 0) return;
    if (this.cache.has(key)) {
      this.cache.get(key).value = value;
      this._incrementFreq(key);
      return;
    }
    if (this.cache.size >= this.capacity) {
      const lfuSet  = this.freqMap.get(this.minFreq);
      const evictKey = lfuSet.values().next().value;
      lfuSet.delete(evictKey);
      if (lfuSet.size === 0) this.freqMap.delete(this.minFreq);
      this.evicted.push({ key: evictKey, value: this.cache.get(evictKey).value, freq: this.minFreq, evictedAt: new Date().toISOString(), reason: 'LFU' });
      this.cache.delete(evictKey);
      this.stats.evictions++;
    }
    this.cache.set(key, { value, freq: 1 });
    if (!this.freqMap.has(1)) this.freqMap.set(1, new Set());
    this.freqMap.get(1).add(key);
    this.minFreq = 1;
  }

  delete(key) {
    if (!this.cache.has(key)) return false;
    const { freq } = this.cache.get(key);
    this.freqMap.get(freq)?.delete(key);
    this.cache.delete(key);
    return true;
  }

  inspect() {
    return [...this.cache.entries()].map(([k, v]) => ({ key: k, value: v.value, accessFrequency: v.freq }))
      .sort((a, b) => b.accessFrequency - a.accessFrequency);
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      capacity:        this.capacity,
      size:            this.cache.size,
      hits:            this.stats.hits,
      misses:          this.stats.misses,
      evictions:       this.stats.evictions,
      sets:            this.stats.sets,
      hitRate:         total > 0 ? `${((this.stats.hits / total) * 100).toFixed(2)}%` : '0%',
      recentEvictions: this.evicted.slice(-5),
    };
  }

  reset() { this.cache.clear(); this.freqMap.clear(); this.minFreq = 0; this.evicted = []; this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 }; }
}

// ─────────────────────────────────────────────────
// 3. FIFO CACHE
// ─────────────────────────────────────────────────
class FIFOCache {
  constructor(capacity = 5) {
    this.capacity = capacity;
    this.cache    = new Map();   // maintains insertion order
    this.evicted  = [];
    this.stats    = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  get(key) {
    if (!this.cache.has(key)) { this.stats.misses++; return null; }
    this.stats.hits++;
    return this.cache.get(key);
  }

  set(key, value) {
    this.stats.sets++;
    if (this.cache.has(key)) { this.cache.set(key, value); return; }
    if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.evicted.push({ key: firstKey, value: this.cache.get(firstKey), evictedAt: new Date().toISOString(), reason: 'FIFO' });
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    this.cache.set(key, value);
  }

  delete(key) { return this.cache.delete(key); }

  inspect() {
    return [...this.cache.entries()].map(([k, v], i) => ({ position: i + 1, key: k, value: v, note: i === 0 ? '← next to be evicted' : '' }));
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      capacity:        this.capacity,
      size:            this.cache.size,
      hits:            this.stats.hits,
      misses:          this.stats.misses,
      evictions:       this.stats.evictions,
      sets:            this.stats.sets,
      hitRate:         total > 0 ? `${((this.stats.hits / total) * 100).toFixed(2)}%` : '0%',
      recentEvictions: this.evicted.slice(-5),
    };
  }

  reset() { this.cache.clear(); this.evicted = []; this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 }; }
}

// ─────────────────────────────────────────────────
// 4. TTL CACHE  (time-based expiry, no size limit)
// ─────────────────────────────────────────────────
class TTLCache {
  constructor(defaultTtlSec = 30) {
    this.defaultTtl = defaultTtlSec;
    this.store      = new Map();  // key → { value, expiresAt }
    this.stats      = { hits: 0, misses: 0, expired: 0, sets: 0 };
    this._sweepInterval = setInterval(() => this._sweep(), 1000);
  }

  set(key, value, ttlSec) {
    this.stats.sets++;
    const ttl = ttlSec !== undefined ? ttlSec : this.defaultTtl;
    this.store.set(key, {
      value,
      ttlSec:    ttl,
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
      storedAt:  new Date().toISOString(),
    });
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) { this.stats.misses++; return null; }
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.stats.expired++;
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return item.value;
  }

  ttl(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (!item.expiresAt) return Infinity;
    const remaining = Math.ceil((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }

  delete(key) { return this.store.delete(key); }

  list() {
    const now = Date.now();
    return [...this.store.entries()].map(([k, v]) => ({
      key:       k,
      value:     v.value,
      ttlSec:    v.ttlSec,
      remainingSec: v.expiresAt ? Math.max(0, Math.ceil((v.expiresAt - now) / 1000)) : '∞',
      storedAt:  v.storedAt,
      expired:   v.expiresAt ? now > v.expiresAt : false,
    }));
  }

  _sweep() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt && now > v.expiresAt) { this.store.delete(k); this.stats.expired++; }
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      size:       this.store.size,
      defaultTtl: `${this.defaultTtl}s`,
      hits:       this.stats.hits,
      misses:     this.stats.misses,
      expired:    this.stats.expired,
      sets:       this.stats.sets,
      hitRate:    total > 0 ? `${((this.stats.hits / total) * 100).toFixed(2)}%` : '0%',
    };
  }

  reset() { this.store.clear(); this.stats = { hits: 0, misses: 0, expired: 0, sets: 0 }; }
  destroy() { clearInterval(this._sweepInterval); }
}

// Singleton instances (capacity = 5 to easily trigger evictions in demo)
module.exports = {
  lru:  new LRUCache(5),
  lfu:  new LFUCache(5),
  fifo: new FIFOCache(5),
  ttl:  new TTLCache(30),
  LRUCache,
  LFUCache,
  FIFOCache,
  TTLCache,
};
