require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const app = express();

// ── Middleware ────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));

// ── Root ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    title:       'Cache Perpustakaan Digital API',
    description: 'Simulasi caching pada sistem perpustakaan digital: Redis, Memcached, CDN, Strategi Cache & Eviction Policies',
    version:     '1.0.0',
    endpoints: {
      strategies: {
        base:     '/api/strategies',
        patterns: ['cache-aside', 'write-through', 'write-behind', 'read-through'],
        examples: [
          'GET  /api/strategies/cache-aside/buku',
          'GET  /api/strategies/cache-aside/buku/1',
          'POST /api/strategies/write-through/buku',
          'GET  /api/strategies/write-behind/antrian',
        ],
      },
      redis: {
        base:     '/api/redis',
        commands: ['set','get','del','expire','ttl','keys','mset','mget','incr','decr','hset','hgetall','lpush','lrange','sadd','smembers','zadd','zrange'],
        examples: [
          'POST /api/redis/set    { "key":"sesi:member:1","value":"Rina","ex":60 }',
          'GET  /api/redis/get/sesi:member:1',
          'POST /api/redis/hset   { "key":"pinjam:1","fields":{"userId":"1"} }',
          'POST /api/redis/lpush  { "key":"notif","values":["berita1","berita2"] }',
        ],
      },
      memcached: {
        base:     '/api/memcached',
        commands: ['set','get','gets','delete','add','replace','cas','append','prepend','incr','decr','stats','flush'],
        examples: [
          'POST /api/memcached/set  { "key":"buku:1","value":"Berita AI","ttl":30 }',
          'GET  /api/memcached/gets/buku:1   (returns CAS token)',
          'POST /api/memcached/cas  { "key":"buku:1","value":"Berita AI Update","ttl":30,"casToken":"..." }',
        ],
      },
      cdn: {
        base:     '/api/cdn',
        features: ['resource caching','edge servers','invalidation','purge'],
        examples: [
          'GET  /api/cdn/resource?url=/assets/logo-pustaka.png&edge=JKT',
          'GET  /api/cdn/resource?url=/api/buku&edge=SIN',
          'POST /api/cdn/invalidate  { "url":"/assets/logo-pustaka.png" }',
          'GET  /api/cdn/edges',
        ],
      },
      eviction: {
        base:     '/api/eviction',
        policies: ['LRU','LFU','FIFO','TTL'],
        examples: [
          'GET  /api/eviction/lru/demo',
          'GET  /api/eviction/lfu/demo',
          'GET  /api/eviction/fifo/demo',
          'GET  /api/eviction/ttl/demo',
        ],
      },
      stats: {
        base:     '/api/stats',
        examples: [
          'GET  /api/stats            (dashboard)',
          'GET  /api/stats/comparison (perbandingan sistem cache)',
          'POST /api/stats/reset      (reset semua data)',
        ],
      },
    },
  });
});

// ── Routes ────────────────────────────────────────
app.use('/api/strategies', require('./routes/cacheStrategyRoutes'));
app.use('/api/redis',      require('./routes/redisRoutes'));
app.use('/api/memcached',  require('./routes/memcachedRoutes'));
app.use('/api/cdn',        require('./routes/cdnRoutes'));
app.use('/api/eviction',   require('./routes/evictionRoutes'));
app.use('/api/stats',      require('./routes/statsRoutes'));

// ── 404 ───────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found', path: req.path }));

// ── Error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Cache Perpustakaan Digital API  →  http://localhost:${PORT}`);
  console.log('────────────────────────────────────────────');
  console.log('  GET  /                      Ringkasan API');
  console.log('  *    /api/strategies         Pola Cache (Cache-Aside, Write-Through, Write-Behind, Read-Through)');
  console.log('  *    /api/redis              Simulasi Redis');
  console.log('  *    /api/memcached          Simulasi Memcached');
  console.log('  *    /api/cdn                Simulasi CDN');
  console.log('  *    /api/eviction           Kebijakan Eviction (LRU, LFU, FIFO, TTL)');
  console.log('  *    /api/stats              Statistik & Perbandingan');
  console.log('────────────────────────────────────────────\n');
});

module.exports = app;

