// ================================================
// CDN SIMULATION
// Mensimulasikan Content Delivery Network:
//   - Edge servers di berbagai lokasi
//   - Origin server (sumber konten)
//   - Cache-Control header simulation
//   - ETag / If-None-Match
//   - Invalidation: per URL, per tag, purge-all
//   - Cache hit/miss per edge
// ================================================

// Simulated edge locations
const EDGE_LOCATIONS = [
  { id: 'JKT', name: 'Jakarta',   region: 'Asia Pacific',  latencyMs: 5  },
  { id: 'SIN', name: 'Singapore', region: 'Asia Pacific',  latencyMs: 15 },
  { id: 'TYO', name: 'Tokyo',     region: 'Asia Pacific',  latencyMs: 20 },
  { id: 'SYD', name: 'Sydney',    region: 'Asia Pacific',  latencyMs: 35 },
  { id: 'FRA', name: 'Frankfurt', region: 'Europe',         latencyMs: 120 },
  { id: 'IAD', name: 'Virginia',  region: 'North America', latencyMs: 180 },
];

// Content TTL rules per content type (seconds)
const TTL_RULES = {
  'image':   86400,  // 1 day
  'css':     3600,   // 1 hour
  'js':      3600,   // 1 hour
  'html':    300,    // 5 minutes
  'api':     60,     // 1 minute
  'font':    604800, // 7 days
  'default': 300,
};

function buildETag(content) {
  // Simple ETag: hash of content length + timestamp bucket
  const str = JSON.stringify(content);
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return `"${Math.abs(h).toString(16)}"`;
}

function guessContentType(path) {
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(path)) return 'image';
  if (/\.css$/i.test(path))  return 'css';
  if (/\.js$/i.test(path))   return 'js';
  if (/\.html?$/i.test(path)) return 'html';
  if (/\.woff2?$/i.test(path)) return 'font';
  if (/^\/api\//i.test(path)) return 'api';
  return 'default';
}

class CDNSimulation {
  constructor() {
    // edgeCache: Map<edgeId, Map<url, { body, etag, contentType, ttl, expiresAt, tags, hits }>>
    this.edgeCache  = new Map(EDGE_LOCATIONS.map(e => [e.id, new Map()]));

    // origin "database" of resources
    this.origin = new Map([
      ['/images/logo.png',       { body: { type: 'image', src: 'logo.png',       size: '12KB' }, contentType: 'image' }],
      ['/images/banner.jpg',     { body: { type: 'image', src: 'banner.jpg',     size: '245KB'}, contentType: 'image' }],
      ['/css/styles.css',        { body: { type: 'css',   rules: 142,            minified: true }, contentType: 'css' }],
      ['/js/app.js',             { body: { type: 'js',    modules: 38,           bundled: true  }, contentType: 'js'  }],
      ['/api/products',          { body: { type: 'api',   data: [{ id: 1, name: 'Laptop' }] },    contentType: 'api' }],
      ['/api/promotions',        { body: { type: 'api',   data: [{ id: 1, promo: 'SALE10' }] },   contentType: 'api' }],
      ['/fonts/roboto.woff2',    { body: { type: 'font',  family: 'Roboto', weight: 400 },         contentType: 'font'}],
    ]);

    this.stats = {
      totalRequests:    0,
      edgeHits:         0,
      originRequests:   0,
      invalidations:    0,
      purges:           0,
      byEdge: Object.fromEntries(EDGE_LOCATIONS.map(e => [e.id, { hits: 0, misses: 0, requests: 0 }])),
    };
  }

  // ── Request flow ──────────────────────────────
  /**
   * Simulate a user request routed to the nearest edge.
   * @param {string} url   - resource URL
   * @param {string} edgeId - edge location id (default: JKT)
   * @param {string} ifNoneMatch - ETag from client
   */
  async request(url, edgeId = 'JKT', ifNoneMatch = null) {
    const edge = EDGE_LOCATIONS.find(e => e.id === edgeId);
    if (!edge) throw new Error(`Unknown edge: ${edgeId}`);

    this.stats.totalRequests++;
    this.stats.byEdge[edgeId].requests++;

    const edgeStore = this.edgeCache.get(edgeId);
    const cached    = edgeStore.get(url);
    const now       = Date.now();

    // ── Cache HIT ──
    if (cached && cached.expiresAt > now) {
      this.stats.edgeHits++;
      this.stats.byEdge[edgeId].hits++;
      cached.hits++;

      // 304 Not Modified
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        return {
          status:      304,
          source:      'CDN_EDGE',
          edge:        edge.name,
          url,
          etag:        cached.etag,
          latency:     `${edge.latencyMs}ms`,
          cacheStatus: 'HIT',
          remainingTtl: `${Math.ceil((cached.expiresAt - now) / 1000)}s`,
        };
      }

      return {
        status:      200,
        source:      'CDN_EDGE',
        edge:        edge.name,
        url,
        body:        cached.body,
        contentType: cached.contentType,
        etag:        cached.etag,
        latency:     `${edge.latencyMs}ms`,
        cacheStatus: 'HIT',
        cacheHits:   cached.hits,
        remainingTtl: `${Math.ceil((cached.expiresAt - now) / 1000)}s`,
        headers: {
          'Cache-Control': `public, max-age=${TTL_RULES[cached.contentType] || TTL_RULES.default}`,
          'ETag':          cached.etag,
          'X-Cache':       'HIT',
          'X-Edge':        edge.name,
        },
      };
    }

