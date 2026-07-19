# Cache Perpustakaan Digital 📚 Simulasi Strategi Caching

> **Tugas Mata Kuliah:** Scalable Systems
> **Nama:** Nur Alam Nasyrah
> **NIM:** 105841104823
>
> Simulasi konsep Caching pada sistem Perpustakaan Digital menggunakan **Node.js + Express → Redis, Memcached, CDN, Cache Strategies, dan Eviction Policies.**

---

Tanpa Cache:  Client → App → Database (~150ms) → App → Client

Dengan Cache: Client → App → Cache (<1ms) → App → Client

---

### 1. Cache-Aside (Lazy Loading)

Aplikasi cek cache dulu. **MISS → query DB → simpan ke cache.**

---

Server → **http://localhost:3000**

---

### Redis `/api/redis`

String, Hash, List, Set, Sorted Set, TTL → lihat `/api/redis/info`

---

### Stats `/api/stats`

`GET /api/stats` → `GET /api/stats/comparison`

---

Test 1 → Cache MISS: GET /api/strategies/cache-aside/buku/1 (pertama kali)

Test 2 → Cache HIT: GET /api/strategies/cache-aside/buku/1 (kedua kali)

Test 3 → LRU Demo: GET /api/eviction/lru/demo

Test 4 → Redis GET: POST /api/redis/set → GET /api/redis/get/:key

Test 5 → Dashboard: GET /api/stats

---

Node.js → Express.js → Morgan → CORS → dotenv → uuid
## Hasil Pengujian (Screenshot)

### SS-1 — Cache MISS (Cache-Aside Buku)
Endpoint: `GET /api/strategies/cache-aside/buku`
Response menunjukkan `"cacheStatus":"MISS"` — data 8 buku diambil dari database (~168ms)

![Cache MISS](Screenshot/Cache%20MISS%20Semua%20Buku.png)

### SS-2 — Write-Through Cache HIT
Endpoint: `GET /api/strategies/write-through/buku`
Response menunjukkan `"cacheStatus":"HIT"` — data langsung dari cache (~91ms)

![Write-Through HIT](Screenshot/Write-Through%20Tambah%20Buku.png)

### SS-3 — LRU Eviction Demo (Genre Buku)
Endpoint: `GET /api/eviction/lru/demo`
Menampilkan genre `fiksi`, `nonfiksi`, `sains`, `sejarah`, `teknologi` — genre `fiksi` di-evict

![LRU Demo](Screenshot/LRU%20Demo%20Genre%20Buku.png)

### SS-4 — Redis GET Buku Terlaris
Endpoint: `GET /api/redis/get/buku:terlaris`
Response menunjukkan `"cacheStatus":"HIT"` — value `"Bumi Manusia"` (~14ms)

![Redis GET](Screenshot/Get%20Redis.png)

### SS-5 — Stats Dashboard
Endpoint: `GET /api/stats`
Menampilkan `"title":"Cache Perpustakaan Digital — Dashboard Statistik"` dengan data LRU, Redis, database

![Stats Dashboard](Screenshot/Stats%20Dashboard.png)

---

## Panduan Pengujian

```
Test 1 � Cache MISS: GET /api/strategies/cache-aside/buku/1  (pertama kali)
Test 2 � Cache HIT:  GET /api/strategies/cache-aside/buku/1  (kedua kali)
Test 3 � LRU Demo:   GET /api/eviction/lru/demo
Test 4 � Redis GET:  POST /api/redis/set ? GET /api/redis/get/:key
Test 5 � Dashboard:  GET /api/stats
```

---

## Teknologi

Node.js � Express.js � Morgan � CORS � dotenv � uuid

> Tidak memerlukan instalasi Redis, Memcached, atau database eksternal.
