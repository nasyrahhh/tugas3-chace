// ================================================
// REDIS ROUTES  /api/redis
// ================================================
const router = require('express').Router();
const redis  = require('../simulations/RedisSimulation');

// ── INFO ─────────────────────────────────────────
router.get('/', (req, res) => res.json({ message: 'Redis Simulation API', info: redis.info() }));
router.get('/info', (req, res) => res.json(redis.info()));
router.get('/dbsize', (req, res) => res.json({ dbsize: redis.dbsize() }));

// ── STRING COMMANDS ───────────────────────────────
/**
 * POST /api/redis/set
 * body: { key, value, ex? }
 */
router.post('/set', (req, res) => {
  const { key, value, ex } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value are required' });
  const result = redis.set(key, value, ex ? { EX: Number(ex) } : {});
  res.json({ command: `SET ${key} "${value}"${ex ? ` EX ${ex}` : ''}`, result, ttl: ex ? `${ex}s` : 'no expiry' });
});

/**
 * GET /api/redis/get/:key
 */
router.get('/get/:key', (req, res) => {
  const val = redis.get(req.params.key);
  res.json({ command: `GET ${req.params.key}`, result: val, found: val !== null });
});

/**
 * DELETE /api/redis/del/:key
 */
router.delete('/del/:key', (req, res) => {
  const n = redis.del(req.params.key);
  res.json({ command: `DEL ${req.params.key}`, result: n, deleted: n > 0 });
});

/**
 * POST /api/redis/expire
 * body: { key, seconds }
 */
router.post('/expire', (req, res) => {
  const { key, seconds } = req.body;
  if (!key || !seconds) return res.status(400).json({ error: 'key and seconds are required' });
  const result = redis.expire(key, Number(seconds));
  res.json({ command: `EXPIRE ${key} ${seconds}`, result, success: result === 1 });
});

/**
 * GET /api/redis/ttl/:key
 */
router.get('/ttl/:key', (req, res) => {
  const t = redis.ttl(req.params.key);
  res.json({ command: `TTL ${req.params.key}`, result: t, meaning: t === -2 ? 'key does not exist' : t === -1 ? 'no expiry set' : `${t} seconds remaining` });
});

/**
 * GET /api/redis/persist/:key
 */
router.post('/persist', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  res.json({ command: `PERSIST ${key}`, result: redis.persist(key) });
});

/**
 * GET /api/redis/keys?pattern=*
 */
router.get('/keys', (req, res) => {
  const pattern = req.query.pattern || '*';
  const keys = redis.keys(pattern);
  res.json({ command: `KEYS ${pattern}`, result: keys, count: keys.length });
});

/**
 * POST /api/redis/mset
 * body: { pairs: { key1: val1, ... } }
 */
router.post('/mset', (req, res) => {
  const { pairs } = req.body;
  if (!pairs) return res.status(400).json({ error: 'pairs object required' });
  res.json({ command: 'MSET', result: redis.mset(pairs), keys: Object.keys(pairs) });
});

/**
 * POST /api/redis/mget
 * body: { keys: [...] }
 */
router.post('/mget', (req, res) => {
  const { keys } = req.body;
  if (!Array.isArray(keys)) return res.status(400).json({ error: 'keys array required' });
  const values = redis.mget(keys);
  res.json({ command: `MGET ${keys.join(' ')}`, result: Object.fromEntries(keys.map((k, i) => [k, values[i]])) });
});

/**
 * POST /api/redis/incr   body: { key }
 * POST /api/redis/decr   body: { key }
 * POST /api/redis/incrby body: { key, amount }
 */
router.post('/incr',   (req, res) => { const { key } = req.body; if (!key) return res.status(400).json({ error: 'key required' }); try { res.json({ command: `INCR ${key}`, result: redis.incr(key) }); } catch(e){ res.status(400).json({ error: e.message }); } });
router.post('/decr',   (req, res) => { const { key } = req.body; if (!key) return res.status(400).json({ error: 'key required' }); try { res.json({ command: `DECR ${key}`, result: redis.decr(key) }); } catch(e){ res.status(400).json({ error: e.message }); } });
router.post('/incrby', (req, res) => { const { key, amount } = req.body; if (!key || !amount) return res.status(400).json({ error: 'key and amount required' }); try { res.json({ command: `INCRBY ${key} ${amount}`, result: redis.incrby(key, amount) }); } catch(e){ res.status(400).json({ error: e.message }); } });

/**
 * POST /api/redis/append  body: { key, value }
 */
router.post('/append', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  res.json({ command: `APPEND ${key} "${value}"`, result: redis.append(key, value) });
});

// ── HASH COMMANDS ─────────────────────────────────
/**
 * POST /api/redis/hset   body: { key, fields: { field1: val1, ... } }
 */
