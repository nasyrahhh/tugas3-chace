// ================================================
// STATS ROUTES  /api/stats
// ================================================
const router    = require('express').Router();
const redis     = require('../simulations/RedisSimulation');
const memcached = require('../simulations/MemcachedSimulation');
const cdn       = require('../simulations/CDNSimulation');
const eviction  = require('../simulations/EvictionStrategies');
const db        = require('../data/mockDatabase');

/**
 * GET /api/stats  — all-in-one dashboard
 */
router.get('/', (req, res) => {
  res.json({
    title:     'Cache Perpustakaan Digital � Dashboard Statistik',
    timestamp: new Date().toISOString(),
    redis:     redis.info().stats,
    memcached: {
      get_hits:    memcached.stats.get_hits,
      get_misses:  memcached.stats.get_misses,
      hit_rate:    (() => { const t = memcached.stats.get_hits + memcached.stats.get_misses; return t > 0 ? `${((memcached.stats.get_hits/t)*100).toFixed(2)}%` : '0%'; })(),
      curr_items:  memcached.stats.curr_items,
      evictions:   memcached.stats.evictions,
    },
    cdn: {
      totalRequests:   cdn.stats.totalRequests,
      edgeHits:        cdn.stats.edgeHits,
      originRequests:  cdn.stats.originRequests,
      hitRate:         cdn.stats.totalRequests > 0 ? `${((cdn.stats.edgeHits / cdn.stats.totalRequests)*100).toFixed(2)}%` : '0%',
    },
    eviction: {
      lru:  eviction.lru.getStats(),
      lfu:  eviction.lfu.getStats(),
      fifo: eviction.fifo.getStats(),
      ttl:  eviction.ttl.getStats(),
    },
    database: db.getStats(),
  });
});

router.get('/redis',     (req, res) => res.json(redis.info()));
router.get('/memcached', (req, res) => res.json(memcached.stats_cmd()));
router.get('/cdn',       (req, res) => res.json(cdn.getStats()));
router.get('/eviction',  (req, res) => res.json({
  lru:  eviction.lru.getStats(),
  lfu:  eviction.lfu.getStats(),
  fifo: eviction.fifo.getStats(),
  ttl:  eviction.ttl.getStats(),
}));
router.get('/database',  (req, res) => res.json(db.getStats()));

/**
 * GET /api/stats/comparison  — side-by-side comparison of all cache types
 */
router.get('/comparison', (req, res) => {
  const redisStats   = redis.info().stats;
  const memStats     = memcached.stats_cmd();
  const cdnStats     = cdn.getStats();

  res.json({
    title: 'Cache System Comparison',
    comparison: [
      {
        system:    'Redis (in-memory)',
        type:      'Key-Value + Struktur Data',
        hitRate:   redisStats.hit_rate,
        totalOps:  redisStats.total_commands,
        hits:      redisStats.keyspace_hits,
        misses:    redisStats.keyspace_misses,
        features:  ['String/Hash/List/Set/ZSet', 'TTL per key', 'Pub/Sub', 'Persistence', 'Cluster'],
      },
      {
        system:    'Memcached (in-memory)',
        type:      'Key-Value Sederhana',
        hitRate:   memStats.hit_rate,
        totalOps:  memStats.get_hits + memStats.get_misses,
        hits:      memStats.get_hits,
        misses:    memStats.get_misses,
        features:  ['String only', 'TTL per item', 'CAS', 'Multi-threaded', 'Simpel & cepat'],
      },
      {
        system:    'CDN',
        type:      'Distributed Edge Cache',
        hitRate:   cdnStats.overallHitRate,
        totalOps:  cdnStats.totalRequests,
        hits:      cdnStats.edgeHits,
        misses:    cdnStats.originRequests,
        features:  ['Geographic distribution', 'Content-type TTL', 'ETag / 304', 'Invalidation', 'Origin shielding'],
      },
    ],
    evictionPolicies: {
      LRU:  { description: 'Least Recently Used — evict item not accessed for longest time', hitRate: eviction.lru.getStats().hitRate },
      LFU:  { description: 'Least Frequently Used — evict item accessed fewest times',       hitRate: eviction.lfu.getStats().hitRate },
      FIFO: { description: 'First In First Out — evict oldest inserted item',                hitRate: eviction.fifo.getStats().hitRate },
      TTL:  { description: 'Time To Live — evict item after fixed time window',              hitRate: eviction.ttl.getStats().hitRate  },
    },
    cachePatterns: {
      'Cache-Aside':    'App manages cache; miss → load from DB → populate cache',
      'Read-Through':   'Cache layer transparently loads from DB on miss',
      'Write-Through':  'Write to cache AND DB simultaneously',
      'Write-Behind':   'Write to cache immediately; DB write is async/queued',
    },
  });
});

/**
 * POST /api/stats/reset  — reset all stats
 */
router.post('/reset', (req, res) => {
  redis.resetStats();
  memcached.resetStats();
  cdn.resetStats();
  eviction.lru.reset();
  eviction.lfu.reset();
  eviction.fifo.reset();
  eviction.ttl.reset();
  db.reset();
  res.json({ message: 'All stats and caches reset to initial state', timestamp: new Date().toISOString() });
});

module.exports = router;

