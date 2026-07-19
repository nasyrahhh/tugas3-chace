const router      = require('express').Router();
const CacheAside  = require('../strategies/CacheAside');
const WriteThrough = require('../strategies/WriteThrough');
const WriteBehind  = require('../strategies/WriteBehind');
const ReadThrough  = require('../strategies/ReadThrough');

router.get('/', (req, res) => res.json({
  strategies: {
    'cache-aside':   'GET/POST/PUT/DELETE /api/strategies/cache-aside/buku[/:id]',
    'write-through': 'GET/POST/PUT        /api/strategies/write-through/buku[/:id]',
    'write-behind':  'GET/POST/PUT        /api/strategies/write-behind/buku[/:id]',
    'read-through':  'GET                 /api/strategies/read-through/buku[/:id]',
  },
}));

router.get('/cache-aside/buku',         async (req, res, next) => { try { res.json(await CacheAside.getAllBuku()); } catch(e){ next(e); } });
router.get('/cache-aside/buku/:id',     async (req, res, next) => { try { res.json(await CacheAside.getBuku(req.params.id)); } catch(e){ next(e); } });
router.post('/cache-aside/buku',        async (req, res, next) => { try { res.status(201).json(await CacheAside.createBuku(req.body)); } catch(e){ next(e); } });
router.put('/cache-aside/buku/:id',     async (req, res, next) => { try { res.json(await CacheAside.updateBuku(req.params.id, req.body)); } catch(e){ next(e); } });
router.delete('/cache-aside/buku/:id',  async (req, res, next) => { try { res.json(await CacheAside.deleteBuku(req.params.id)); } catch(e){ next(e); } });

router.get('/write-through/buku',       async (req, res, next) => { try { res.json(await WriteThrough.getAllBuku()); } catch(e){ next(e); } });
router.get('/write-through/buku/:id',   async (req, res, next) => { try { res.json(await WriteThrough.getBuku(req.params.id)); } catch(e){ next(e); } });
router.post('/write-through/buku',      async (req, res, next) => { try { res.status(201).json(await WriteThrough.createBuku(req.body)); } catch(e){ next(e); } });
router.put('/write-through/buku/:id',   async (req, res, next) => { try { res.json(await WriteThrough.updateBuku(req.params.id, req.body)); } catch(e){ next(e); } });

router.get('/write-behind/buku/:id',    async (req, res, next) => { try { res.json(await WriteBehind.getBuku(req.params.id)); } catch(e){ next(e); } });
router.post('/write-behind/buku',       async (req, res, next) => { try { res.status(201).json(await WriteBehind.createBuku(req.body)); } catch(e){ next(e); } });
router.put('/write-behind/buku/:id',    async (req, res, next) => { try { res.json(await WriteBehind.updateBuku(req.params.id, req.body)); } catch(e){ next(e); } });
router.get('/write-behind/antrian',     async (req, res, next) => { try { res.json(WriteBehind.getQueueStatus()); } catch(e){ next(e); } });
router.post('/write-behind/flush',      async (req, res, next) => { try { res.json(await WriteBehind.forceFlush()); } catch(e){ next(e); } });

router.get('/read-through/buku',        async (req, res, next) => { try { res.json(await ReadThrough.getAllBuku()); } catch(e){ next(e); } });
router.get('/read-through/buku/:id',    async (req, res, next) => { try { res.json(await ReadThrough.getBuku(req.params.id)); } catch(e){ next(e); } });
router.get('/read-through/pengarang/:id', async (req, res, next) => { try { res.json(await ReadThrough.getPengarang(req.params.id)); } catch(e){ next(e); } });
router.delete('/read-through/invalidate', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key wajib diisi' });
  res.json(ReadThrough.invalidate(key));
});
router.get('/read-through/stats', (req, res) => res.json(ReadThrough.getStats()));

module.exports = router;
