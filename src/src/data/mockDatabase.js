const { v4: uuidv4 } = require('uuid');

// ================================================
// MOCK DATABASE — mensimulasikan SQL/NoSQL database
// Setiap query memiliki delay 50-200ms untuk
// meniru latency database sungguhan
// ================================================

const initialProducts = [
  { id: '1', name: 'Laptop Pro X1',          price: 15000000, category: 'Electronics', stock: 50,  brand: 'TechBrand'   },
  { id: '2', name: 'Wireless Mouse M200',     price: 250000,   category: 'Electronics', stock: 200, brand: 'PeripheralCo'},
  { id: '3', name: 'Mechanical Keyboard K500',price: 800000,   category: 'Electronics', stock: 75,  brand: 'KeyMaster'   },
  { id: '4', name: 'Monitor 4K UHD 27"',      price: 5000000,  category: 'Electronics', stock: 30,  brand: 'ViewTech'    },
  { id: '5', name: 'USB-C Hub 7-in-1',        price: 350000,   category: 'Accessories', stock: 100, brand: 'ConnectAll'  },
  { id: '6', name: 'Gaming Headset Pro',       price: 1200000,  category: 'Electronics', stock: 45,  brand: 'SoundMax'    },
  { id: '7', name: 'Webcam HD 1080p',          price: 650000,   category: 'Electronics', stock: 80,  brand: 'VisionCam'   },
  { id: '8', name: 'Portable SSD 1TB',         price: 1500000,  category: 'Storage',     stock: 60,  brand: 'FastDrive'   },
];

const initialUsers = [
  { id: '1', name: 'Budi Santoso', email: 'budi@example.com',  role: 'admin',     city: 'Jakarta'    },
  { id: '2', name: 'Siti Rahayu',  email: 'siti@example.com',  role: 'user',      city: 'Bandung'    },
  { id: '3', name: 'Ahmad Fauzi',  email: 'ahmad@example.com', role: 'user',      city: 'Surabaya'   },
  { id: '4', name: 'Dewi Putri',   email: 'dewi@example.com',  role: 'moderator', city: 'Yogyakarta' },
  { id: '5', name: 'Rizky Pratama',email: 'rizky@example.com', role: 'user',      city: 'Medan'      },
];

class MockDatabase {
  constructor() {
    this.products  = new Map(initialProducts.map(p => [p.id, { ...p }]));
    this.users     = new Map(initialUsers.map(u => [u.id, { ...u }]));
    this.queryCount      = 0;
    this.totalQueryTime  = 0;
    this.queryLog        = [];
  }

  // Simulate 50–200 ms database round-trip
  _delay() {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 150) + 50));
  }

  async _run(sql) {
    const t0 = Date.now();
    await this._delay();
    const ms = Date.now() - t0;
    this.queryCount++;
    this.totalQueryTime += ms;
    this.queryLog.push({ id: this.queryCount, sql, ms: `${ms}ms`, at: new Date().toISOString() });
    if (this.queryLog.length > 30) this.queryLog.shift();
    return ms;
  }

  // ── Products ──────────────────────────────────
  async getProduct(id) {
    const ms = await this._run(`SELECT * FROM products WHERE id = '${id}'`);
    const row = this.products.get(String(id));
    return row ? { ...row, _dbQueryTime: `${ms}ms` } : null;
  }

  async getAllProducts() {
    const ms = await this._run('SELECT * FROM products');
    return [...this.products.values()].map(p => ({ ...p, _dbQueryTime: `${ms}ms` }));
  }

  async createProduct(data) {
    const ms = await this._run('INSERT INTO products (...) VALUES (...)');
    const id = uuidv4().slice(0, 8);
    const product = { id, ...data, createdAt: new Date().toISOString() };
    this.products.set(id, product);
    return { ...product, _dbQueryTime: `${ms}ms` };
  }

  async updateProduct(id, data) {
    const ms = await this._run(`UPDATE products SET ... WHERE id = '${id}'`);
    const existing = this.products.get(String(id));
    if (!existing) return null;
    const updated = { ...existing, ...data, id: existing.id, updatedAt: new Date().toISOString() };
    this.products.set(String(id), updated);
    return { ...updated, _dbQueryTime: `${ms}ms` };
  }

  async deleteProduct(id) {
    await this._run(`DELETE FROM products WHERE id = '${id}'`);
    return this.products.delete(String(id));
  }

  // ── Users ─────────────────────────────────────
  async getUser(id) {
    const ms = await this._run(`SELECT * FROM users WHERE id = '${id}'`);
    const row = this.users.get(String(id));
    return row ? { ...row, _dbQueryTime: `${ms}ms` } : null;
  }

  // ── Stats ─────────────────────────────────────
  getStats() {
    return {
      totalQueries:   this.queryCount,
      avgQueryTime:   this.queryCount ? `${Math.round(this.totalQueryTime / this.queryCount)}ms` : '0ms',
      totalQueryTime: `${this.totalQueryTime}ms`,
      productCount:   this.products.size,
      userCount:      this.users.size,
      recentQueries:  this.queryLog.slice(-5),
    };
  }

  reset() {
    this.queryCount     = 0;
    this.totalQueryTime = 0;
    this.queryLog       = [];
    this.products = new Map(initialProducts.map(p => [p.id, { ...p }]));
  }
}

module.exports = new MockDatabase();
