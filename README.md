# Cache Perpustakaan Digital � Simulasi Strategi Caching

> **Tugas Mata Kuliah: Scalable Systems**
> **Nama:** Nur Alam Nasyrah
> **NIM:** 105841104823
>
> Simulasi konsep Caching pada sistem Perpustakaan Digital menggunakan Node.js + Express � Redis, Memcached, CDN, Cache Strategies, dan Eviction Policies.

---

## Daftar Isi
1. [Konsep Caching](#konsep-caching)
2. [Struktur Proyek](#struktur-proyek)
3. [Cara Menjalankan](#cara-menjalankan)
4. [API Endpoints](#api-endpoints)
5. [Hasil Pengujian](#hasil-pengujian)

---

## Konsep Caching

Cache adalah penyimpanan data sementara di memory (RAM) yang memungkinkan akses jauh lebih cepat dibanding mengambil data dari database.

```
Tanpa Cache:  Client ? App ? Database (~150ms) ? App ? Client
Dengan Cache: Client ? App ? Cache (< 1ms)     ? App ? Client
```

---

### 1. Cache-Aside (Lazy Loading)

Aplikasi cek cache dulu. MISS ? query DB ? simpan ke cache.

**Keuntungan:** Hemat memory | **Kekurangan:** Cold start lambat

### 2. Write-Through

Write ke cache DAN database bersamaan.

**Keuntungan:** Cache selalu konsisten | **Kekurangan:** Write 2x lebih lambat

### 3. Write-Behind (Write-Back)

Write ke cache dulu, DB ditulis async via antrian.

**Keuntungan:** Write sangat cepat (<1ms) | **Kekurangan:** Risiko data hilang saat crash

### 4. Read-Through

Cache layer otomatis load dari DB saat miss, transparan untuk aplikasi.

---

### Redis vs Memcached

| Fitur | Redis | Memcached |
|-------|-------|-----------|
| **Tipe Data** | String/Hash/List/Set/ZSet | String only |
| **Persistensi** | Ada | Tidak ada |
| **TTL** | Per key | Per item |
| **CAS** | Tidak built-in | Ya |
| **Pub/Sub** | Ya | Tidak |

---

### CDN Edge Servers

| Edge | Kota | Latensi |
|------|------|---------|
| JKT | Jakarta | 4ms |
| SBY | Surabaya | 10ms |
| BDG | Bandung | 12ms |
| SIN | Singapura | 18ms |
| KUL | Kuala Lumpur | 25ms |
| TYO | Tokyo | 45ms |

---

### Eviction Policies

| Policy | Cara Kerja | Demo Key |
|--------|-----------|----------|
| **LRU** | Hapus genre paling lama tidak diakses | fiksi, nonfiksi, sains, sejarah, teknologi |
| **LFU** | Hapus genre paling jarang diakses | sama |
| **FIFO** | Hapus terbitan pertama masuk | 2019, 2020, 2021, 2022, 2023 |
| **TTL** | Kedaluwarsa otomatis | diskon:buku TTL=2s |

---

## Struktur Proyek

```
tugas-chacing2/
+-- src/
�   +-- app.js
�   +-- data/mockDatabase.js          # 8 buku, 5 pengarang
�   +-- simulations/
�   �   +-- RedisSimulation.js
�   �   +-- MemcachedSimulation.js
�   �   +-- CDNSimulation.js
�   �   +-- EvictionStrategies.js
�   +-- strategies/
�   �   +-- CacheAside.js
�   �   +-- WriteThrough.js
�   �   +-- WriteBehind.js
�   �   +-- ReadThrough.js
�   +-- routes/
�       +-- cacheStrategyRoutes.js
�       +-- redisRoutes.js
�       +-- memcachedRoutes.js
�       +-- cdnRoutes.js
�       +-- evictionRoutes.js
�       +-- statsRoutes.js
+-- Screenshot/
+-- postman_collection.json
+-- README.md
```

---

## Cara Menjalankan

```bash
cd tugas-chacing2
npm install
npm start
```

Server ? **http://localhost:3000**

---

## API Endpoints

### Cache Strategies `/api/strategies`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/strategies/cache-aside/buku` | Semua buku (Cache-Aside) |
| GET | `/api/strategies/cache-aside/buku/:id` | Buku by ID |
| POST | `/api/strategies/cache-aside/buku` | Tambah buku baru |
| PUT | `/api/strategies/cache-aside/buku/:id` | Update + invalidate cache |
| DELETE | `/api/strategies/cache-aside/buku/:id` | Hapus + invalidate cache |
| POST | `/api/strategies/write-through/buku` | Write-Through |
| POST | `/api/strategies/write-behind/buku` | Write-Behind |
| GET | `/api/strategies/write-behind/antrian` | Status antrian DB |
| POST | `/api/strategies/write-behind/flush` | Flush antrian ke DB |
| GET | `/api/strategies/read-through/buku/:id` | Read-Through |
| GET | `/api/strategies/read-through/pengarang/:id` | Get pengarang |

### Redis `/api/redis`
String, Hash, List, Set, Sorted Set, TTL � lihat `/api/redis/info`

### Memcached `/api/memcached`
SET, GET, GETS+CAS, ADD, REPLACE, INCR, DECR

### CDN `/api/cdn`
`GET /api/cdn/resource?url=/assets/logo-pustaka.png&edge=JKT`

### Eviction `/api/eviction`
`GET /api/eviction/lru/demo` | `lfu/demo` | `fifo/demo` | `ttl/demo`

### Stats `/api/stats`
`GET /api/stats` � `GET /api/stats/comparison`

---

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
