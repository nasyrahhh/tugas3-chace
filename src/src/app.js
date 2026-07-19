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
    title:       'Caching Simulation API',
    description: 'Simulasi lengkap: Redis, Memcached, CDN, Cache Strategies, Eviction Policies',
    version:     '1.0.0',
    endpoints: {
      strategies: {
        base:     '/api/strategies',
        patterns: ['cache-aside', 'write-through', 'write-behind', 'read-through'],
        examples: [
          'GET  /api/strategies/cache-aside/products',
          'GET  /api/strategies/cache-aside/products/1',
          'POST /api/strategies/write-through/products',
          'GET  /api/strategies/write-behind/queue',
        ],
      },
      redis: {
        base:     '/api/redis',
        commands: ['set','get','del','expire','ttl','keys','mset','mget','incr','decr','hset','hgetall','lpush','lrange','sadd','smembers','zadd','zrange'],
        examples: [
          'POST /api/redis/set    { "key":"user:1","value":"Budi","ex":60 }',
          'GET  /api/redis/get/user:1',
          'POST /api/redis/hset   { "key":"session:1","fields":{"userId":"1"} }',
          'POST /api/redis/lpush  { "key":"queue","values":["job1","job2"] }',
        ],
      },
      memcached: {
        base:     '/api/memcached',
        commands: ['set','get','gets','delete','add','replace','cas','append','prepend','incr','decr','stats','flush'],
        examples: [
          'POST /api/memcached/set  { "key":"product:1","value":"Laptop","ttl":30 }',
          'GET  /api/memcached/gets/product:1   (returns CAS token)',
          'POST /api/memcached/cas  { "key":"product:1","value":"Laptop Pro","ttl":30,"casToken":"..." }',
        ],
      },
      cdn: {
        base:     '/api/cdn',
        features: ['resource caching','edge servers','invalidation','purge'],
        examples: [
          'GET  /api/cdn/resource?url=/images/logo.png&edge=JKT',
          'GET  /api/cdn/resource?url=/api/products&edge=SIN',
          'POST /api/cdn/invalidate  { "url":"/images/logo.png" }',
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
          'GET  /api/stats/comparison (side-by-side comparison)',
          'POST /api/stats/reset      (reset everything)',
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
  console.log(`\n  Caching Simulation API  →  http://localhost:${PORT}`);
  console.log('────────────────────────────────────────────');
  console.log('  GET  /                      API overview');
  console.log('  *    /api/strategies         Cache patterns (Cache-Aside, Write-Through, Write-Behind, Read-Through)');
  console.log('  *    /api/redis              Redis simulation');
  console.log('  *    /api/memcached          Memcached simulation');
  console.log('  *    /api/cdn                CDN simulation');
  console.log('  *    /api/eviction           Eviction policies (LRU, LFU, FIFO, TTL)');
  console.log('  *    /api/stats              Statistics & comparison');
  console.log('────────────────────────────────────────────\n');
});

module.exports = app;
