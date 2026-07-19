// ================================================
// REDIS SIMULATION
// Mensimulasikan Redis in-memory data structure store:
//   - String, Hash, List, Set, Sorted Set
//   - TTL / expiry per key
//   - INCR / DECR / APPEND
//   - Background key expiry sweep
//   - INFO statistics
// ================================================

class RedisSimulation {
  constructor(name = 'redis-sim') {
    this.name  = name;
    this.store = new Map(); // key → { value, type, expiresAt, createdAt, accessCount, lastAccessed }

    this.stats = {
      hits: 0, misses: 0,
      totalCommands: 0,
      setOps: 0, getOps: 0, delOps: 0,
      expiredKeys: 0,
      startTime: Date.now(),
    };

    // Background expiry sweep every 500 ms
    this._sweepInterval = setInterval(() => this._sweep(), 500);
  }

  // ── Helpers ───────────────────────────────────
  _expired(entry) { return entry.expiresAt && Date.now() > entry.expiresAt; }

  _entry(key) {
    const e = this.store.get(key);
    if (!e) return null;
    if (this._expired(e)) { this.store.delete(key); this.stats.expiredKeys++; return null; }
    e.accessCount++;
    e.lastAccessed = Date.now();
    return e;
  }

  _sweep() {
    for (const [k, e] of this.store) {
      if (this._expired(e)) { this.store.delete(k); this.stats.expiredKeys++; }
    }
  }

  _mkEntry(value, type, ttlSec = null) {
    return {
      value,
      type,
      createdAt:    Date.now(),
      expiresAt:    ttlSec ? Date.now() + ttlSec * 1000 : null,
      accessCount:  0,
      lastAccessed: Date.now(),
    };
  }

  // ── String ────────────────────────────────────
  set(key, value, options = {}) {
    this.stats.totalCommands++; this.stats.setOps++;
    if (options.NX && this.store.has(key))           return null;
    if (options.XX && !this._entry(key))             return null;
    const ttl = options.EX || null;
    this.store.set(key, this._mkEntry(String(value), 'string', ttl));
    return 'OK';
  }

  get(key) {
    this.stats.totalCommands++; this.stats.getOps++;
    const e = this._entry(key);
    if (!e) { this.stats.misses++; return null; }
    this.stats.hits++;
    return e.value;
  }

  mset(obj) {
    this.stats.totalCommands++;
    for (const [k, v] of Object.entries(obj)) this.set(k, v);
    return 'OK';
  }

  mget(keys) {
    this.stats.totalCommands++;
    return keys.map(k => this.get(k));
  }

  incr(key)           { return this.incrby(key, 1); }
  decr(key)           { return this.incrby(key, -1); }
  incrby(key, amount) {
    this.stats.totalCommands++;
    const e = this._entry(key);
    if (!e) { this.set(key, String(amount)); return amount; }
    const n = parseInt(e.value) + Number(amount);
    if (isNaN(n)) throw new Error('ERR value is not an integer');
    e.value = String(n);
    return n;
  }

  append(key, val) {
    this.stats.totalCommands++;
    const e = this._entry(key);
    if (!e) { this.set(key, val); return String(val).length; }
    e.value += val;
    return e.value.length;
  }

  strlen(key) {
    const e = this._entry(key);
    return e ? e.value.length : 0;
  }

  getset(key, newVal) {
    const old = this.get(key);
    this.set(key, newVal);
    return old;
  }

  // ── Key ops ───────────────────────────────────
  del(...keys) {
    this.stats.totalCommands++; this.stats.delOps++;
    return keys.filter(k => this.store.delete(k)).length;
  }

  exists(...keys) {
    this.stats.totalCommands++;
    return keys.filter(k => this._entry(k) !== null).length;
  }

  expire(key, sec) {
    this.stats.totalCommands++;
    const e = this.store.get(key);
    if (!e || this._expired(e)) return 0;
    e.expiresAt = Date.now() + sec * 1000;
    return 1;
  }

