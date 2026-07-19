// ================================================
// EVICTION ROUTES  /api/eviction
// ================================================
const router   = require('express').Router();
const eviction = require('../simulations/EvictionStrategies');

router.get('/', (req, res) => res.json({
  message: 'Cache Eviction Policies API',
  policies: {
    LRU:  '/api/eviction/lru',
    LFU:  '/api/eviction/lfu',
    FIFO: '/api/eviction/fifo',
    TTL:  '/api/eviction/ttl',
  },
  note: 'All caches have capacity=5 to easily trigger evictions',
}));

// ─────────────────────────────────────────────────
// LRU
// ─────────────────────────────────────────────────
router.get('/lru/demo', (req, res) => {
  eviction.lru.reset();
  const log = [];

  // Fill cache (5 items, capacity = 5)
  ['A','B','C','D','E'].forEach(k => { eviction.lru.set(k, `value-${k}`); log.push(`SET ${k}`); });
  log.push('--- Cache full (capacity: 5) ---');

  // Access B and D (makes them recently used)
  eviction.lru.get('B'); log.push('GET B  → B moved to MRU position');
  eviction.lru.get('D'); log.push('GET D  → D moved to MRU position');
  log.push(`Inspection before eviction: ${JSON.stringify(eviction.lru.inspect().map(i => `${i.key}(rank:${i.rank})`))}`);

  // Insert F → should evict A (Least Recently Used)
  eviction.lru.set('F', 'value-F'); log.push('SET F  → A evicted (least recently used)');

  res.json({
    policy:      'LRU — Least Recently Used',
    description: 'Item yang paling lama tidak diakses akan dikeluarkan pertama',
    operationLog: log,
    currentCache: eviction.lru.inspect(),
    stats:        eviction.lru.getStats(),
  });
});

router.post('/lru/set', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  eviction.lru.set(key, value);
  res.json({ action: 'SET', key, value, cache: eviction.lru.inspect(), stats: eviction.lru.getStats() });
});

router.get('/lru/get/:key', (req, res) => {
  const val = eviction.lru.get(req.params.key);
  res.json({ action: 'GET', key: req.params.key, result: val, found: val !== null, cache: eviction.lru.inspect(), stats: eviction.lru.getStats() });
});

router.get('/lru/inspect', (req, res) => res.json({ cache: eviction.lru.inspect(), stats: eviction.lru.getStats() }));
router.delete('/lru/clear', (req, res) => { eviction.lru.reset(); res.json({ message: 'LRU cache cleared' }); });

// ─────────────────────────────────────────────────
// LFU
// ─────────────────────────────────────────────────
router.get('/lfu/demo', (req, res) => {
  eviction.lfu.reset();
  const log = [];

  ['A','B','C','D','E'].forEach(k => { eviction.lfu.set(k, `value-${k}`); log.push(`SET ${k}`); });
  log.push('--- Cache full ---');

  // Access A 3x, B 2x, C 1x, D 0x, E 0x
  eviction.lfu.get('A'); eviction.lfu.get('A'); eviction.lfu.get('A'); log.push('GET A x3 → freq=4');
  eviction.lfu.get('B'); eviction.lfu.get('B');                         log.push('GET B x2 → freq=3');
  eviction.lfu.get('C');                                                 log.push('GET C x1 → freq=2');
  // D and E still freq=1

  log.push(`Frequencies: ${JSON.stringify(eviction.lfu.inspect().map(i => `${i.key}(f:${i.accessFrequency})`))}`);
  eviction.lfu.set('F', 'value-F');
  log.push('SET F  → D evicted (lowest frequency, inserted first among ties)');

  res.json({
    policy:       'LFU — Least Frequently Used',
    description:  'Item yang paling jarang diakses akan dikeluarkan pertama',
    operationLog: log,
    currentCache: eviction.lfu.inspect(),
    stats:        eviction.lfu.getStats(),
  });
});

router.post('/lfu/set', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  eviction.lfu.set(key, value);
  res.json({ action: 'SET', key, value, cache: eviction.lfu.inspect(), stats: eviction.lfu.getStats() });
});

router.get('/lfu/get/:key', (req, res) => {
  const val = eviction.lfu.get(req.params.key);
  res.json({ action: 'GET', key: req.params.key, result: val, found: val !== null, cache: eviction.lfu.inspect(), stats: eviction.lfu.getStats() });
});