    // ── Cache MISS → fetch from origin ──
    this.stats.originRequests++;
    this.stats.byEdge[edgeId].misses++;

    // Simulate origin latency (150–300 ms)
    const originLatency = Math.floor(Math.random() * 150) + 150;
    await new Promise(r => setTimeout(r, originLatency));

    const resource    = this.origin.get(url);
    const body        = resource ? resource.body : { error: 'Not Found', url };
    const contentType = resource ? resource.contentType : 'default';
    const ttl         = TTL_RULES[contentType] || TTL_RULES.default;
    const etag        = buildETag(body);

    if (resource) {
      // Store in edge cache
      edgeStore.set(url, {
        body, contentType, etag,
        ttl,
        expiresAt: now + ttl * 1000,
        tags:      [contentType, url],
        hits:      0,
        cachedAt:  new Date().toISOString(),
      });
    }

    return {
      status:      resource ? 200 : 404,
      source:      'ORIGIN',
      edge:        edge.name,
      url,
      body,
      contentType,
      etag,
      latency:     `${edge.latencyMs + originLatency}ms (edge: ${edge.latencyMs}ms + origin: ${originLatency}ms)`,
      cacheStatus: 'MISS',
      headers: {
        'Cache-Control': `public, max-age=${ttl}`,
        'ETag':          etag,
        'X-Cache':       'MISS',
        'X-Edge':        edge.name,
      },
    };
  }

  // ── Upload resource to origin ─────────────────
  upload(url, body, contentType = 'default') {
    this.origin.set(url, { body, contentType });
    return { message: 'Resource uploaded to origin', url, contentType };
  }

  // ── Invalidation ──────────────────────────────
  invalidateUrl(url) {
    let count = 0;
    for (const store of this.edgeCache.values()) {
      if (store.delete(url)) count++;
    }
    this.stats.invalidations++;
    return { invalidated: url, edgesCleared: count };
  }

  invalidateByTag(tag) {
    let count = 0;
    for (const store of this.edgeCache.values()) {
      for (const [url, item] of store) {
        if (item.tags && item.tags.includes(tag)) { store.delete(url); count++; }
      }
    }
    this.stats.invalidations++;
    return { tag, urlsInvalidated: count };
  }

  invalidateUrls(urls) {
    return urls.map(u => this.invalidateUrl(u));
  }

  purgeAll() {
    for (const store of this.edgeCache.values()) store.clear();
    this.stats.purges++;
    return { message: 'All CDN edge caches purged', edgesCleared: EDGE_LOCATIONS.length };
  }

  // ── Stats ─────────────────────────────────────
  getStats() {
    const total  = this.stats.totalRequests;
    const byEdge = EDGE_LOCATIONS.map(e => {
      const s = this.stats.byEdge[e.id];
      const t = s.hits + s.misses;
      return {
        edge:     e.name,
        id:       e.id,
        region:   e.region,
        latency:  `${e.latencyMs}ms`,
        cachedUrls: this.edgeCache.get(e.id).size,
        requests: s.requests,
        hits:     s.hits,
        misses:   s.misses,
        hitRate:  t > 0 ? `${((s.hits / t) * 100).toFixed(2)}%` : '0%',
      };
    });
    return {
      totalRequests:   total,
      edgeHits:        this.stats.edgeHits,
      originRequests:  this.stats.originRequests,
      overallHitRate:  total > 0 ? `${((this.stats.edgeHits / total) * 100).toFixed(2)}%` : '0%',
      invalidations:   this.stats.invalidations,
      purges:          this.stats.purges,
      byEdge,
    };
  }

  getEdges() {
    return EDGE_LOCATIONS.map(e => ({
      ...e,
      status:    'ONLINE',
      cachedUrls: this.edgeCache.get(e.id).size,
    }));
  }

  resetStats() {
    this.stats = {
      totalRequests: 0, edgeHits: 0, originRequests: 0, invalidations: 0, purges: 0,
      byEdge: Object.fromEntries(EDGE_LOCATIONS.map(e => [e.id, { hits: 0, misses: 0, requests: 0 }])),
    };
  }
}

module.exports = new CDNSimulation();
