# Menara — Panel Bot Telegram

Dashboard untuk memasang dan menjalankan banyak bot Telegram sekaligus.
Punya sistem akun (daftar/masuk), mode kata kunci tanpa coding, mode kode
custom (JS) untuk kirim gambar/tombol/terhubung AI, dan panel khusus admin.

## Alur pemakaian

1. Buka landing page → **Get Started** → daftar akun (email + password).
2. Masuk ke dashboard → tempel token bot dari @BotFather → bot langsung aktif.
3. Pilih mode per bot:
   - **Kata kunci** — atur kata kunci → balasan otomatis, tanpa coding.
   - **Kode custom (JS)** — tulis kode sendiri, ada 2 template siap pakai:
     dasar (teks+gambar+tombol) dan terhubung AI (ChatGPT/kompatibel OpenAI).
4. Admin bisa buka `/admin` untuk melihat semua akun dan bot yang terdaftar
   di seluruh sistem (bukan cuma miliknya sendiri).

## Cara kerja (penting dibaca)

Vercel itu **serverless** — tidak ada proses yang "menyala terus" seperti VPS.
Karena itu bot di sini **tidak** memakai long-polling, tapi **webhook**:

1. Kamu tempel token bot di dashboard.
2. Sistem otomatis daftar webhook ke Telegram, mengarah ke
   `https://domain-kamu.vercel.app/api/webhook/[botId]`.
3. Setiap ada pesan masuk ke bot, Telegram langsung memanggil endpoint itu,
   dan bot membalas dalam hitungan milidetik.

### Mode kode custom — soal keamanan

Kode custom dijalankan lewat sandbox ringan (`lib/botRuntime.js`) yang
memblokir akses ke `require`, `process`, `eval`, filesystem, dsb — supaya
bot satu user tidak bisa membaca data/token milik bot user lain. Ini **bukan**
isolasi sekelas V8 isolate (seperti isolated-vm), karena isolated-vm butuh
native compile yang tidak reliable di Vercel serverless. Untuk pemakaian
sebagai fitur produk (bukan platform publik untuk kode dari orang asing
manapun), pendekatan ini cukup aman dan pasti jalan di Vercel.

## Fitur bawaan

- Daftar/masuk akun dengan email + password (password di-hash bcrypt,
  session pakai JWT di cookie httpOnly).
- Tempel token → otomatis divalidasi ke Telegram, webhook langsung dipasang.
- Mode kata kunci: atur `/start`, balasan default, dan kata kunci→balasan,
  semua dari web tanpa perlu coding.
- Mode kode custom: tulis JS sendiri dengan akses ke `ctx.sendMessage()`,
  `ctx.sendPhoto()`, `ctx.callAI()` (ChatGPT/kompatibel OpenAI), `ctx.fetchJSON()`.
- Panel admin (`/admin`): lihat semua akun dan bot yang terdaftar di sistem.
- Jeda/aktifkan bot kapan saja tanpa menghapus token.
- Log pesan terakhir per bot.
- Hapus bot → webhook otomatis dicabut dari Telegram.

## Deploy ke Vercel

### 1. Push ke GitHub

```bash
git init
git add .
git commit -m "Menara - panel bot telegram"
git branch -M main
git remote add origin <url-repo-kamu>
git push -u origin main
```

### 2. Import project di Vercel

- Buka https://vercel.com/new, pilih repo ini.
- Framework preset otomatis terdeteksi sebagai Next.js. Klik **Deploy**.

### 3. Pasang database (WAJIB — untuk simpan token & rules)

Project ini pakai **MongoDB Atlas** (free tier permanen, tanpa kartu kredit):

1. Daftar/login di https://cloud.mongodb.com, buat cluster **Free (M0)**.
2. Di **Database Access**, buat user dengan password yang kuat (jangan pakai
   password sederhana, dan jangan pernah share connection string ke siapapun
   termasuk di chat/forum — itu setara membagi password database kamu).
3. Di **Network Access**, tambahkan `0.0.0.0/0` (allow all) supaya Vercel
   bisa connect — ini aman selama password kuat, karena akses tetap butuh
   autentikasi.
4. Klik **Connect** pada cluster → **Drivers** → salin connection string,
   bentuknya seperti:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=Cluster0`
5. Di dashboard project Vercel → **Settings → Environment Variables**,
   tambahkan:
   - Key: `MONGODB_URI`, Value: connection string di atas
   - Key: `SESSION_SECRET`, Value: string acak panjang (contoh generate:
     `openssl rand -base64 32` di terminal, atau pakai generator online yang
     terpercaya)
6. **Redeploy** project (tab Deployments → titik tiga → Redeploy) supaya
   env var baru terbaca.

### 4. Jadikan akun sebagai admin (manual, sekali saja)

Setelah kamu daftar akun pertama lewat web, semua akun baru otomatis
`role: 'user'`. Untuk menjadikan salah satu akun sebagai admin:

1. Buka MongoDB Atlas → **Browse Collections** → database `menara` →
   collection `users`.
2. Cari dokumen dengan email kamu, klik **Edit**.
3. Ubah field `role` dari `"user"` menjadi `"admin"`.
4. Simpan. Logout & login lagi di web supaya session ter-refresh — sekarang
   akun itu bisa buka `/admin`.

### 5. Selesai — buka domain Vercel kamu

Begitu domain aktif, buka di browser, klik **Get Started**, daftar akun,
lalu tempel token bot dari @BotFather.

## Menjalankan lokal (opsional, untuk development)

```bash
npm install
cp .env.example .env.local
# isi MONGODB_URI dan SESSION_SECRET di .env.local
npm run dev
```

Catatan: Telegram tidak bisa mengirim webhook ke `localhost`. Untuk test
lokal, pakai tunnel seperti `ngrok http 3000` lalu register webhook manual
ke URL ngrok tersebut — atau langsung test di environment yang sudah deploy.

## Struktur project

```
app/
  page.js                        → landing page
  login/page.js, register/page.js→ halaman masuk & daftar
  dashboard/page.js               → dashboard kelola bot (butuh login)
  admin/page.js                   → panel admin (khusus role admin)
  api/auth/*                      → register, login, logout, cek sesi
  api/admin/overview              → data semua user & bot (khusus admin)
  api/bots/*                      → kelola bot (terikat ke pemilik)
  api/bots/[id]/code              → simpan kode custom
  api/webhook/[botId]             → endpoint yang dipanggil Telegram
lib/
  mongo.js, db.js                 → koneksi & query MongoDB
  auth.js                         → hash password, JWT session
  botEngine.js                    → panggilan API Telegram, rule-based reply
  botRuntime.js                   → sandbox eksekusi kode custom
components/
  LandingPage.jsx, LoginForm.jsx, RegisterForm.jsx  → tema brutalism
  AuthContext.jsx                 → state auth global (React context)
  Dashboard.jsx, BotCard.jsx, AddBotPanel.jsx, EmptyState.jsx
```

## Mengembangkan lebih lanjut

Kode custom dieksekusi lewat `runCustomHandler()` di `lib/botRuntime.js`.
Kalau butuh helper tambahan (misalnya kirim video, poll, atau integrasi API
lain), tinggal tambahkan method baru di object `ctx` pada fungsi
`buildContext()` di file yang sama.