  ttl(key) {
    this.stats.totalCommands++;
    const e = this.store.get(key);
    if (!e || this._expired(e)) return -2;
    if (!e.expiresAt) return -1;
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000));
  }

  persist(key) {
    const e = this.store.get(key);
    if (!e || !e.expiresAt) return 0;
    e.expiresAt = null;
    return 1;
  }

  type(key) {
    const e = this._entry(key);
    return e ? e.type : 'none';
  }

  keys(pattern = '*') {
    this.stats.totalCommands++;
    const rx = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.') + '$');
    const out = [];
    for (const [k, e] of this.store) {
      if (!this._expired(e) && rx.test(k)) out.push(k);
    }
    return out;
  }

  dbsize() {
    let n = 0;
    for (const e of this.store.values()) if (!this._expired(e)) n++;
    return n;
  }

  rename(key, newKey) {
    const e = this.store.get(key);
    if (!e) throw new Error('ERR no such key');
    this.store.set(newKey, e);
    this.store.delete(key);
    return 'OK';
  }

  flushdb() { this.store.clear(); return 'OK'; }
  flushall() { return this.flushdb(); }

  // ── Hash ──────────────────────────────────────
  hset(key, ...fieldValPairs) {
    this.stats.totalCommands++;
    let e = this.store.get(key);
    if (!e) { e = this._mkEntry({}, 'hash'); this.store.set(key, e); }
    if (e.type !== 'hash') throw new Error('WRONGTYPE');
    let added = 0;
    for (let i = 0; i < fieldValPairs.length; i += 2) {
      if (!Object.prototype.hasOwnProperty.call(e.value, fieldValPairs[i])) added++;
      e.value[fieldValPairs[i]] = String(fieldValPairs[i + 1]);
    }
    return added;
  }

  hget(key, field) {
    this.stats.totalCommands++;
    const e = this._entry(key);
    if (!e) { this.stats.misses++; return null; }
    this.stats.hits++;
    return Object.prototype.hasOwnProperty.call(e.value, field) ? e.value[field] : null;
  }

  hmset(key, obj) {
    const pairs = Object.entries(obj).flat();
    this.hset(key, ...pairs);
    return 'OK';
  }

  hgetall(key) {
    this.stats.totalCommands++;
    const e = this._entry(key);
    if (!e) { this.stats.misses++; return null; }
    this.stats.hits++;
    return { ...e.value };
  }

  hdel(key, ...fields) {
    const e = this._entry(key);
    if (!e) return 0;
    return fields.filter(f => { const had = f in e.value; delete e.value[f]; return had; }).length;
  }

  hexists(key, field) {
    const e = this._entry(key);
    return e && field in e.value ? 1 : 0;
  }

  hlen(key)  { const e = this._entry(key); return e ? Object.keys(e.value).length : 0; }
  hkeys(key) { const e = this._entry(key); return e ? Object.keys(e.value)   : []; }
  hvals(key) { const e = this._entry(key); return e ? Object.values(e.value) : []; }

  // ── List ──────────────────────────────────────
  _listEntry(key) {
    let e = this.store.get(key);
    if (!e) { e = this._mkEntry([], 'list'); this.store.set(key, e); }
    if (e.type !== 'list') throw new Error('WRONGTYPE');
    return e;
  }

  lpush(key, ...vals) { this.stats.totalCommands++; const e = this._listEntry(key); e.value.unshift(...[...vals].reverse()); return e.value.length; }
  rpush(key, ...vals) { this.stats.totalCommands++; const e = this._listEntry(key); e.value.push(...vals); return e.value.length; }
  lpop(key)           { this.stats.totalCommands++; const e = this._entry(key); return e ? (e.value.shift() ?? null) : null; }
  rpop(key)           { this.stats.totalCommands++; const e = this._entry(key); return e ? (e.value.pop()   ?? null) : null; }
  llen(key)           { const e = this._entry(key); return e ? e.value.length : 0; }

  lrange(key, start, stop) {
    this.stats.totalCommands++;
    const e = this._entry(key);
    if (!e) { this.stats.misses++; return []; }
    this.stats.hits++;
    const len = e.value.length;
    const s = start < 0 ? Math.max(0, len + start) : start;
    const en = stop < 0 ? len + stop + 1 : Math.min(stop + 1, len);
    return e.value.slice(s, en);
  }

  // ── Set ───────────────────────────────────────
  sadd(key, ...members) {
    this.stats.totalCommands++;
    let e = this.store.get(key);
    if (!e) { e = this._mkEntry(new Set(), 'set'); this.store.set(key, e); }
    if (e.type !== 'set') throw new Error('WRONGTYPE');
    const before = e.value.size;
    members.forEach(m => e.value.add(String(m)));
    return e.value.size - before;
  }

  smembers(key)           { this.stats.totalCommands++; const e = this._entry(key); if (!e) { this.stats.misses++; return []; } this.stats.hits++; return [...e.value]; }
  sismember(key, member)  { const e = this._entry(key); return e && e.value.has(String(member)) ? 1 : 0; }
  scard(key)              { const e = this._entry(key); return e ? e.value.size : 0; }
  srem(key, ...members)   { const e = this._entry(key); if (!e) return 0; return members.filter(m => e.value.delete(String(m))).length; }

  // ── Sorted Set ────────────────────────────────
  zadd(key, ...scoreMemberPairs) {
    this.stats.totalCommands++;
    let e = this.store.get(key);
    if (!e) { e = this._mkEntry(new Map(), 'zset'); this.store.set(key, e); }
    let added = 0;
    for (let i = 0; i < scoreMemberPairs.length; i += 2) {
      if (!e.value.has(String(scoreMemberPairs[i + 1]))) added++;
      e.value.set(String(scoreMemberPairs[i + 1]), Number(scoreMemberPairs[i]));
    }
    return added;
  }

  zscore(key, member) { const e = this._entry(key); return e ? (e.value.get(String(member)) ?? null) : null; }
  zcard(key)          { const e = this._entry(key); return e ? e.value.size : 0; }

  zrange(key, start, stop) {
    const e = this._entry(key);
    if (!e) return [];
    const sorted = [...e.value.entries()].sort((a, b) => a[1] - b[1]);
    const len = sorted.length;
    const s  = start < 0 ? Math.max(0, len + start) : start;
    const en = stop  < 0 ? len + stop + 1 : Math.min(stop + 1, len);
    return sorted.slice(s, en).map(([m]) => m);
  }

  // ── INFO ──────────────────────────────────────
  info() {
    const total = this.stats.hits + this.stats.misses;
    return {
      server:  { version: '7.2.0-sim', mode: 'standalone', uptime_seconds: Math.floor((Date.now() - this.stats.startTime) / 1000) },
      memory:  { total_keys: this.dbsize(), keys_with_ttl: [...this.store.values()].filter(e => e.expiresAt).length },
      stats:   {
        total_commands:  this.stats.totalCommands,
        keyspace_hits:   this.stats.hits,
        keyspace_misses: this.stats.misses,
        hit_rate:        total > 0 ? `${((this.stats.hits / total) * 100).toFixed(2)}%` : '0%',
        expired_keys:    this.stats.expiredKeys,
        set_ops:         this.stats.setOps,
        get_ops:         this.stats.getOps,
        del_ops:         this.stats.delOps,
      },
    };
  }

  resetStats() {
    this.stats = { hits: 0, misses: 0, totalCommands: 0, setOps: 0, getOps: 0, delOps: 0, expiredKeys: 0, startTime: Date.now() };
  }

  destroy() { clearInterval(this._sweepInterval); }
}

module.exports = new RedisSimulation('main-redis');