router.post('/hset', (req, res) => {
  const { key, fields } = req.body;
  if (!key || !fields) return res.status(400).json({ error: 'key and fields required' });
  const pairs = Object.entries(fields).flat();
  res.json({ command: `HSET ${key} ...`, result: redis.hset(key, ...pairs) });
});

/**
 * GET /api/redis/hget/:key/:field
 */
router.get('/hget/:key/:field', (req, res) => {
  const val = redis.hget(req.params.key, req.params.field);
  res.json({ command: `HGET ${req.params.key} ${req.params.field}`, result: val });
});

/**
 * GET /api/redis/hgetall/:key
 */
router.get('/hgetall/:key', (req, res) => {
  const val = redis.hgetall(req.params.key);
  res.json({ command: `HGETALL ${req.params.key}`, result: val });
});

router.get('/hkeys/:key',  (req, res) => res.json({ command: `HKEYS ${req.params.key}`,  result: redis.hkeys(req.params.key) }));
router.get('/hvals/:key',  (req, res) => res.json({ command: `HVALS ${req.params.key}`,  result: redis.hvals(req.params.key) }));
router.get('/hlen/:key',   (req, res) => res.json({ command: `HLEN ${req.params.key}`,   result: redis.hlen(req.params.key) }));

// ── LIST COMMANDS ─────────────────────────────────
/**
 * POST /api/redis/lpush  body: { key, values: [...] }
 */
router.post('/lpush', (req, res) => {
  const { key, values } = req.body;
  if (!key || !Array.isArray(values)) return res.status(400).json({ error: 'key and values[] required' });
  res.json({ command: `LPUSH ${key} ...`, result: redis.lpush(key, ...values) });
});

router.post('/rpush', (req, res) => {
  const { key, values } = req.body;
  if (!key || !Array.isArray(values)) return res.status(400).json({ error: 'key and values[] required' });
  res.json({ command: `RPUSH ${key} ...`, result: redis.rpush(key, ...values) });
});

/**
 * GET /api/redis/lrange/:key?start=0&stop=-1
 */
router.get('/lrange/:key', (req, res) => {
  const start = parseInt(req.query.start ?? '0');
  const stop  = parseInt(req.query.stop  ?? '-1');
  res.json({ command: `LRANGE ${req.params.key} ${start} ${stop}`, result: redis.lrange(req.params.key, start, stop) });
});

router.post('/lpop', (req, res) => { const { key } = req.body; res.json({ command: `LPOP ${key}`, result: redis.lpop(key) }); });
router.post('/rpop', (req, res) => { const { key } = req.body; res.json({ command: `RPOP ${key}`, result: redis.rpop(key) }); });
router.get('/llen/:key', (req, res) => res.json({ command: `LLEN ${req.params.key}`, result: redis.llen(req.params.key) }));

// ── SET COMMANDS ──────────────────────────────────
/**
 * POST /api/redis/sadd  body: { key, members: [...] }
 */
router.post('/sadd', (req, res) => {
  const { key, members } = req.body;
  if (!key || !Array.isArray(members)) return res.status(400).json({ error: 'key and members[] required' });
  res.json({ command: `SADD ${key} ...`, result: redis.sadd(key, ...members) });
});

router.get('/smembers/:key', (req, res) => res.json({ command: `SMEMBERS ${req.params.key}`, result: redis.smembers(req.params.key) }));
router.get('/scard/:key',    (req, res) => res.json({ command: `SCARD ${req.params.key}`,    result: redis.scard(req.params.key) }));

// ── SORTED SET ────────────────────────────────────
/**
 * POST /api/redis/zadd  body: { key, members: [{score, member}, ...] }
 */
router.post('/zadd', (req, res) => {
  const { key, members } = req.body;
  if (!key || !Array.isArray(members)) return res.status(400).json({ error: 'key and members[] required' });
  const pairs = members.flatMap(m => [m.score, m.member]);
  res.json({ command: `ZADD ${key} ...`, result: redis.zadd(key, ...pairs) });
});

router.get('/zrange/:key', (req, res) => {
  const start = parseInt(req.query.start ?? '0');
  const stop  = parseInt(req.query.stop ?? '-1');
  res.json({ command: `ZRANGE ${req.params.key} ${start} ${stop}`, result: redis.zrange(req.params.key, start, stop) });
});

// ── ADMIN ─────────────────────────────────────────
router.post('/flush', (req, res) => res.json({ command: 'FLUSHDB', result: redis.flushdb() }));
router.post('/rename', (req, res) => {
  const { key, newKey } = req.body;
  if (!key || !newKey) return res.status(400).json({ error: 'key and newKey required' });
  try { res.json({ command: `RENAME ${key} ${newKey}`, result: redis.rename(key, newKey) }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
