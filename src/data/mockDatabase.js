const { v4: uuidv4 } = require('uuid');

// ================================================
// MOCK DATABASE — mensimulasikan SQL/NoSQL database
// untuk sistem Perpustakaan Digital
// Setiap query memiliki delay 50-200ms untuk
// meniru latency database sungguhan
// ================================================

const initialBuku = [
  { id: '1', judul: 'Bumi Manusia',             genre: 'Fiksi Sejarah', pengarang: 'Pramoedya Ananta Toer', halaman: 535, rating: 4.9, penerbit: 'Hasta Mitra'      },
  { id: '2', judul: 'Laskar Pelangi',            genre: 'Fiksi',        pengarang: 'Andrea Hirata',         halaman: 529, rating: 4.8, penerbit: 'Bentang Pustaka'   },
  { id: '3', judul: 'Sapiens: Riwayat Singkat Umat Manusia', genre: 'Non-Fiksi', pengarang: 'Yuval Noah Harari', halaman: 443, rating: 4.7, penerbit: 'KPG' },
  { id: '4', judul: 'Atomic Habits',             genre: 'Pengembangan Diri', pengarang: 'James Clear',     halaman: 320, rating: 4.8, penerbit: 'Gramedia'         },
  { id: '5', judul: 'Negeri 5 Menara',           genre: 'Fiksi Islami', pengarang: 'Ahmad Fuadi',          halaman: 423, rating: 4.6, penerbit: 'Gramedia'         },
  { id: '6', judul: 'Clean Code',                genre: 'Teknologi',    pengarang: 'Robert C. Martin',     halaman: 431, rating: 4.7, penerbit: "O'Reilly"         },
  { id: '7', judul: 'Sejarah Dunia yang Disembunyikan', genre: 'Sejarah', pengarang: 'Jonathan Black',    halaman: 592, rating: 4.5, penerbit: 'Hikmah'            },
  { id: '8', judul: 'Python Crash Course',       genre: 'Teknologi',    pengarang: 'Eric Matthes',         halaman: 544, rating: 4.6, penerbit: 'No Starch Press'  },
];

const initialPengarang = [
  { id: '1', nama: 'Pramoedya Ananta Toer', email: 'pram@pustaka.id',    genre: 'Fiksi Sejarah',    kota: 'Jakarta',    totalBuku: 25 },
  { id: '2', nama: 'Andrea Hirata',         email: 'andrea@pustaka.id',  genre: 'Fiksi',            kota: 'Belitung',   totalBuku: 8  },
  { id: '3', nama: 'Ahmad Fuadi',           email: 'fuadi@pustaka.id',   genre: 'Fiksi Islami',     kota: 'Bandung',    totalBuku: 5  },
  { id: '4', nama: 'Robert C. Martin',      email: 'uncle@pustaka.id',   genre: 'Teknologi',        kota: 'Chicago',    totalBuku: 12 },
  { id: '5', nama: 'Yuval Noah Harari',     email: 'yuval@pustaka.id',   genre: 'Non-Fiksi',        kota: 'Jerusalem',  totalBuku: 7  },
];

class MockDatabase {
  constructor() {
    this.buku     = new Map(initialBuku.map(b => [b.id, { ...b }]));
    this.pengarang = new Map(initialPengarang.map(p => [p.id, { ...p }]));
    this.queryCount     = 0;
    this.totalQueryTime = 0;
    this.queryLog       = [];
  }

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

  // -- Buku -------------------------------------
  async getBuku(id) {
    const ms  = await this._run(`SELECT * FROM buku WHERE id = '${id}'`);
    const row = this.buku.get(String(id));
    return row ? { ...row, _dbQueryTime: `${ms}ms` } : null;
  }

  async getAllBuku() {
    const ms = await this._run('SELECT * FROM buku ORDER BY rating DESC');
    return [...this.buku.values()].map(b => ({ ...b, _dbQueryTime: `${ms}ms` }));
  }

  async createBuku(data) {
    const ms   = await this._run('INSERT INTO buku (...) VALUES (...)');
    const id   = uuidv4().slice(0, 8);
    const buku = { id, ...data, halaman: data.halaman || 0, rating: data.rating || 0, createdAt: new Date().toISOString() };
    this.buku.set(id, buku);
    return { ...buku, _dbQueryTime: `${ms}ms` };
  }

  async updateBuku(id, data) {
    const ms       = await this._run(`UPDATE buku SET ... WHERE id = '${id}'`);
    const existing = this.buku.get(String(id));
    if (!existing) return null;
    const updated  = { ...existing, ...data, id: existing.id, updatedAt: new Date().toISOString() };
    this.buku.set(String(id), updated);
    return { ...updated, _dbQueryTime: `${ms}ms` };
  }

  async deleteBuku(id) {
    await this._run(`DELETE FROM buku WHERE id = '${id}'`);
    return this.buku.delete(String(id));
  }

  // -- Pengarang ---------------------------------
  async getPengarang(id) {
    const ms  = await this._run(`SELECT * FROM pengarang WHERE id = '${id}'`);
    const row = this.pengarang.get(String(id));
    return row ? { ...row, _dbQueryTime: `${ms}ms` } : null;
  }

  // -- Stats -------------------------------------
  getStats() {
    return {
      totalQueries:    this.queryCount,
      avgQueryTime:    this.queryCount ? `${Math.round(this.totalQueryTime / this.queryCount)}ms` : '0ms',
      totalQueryTime:  `${this.totalQueryTime}ms`,
      jumlahBuku:      this.buku.size,
      jumlahPengarang: this.pengarang.size,
      recentQueries:   this.queryLog.slice(-5),
    };
  }

  reset() {
    this.queryCount     = 0;
    this.totalQueryTime = 0;
    this.queryLog       = [];
    this.buku = new Map(initialBuku.map(b => [b.id, { ...b }]));
  }
}

module.exports = new MockDatabase();
