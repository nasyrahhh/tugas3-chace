// ================================================
// MEMCACHED ROUTES  /api/memcached
// ================================================
const router    = require('express').Router();
const memcached = require('../simulations/MemcachedSimulation');

router.get('/', (req, res) => res.json({ message: 'Memcached Simulation API', stats: memcached.stats_cmd() }));

/**
 * POST /api/memcached/set
 * body: { key, value, ttl?, flags? }
 */
router.post('/set', (req, res) => {
  const { key, value, ttl = 0, flags = 0 } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  try {
    const result = memcached.set(key, value, Number(ttl), Number(flags));
    res.json({ command: `set ${key} ${flags} ${ttl} ${String(value).length}`, result, ttl: ttl > 0 ? `${ttl}s` : 'no expiry' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

/**
 * GET /api/memcached/get/:key
 */
router.get('/get/:key', (req, res) => {
  const item = memcached.get(req.params.key);
  if (!item) return res.json({ command: `get ${req.params.key}`, result: 'NOT_FOUND', found: false });
  res.json({ command: `get ${req.params.key}`, result: item, found: true });
});

/**
 * GET /api/memcached/gets/:key  (with CAS token)
 */
router.get('/gets/:key', (req, res) => {
  const item = memcached.gets(req.params.key);
  if (!item) return res.json({ command: `gets ${req.params.key}`, result: 'NOT_FOUND', found: false });
  res.json({ command: `gets ${req.params.key}`, result: item, found: true, note: 'Use casToken in /cas to update safely' });
});

/**
 * DELETE /api/memcached/delete/:key
 */
router.delete('/delete/:key', (req, res) => {
  const result = memcached.delete(req.params.key);
  res.json({ command: `delete ${req.params.key}`, result });
});

/**
 * POST /api/memcached/add  (only if not exists)
 * body: { key, value, ttl?, flags? }
 */
router.post('/add', (req, res) => {
  const { key, value, ttl = 0, flags = 0 } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  try {
    const result = memcached.add(key, value, Number(ttl), Number(flags));
    res.json({ command: `add ${key}`, result, stored: result === 'STORED', note: 'add only stores if key does not exist' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

/**
 * POST /api/memcached/replace  (only if exists)
 */
router.post('/replace', (req, res) => {
  const { key, value, ttl = 0, flags = 0 } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  try {
    const result = memcached.replace(key, value, Number(ttl), Number(flags));
    res.json({ command: `replace ${key}`, result, stored: result === 'STORED', note: 'replace only stores if key exists' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

/**
 * POST /api/memcached/cas  (Check-And-Set)
 * body: { key, value, ttl, casToken }
 */
router.post('/cas', (req, res) => {
  const { key, value, ttl = 0, casToken, flags = 0 } = req.body;
  if (!key || value === undefined || !casToken) return res.status(400).json({ error: 'key, value, and casToken required. Get casToken via /gets/:key' });
  try {
    const result = memcached.cas(key, value, Number(ttl), casToken, Number(flags));
    const meanings = { STORED: 'CAS success — value updated', EXISTS: 'CAS failed — value changed since last gets', NOT_FOUND: 'Key does not exist' };
    res.json({ command: `cas ${key}`, result, meaning: meanings[result] || result });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

/**
 * POST /api/memcached/append  body: { key, value }
 */
router.post('/append', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  res.json({ command: `append ${key}`, result: memcached.append(key, value) });
});

/**
 * POST /api/memcached/prepend  body: { key, value }
 */
router.post('/prepend', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  res.json({ command: `prepend ${key}`, result: memcached.prepend(key, value) });
});

/**
 * POST /api/memcached/incr  body: { key, amount? }
 */
router.post('/incr', (req, res) => {
  const { key, amount = 1 } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  const result = memcached.incr(key, Number(amount));
  res.json({ command: `incr ${key} ${amount}`, result });
});

/**
 * POST /api/memcached/decr  body: { key, amount? }
 */
router.post('/decr', (req, res) => {
  const { key, amount = 1 } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  const result = memcached.decr(key, Number(amount));
  res.json({ command: `decr ${key} ${amount}`, result });
});

/**
 * GET  /api/memcached/stats
 * POST /api/memcached/flush
 */
router.get('/stats', (req, res) => res.json({ command: 'stats', result: memcached.stats_cmd() }));
router.post('/flush', (req, res) => res.json({ command: 'flush_all', result: memcached.flush_all() }));

module.exports = router;
