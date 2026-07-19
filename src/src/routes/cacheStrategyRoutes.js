// ================================================
// CACHE STRATEGY ROUTES  /api/strategies
// ================================================
const router      = require('express').Router();
const CacheAside  = require('../strategies/CacheAside');
const WriteThrough = require('../strategies/WriteThrough');
const WriteBehind = require('../strategies/WriteBehind');
const ReadThrough = require('../strategies/ReadThrough');

// ── INFO ─────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    strategies: {
      'cache-aside':   'GET/POST/PUT/DELETE /api/strategies/cache-aside/products[/:id]',
      'write-through': 'GET/POST/PUT        /api/strategies/write-through/products[/:id]',
      'write-behind':  'GET/POST/PUT        /api/strategies/write-behind/products[/:id]',
      'read-through':  'GET                 /api/strategies/read-through/products[/:id]',
    },
  });
});

// ── CACHE-ASIDE ──────────────────────────────────
router.get('/cache-aside/products',      async (req, res, next) => { try { res.json(await CacheAside.getAllProducts()); } catch(e){ next(e); } });
router.get('/cache-aside/products/:id',  async (req, res, next) => { try { res.json(await CacheAside.getProduct(req.params.id)); } catch(e){ next(e); } });
router.post('/cache-aside/products',     async (req, res, next) => { try { res.status(201).json(await CacheAside.createProduct(req.body)); } catch(e){ next(e); } });
router.put('/cache-aside/products/:id',  async (req, res, next) => { try { res.json(await CacheAside.updateProduct(req.params.id, req.body)); } catch(e){ next(e); } });
router.delete('/cache-aside/products/:id', async (req, res, next) => { try { res.json(await CacheAside.deleteProduct(req.params.id)); } catch(e){ next(e); } });

// ── WRITE-THROUGH ────────────────────────────────
router.get('/write-through/products',     async (req, res, next) => { try { res.json(await WriteThrough.getAllProducts()); } catch(e){ next(e); } });
router.get('/write-through/products/:id', async (req, res, next) => { try { res.json(await WriteThrough.getProduct(req.params.id)); } catch(e){ next(e); } });
router.post('/write-through/products',    async (req, res, next) => { try { res.status(201).json(await WriteThrough.createProduct(req.body)); } catch(e){ next(e); } });
router.put('/write-through/products/:id', async (req, res, next) => { try { res.json(await WriteThrough.updateProduct(req.params.id, req.body)); } catch(e){ next(e); } });

// ── WRITE-BEHIND ─────────────────────────────────
router.get('/write-behind/products/:id',   async (req, res, next) => { try { res.json(await WriteBehind.getProduct(req.params.id)); } catch(e){ next(e); } });
router.post('/write-behind/products',      async (req, res, next) => { try { res.status(201).json(await WriteBehind.createProduct(req.body)); } catch(e){ next(e); } });
router.put('/write-behind/products/:id',   async (req, res, next) => { try { res.json(await WriteBehind.updateProduct(req.params.id, req.body)); } catch(e){ next(e); } });
router.get('/write-behind/queue',          async (req, res, next) => { try { res.json(WriteBehind.getQueueStatus()); } catch(e){ next(e); } });
router.post('/write-behind/flush',         async (req, res, next) => { try { res.json(await WriteBehind.forceFlush()); } catch(e){ next(e); } });

// ── READ-THROUGH ─────────────────────────────────
router.get('/read-through/products',      async (req, res, next) => { try { res.json(await ReadThrough.getAllProducts()); } catch(e){ next(e); } });
router.get('/read-through/products/:id',  async (req, res, next) => { try { res.json(await ReadThrough.getProduct(req.params.id)); } catch(e){ next(e); } });
router.get('/read-through/users/:id',     async (req, res, next) => { try { res.json(await ReadThrough.getUser(req.params.id)); } catch(e){ next(e); } });
router.delete('/read-through/invalidate', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  res.json(ReadThrough.invalidate(key));
});
router.get('/read-through/stats', (req, res) => res.json(ReadThrough.getStats()));

module.exports = router;
