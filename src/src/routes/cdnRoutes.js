// ================================================
// CDN ROUTES  /api/cdn
// ================================================
const router = require('express').Router();
const cdn    = require('../simulations/CDNSimulation');

router.get('/', (req, res) => res.json({ message: 'CDN Simulation API', stats: cdn.getStats() }));

/**
 * GET /api/cdn/resource?url=/path&edge=JKT&ifNoneMatch="etag"
 * Simulate a user request routed through a CDN edge
 */
router.get('/resource', async (req, res, next) => {
  try {
    const { url, edge = 'JKT', ifNoneMatch } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param required. e.g. ?url=/images/logo.png&edge=JKT' });
    const result = await cdn.request(url, edge.toUpperCase(), ifNoneMatch || null);
    res.status(result.status).json(result);
  } catch(e) { next(e); }
});

/**
 * POST /api/cdn/upload
 * body: { url, body, contentType? }
 * Simulate uploading a resource to origin server
 */
router.post('/upload', (req, res) => {
  const { url, body, contentType = 'default' } = req.body;
  if (!url || body === undefined) return res.status(400).json({ error: 'url and body required' });
  res.status(201).json(cdn.upload(url, body, contentType));
});

/**
 * POST /api/cdn/invalidate
 * body: { url } | { tag } | { urls: [...] }
 * Invalidate specific URLs or content tags from all edges
 */
router.post('/invalidate', (req, res) => {
  const { url, tag, urls } = req.body;
  if (urls && Array.isArray(urls)) return res.json({ results: cdn.invalidateUrls(urls) });
  if (url)  return res.json(cdn.invalidateUrl(url));
  if (tag)  return res.json(cdn.invalidateByTag(tag));
  res.status(400).json({ error: 'Provide url, tag, or urls[] in body' });
});

/**
 * POST /api/cdn/purge
 * Purge ALL cached content from all edge servers
 */
router.post('/purge', (req, res) => {
  res.json(cdn.purgeAll());
});

/**
 * GET /api/cdn/stats
 */
router.get('/stats', (req, res) => res.json(cdn.getStats()));

/**
 * GET /api/cdn/edges
 * Show status of all edge servers
 */
router.get('/edges', (req, res) => res.json({ edges: cdn.getEdges() }));

module.exports = router;