router.get('/lfu/inspect', (req, res) => res.json({ cache: eviction.lfu.inspect(), stats: eviction.lfu.getStats() }));
router.delete('/lfu/clear', (req, res) => { eviction.lfu.reset(); res.json({ message: 'LFU cache cleared' }); });

// ─────────────────────────────────────────────────
// FIFO
// ─────────────────────────────────────────────────
router.get('/fifo/demo', (req, res) => {
  eviction.fifo.reset();
  const log = [];

  ['A','B','C','D','E'].forEach(k => { eviction.fifo.set(k, `value-${k}`); log.push(`SET ${k}`); });
  log.push('--- Cache full ---');

  // Access order does NOT matter in FIFO
  eviction.fifo.get('E'); eviction.fifo.get('E'); eviction.fifo.get('E');
  log.push('GET E x3 — access frequency/recency irrelevant in FIFO');

  eviction.fifo.set('F', 'value-F');
  log.push('SET F  → A evicted (first inserted, regardless of access)');

  res.json({
    policy:       'FIFO — First In, First Out',
    description:  'Item yang pertama masuk akan dikeluarkan pertama, terlepas dari akses',
    operationLog: log,
    currentCache: eviction.fifo.inspect(),
    stats:        eviction.fifo.getStats(),
  });
});

router.post('/fifo/set', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  eviction.fifo.set(key, value);
  res.json({ action: 'SET', key, value, cache: eviction.fifo.inspect(), stats: eviction.fifo.getStats() });
});

router.get('/fifo/get/:key', (req, res) => {
  const val = eviction.fifo.get(req.params.key);
  res.json({ action: 'GET', key: req.params.key, result: val, found: val !== null, cache: eviction.fifo.inspect(), stats: eviction.fifo.getStats() });
});

router.get('/fifo/inspect', (req, res) => res.json({ cache: eviction.fifo.inspect(), stats: eviction.fifo.getStats() }));
router.delete('/fifo/clear', (req, res) => { eviction.fifo.reset(); res.json({ message: 'FIFO cache cleared' }); });

// ─────────────────────────────────────────────────
// TTL
// ─────────────────────────────────────────────────
router.get('/ttl/demo', async (req, res) => {
  eviction.ttl.reset();
  const log = [];

  eviction.ttl.set('permanent', 'never expires',  0);  log.push('SET permanent  TTL=0 (no expiry)');
  eviction.ttl.set('short',     'expires soon',   2);  log.push('SET short      TTL=2s');
  eviction.ttl.set('medium',    'expires medium', 10); log.push('SET medium     TTL=10s');
  eviction.ttl.set('long',      'expires later',  60); log.push('SET long       TTL=60s');

  res.json({
    policy:       'TTL — Time To Live',
    description:  'Item kedaluwarsa otomatis setelah waktu TTL habis',
    operationLog: log,
    items:        eviction.ttl.list(),
    stats:        eviction.ttl.getStats(),
    hint:         'Access GET /ttl/get/short after 2 seconds to see it return null (expired)',
  });
});

/**
 * POST /api/eviction/ttl/set
 * body: { key, value, ttl? }
 */
router.post('/ttl/set', (req, res) => {
  const { key, value, ttl } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  eviction.ttl.set(key, value, ttl !== undefined ? Number(ttl) : undefined);
  res.json({ action: 'SET', key, value, ttl: ttl ?? eviction.ttl.defaultTtl, items: eviction.ttl.list(), stats: eviction.ttl.getStats() });
});

router.get('/ttl/get/:key', (req, res) => {
  const val = eviction.ttl.get(req.params.key);
  const remaining = eviction.ttl.ttl(req.params.key);
  res.json({ action: 'GET', key: req.params.key, result: val, found: val !== null, remainingSec: remaining, stats: eviction.ttl.getStats() });
});

router.get('/ttl/list', (req, res) => res.json({ items: eviction.ttl.list(), stats: eviction.ttl.getStats() }));
router.delete('/ttl/clear', (req, res) => { eviction.ttl.reset(); res.json({ message: 'TTL cache cleared' }); });

// ─────────────────────────────────────────────────
// Clear all
// ─────────────────────────────────────────────────
router.delete('/all/clear', (req, res) => {
  eviction.lru.reset();
  eviction.lfu.reset();
  eviction.fifo.reset();
  eviction.ttl.reset();
  res.json({ message: 'All eviction caches cleared' });
});

module.exports = router;
