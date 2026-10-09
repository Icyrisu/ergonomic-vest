# 🚀 Panduan Lengkap Deployment VPS (Untuk Pemula)
### Proyek: Ergonomic Vest Dashboard (React PWA + Express + PostgreSQL + MQTT)
**Spesifikasi Server Target:** 2 vCPU, 4 GB RAM (Ubuntu 22.04 LTS / 24.04 LTS)

---

## 📌 Ringkasan Spesifikasi & Konsumsi RAM

Apakah VPS **2 Core 4 GB RAM** bisa menjalankan proyek ini?
> **Jawabannya: SANGAT BISA dan SANGAT STABIL!**

Aplikasi ini menggunakan arsitektur kontainer yang sangat efisien:
- **OS Linux (Ubuntu)**: ~350 MB RAM
- **PostgreSQL 15**: ~80 - 150 MB RAM
- **Node.js Express + Socket.IO**: ~80 - 120 MB RAM
- **Frontend Nginx Alpine**: ~15 - 30 MB RAM
- **Total Beban RAM**: Sekitar **550 MB – 750 MB** saja!
- **Sisa RAM Bebas**: Masih ada **~3.2 GB**, sangat aman untuk kebutuhan jangka panjang.

---

## 🛠️ Langkah Demi Langkah (Step-by-Step)

### LANGKAH 1: Login ke VPS Anda via SSH

Buka **PowerShell** (Windows) atau **Terminal** (Mac/Linux) di laptop Anda, lalu ketik:

```bash
ssh root@<IP_VPS_ANDA>
```
*Ganti `<IP_VPS_ANDA>` dengan alamat IP publik VPS yang diberikan oleh penyedia hosting Anda (misal: `ssh root@103.123.45.67`).*
- Masukkan password root VPS Anda saat diminta (tulisan password memang tidak akan muncul saat diketik, langsung tekan `Enter`).

---

### LANGKAH 2: Update Sistem & Aktifkan Swap Memory (2GB)

Setelah berhasil masuk ke terminal VPS, jalankan perintah ini untuk memperbarui sistem dan membuat memori cadangan (*swap file*) agar server tidak pernah macet saat proses kompilasi:

```bash
# 1. Update paket sistem
sudo apt update && sudo apt upgrade -y

# 2. Buat Swap Memory 2 GB sebagai pengaman
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Kunci swap agar otomatis aktif setiap server restart
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### LANGKAH 3: Install Docker & Docker Compose

Jalankan perintah resmi Docker berikut untuk menginstall Docker Engine dan Docker Compose secara otomatis:

```bash
# 1. Unduh dan jalankan script resmi instalasi Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Pastikan Docker berhasil terpasang
docker --version
docker compose version
```

---

### LANGKAH 4: Konfigurasi Firewall (UFW)

Agar server Anda aman dari serangan liar di internet, kita aktifkan firewall dan hanya buka port SSH (22) dan Web (80):

```bash
# Izinkan koneksi SSH (PENTING: Jangan sampai lupa agar tidak terkunci keluar!)
sudo ufw allow 22/tcp

# Izinkan akses Web Dashboard
sudo ufw allow 80/tcp

# Aktifkan Firewall
sudo ufw enable
```
*Ketik `y` lalu tekan `Enter` jika muncul konfirmasi.*

---

### LANGKAH 5: Masukkan Proyek ke VPS

Anda memiliki 2 pilihan cara:

#### Opsi A: Menggunakan Git Clone (Paling Direkomendasikan)
Jika proyek ini sudah ada di akun GitHub Anda:
```bash
cd ~
git clone https://github.com/<username-anda>/<nama-repo>.git
cd <nama-repo>
```

#### Opsi B: Upload Manual via FileZilla / SCP
Jika Anda belum mengunggah ke GitHub:
1. Download aplikasi **FileZilla** di laptop Anda.
2. Hubungkan ke Host: `sftp://<IP_VPS_ANDA>`, Username: `root`, Port: `22`.
3. Upload seluruh folder `Ergonomic_Vest_Dashboard` ke direktori `/root/` di VPS.
4. Di terminal VPS, masuk ke folder tersebut:
   ```bash
   cd ~/Ergonomic_Vest_Dashboard
   ```

---

### LANGKAH 6: Siapkan File Environment (`.env`)

Salin file contoh konfigurasi produksi yang sudah disiapkan:

```bash
# Salin template
cp .env.prod.example .env

# Buka file .env untuk mengedit password
nano .env
```

Ubah bagian `POSTGRES_PASSWORD` dengan password rahasia Anda, misalnya:
```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=PasswordRahasiaVest2026!
POSTGRES_DB=ergonomic_vest
DATABASE_PORT=5432

BACKEND_PORT=3000
MQTT_BROKER=wss://broker.hivemq.com:8884/mqtt
FRONTEND_PORT=80
```

> **Cara Simpan di Editor Nano:**
> 1. Tekan tombol `Ctrl + O` lalu tekan `Enter` (untuk menyimpan).
> 2. Tekan tombol `Ctrl + X` (untuk keluar dari nano).

---

### LANGKAH 7: Bangun dan Jalankan Kontainer (Production)

Jalankan perintah ini di dalam folder proyek:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Docker akan secara otomatis:
1. Men-download image PostgreSQL 15 & Node.js 20.
2. Meng-compile source code React ke bentuk statis yang sangat cepat.
3. Menyiapkan web server Nginx Alpine.
4. Menghubungkan semua service dalam jaringan internal Docker.

Tunggu sekitar 1–3 menit (hanya di awal build).

---

### LANGKAH 8: Verifikasi & Cek Status

Periksa apakah semua kontainer telah berjalan dengan sehat:

```bash
docker compose -f docker-compose.prod.yml ps
```
Pastikan ketiga service berstatus **Up (healthy)**:
- `ev-database`
- `ev-backend`
- `ev-frontend`

Untuk melihat log aktivitas (misalnya koneksi MQTT atau Socket.IO):
```bash
docker compose -f docker-compose.prod.yml logs -f
```
*(Tekan `Ctrl + C` untuk berhenti melihat log).*

---

### LANGKAH 9: Akses Dashboard dari Laptop / Smartphone

Buka browser (Google Chrome, Microsoft Edge, Safari) di laptop atau HP Anda, lalu ketik di bilah alamat:

```text
http://<IP_VPS_ANDA>
```
*(Contoh: `http://103.123.45.67`)*

🎉 **Selamat! Dashboard Ergonomic Vest Anda sudah online dan dapat diakses dari mana saja!**

---

### LANGKAH 10: Menghubungkan Domain & Mengaktifkan HTTPS (SSL Gratis)

Jika Anda sudah memiliki nama domain (misal: `domainanda.com` atau subdomain `vest.domainanda.com`), ikuti langkah berikut untuk mengaktifkan HTTPS (gembok hijau/aman):

#### 1. Arahkan DNS Domain ke IP VPS
Buka dashboard tempat Anda membeli domain (Niagahoster, DomaiNesia, Cloudflare, Namecheap, Rumahweb, dll):
- Buka menu **DNS Management** / **Zone Editor**.
- Tambahkan **A Record**:
  - **Type**: `A`
  - **Name / Host**: `@` (untuk domain utama `domainanda.com`) atau `vest` (untuk `vest.domainanda.com`)
  - **Points to / Target / Value**: `<IP_VPS_ANDA>`
  - **TTL**: `Auto` atau `300`
- Simpan. Tunggu 5–15 menit hingga domain mengarah ke server Anda. Anda bisa mengetes dengan membuka `http://domainanda.com` di browser.

---

#### 2. Pilih Salah Satu Metode Pasang SSL:

##### METODE A: Menggunakan Cloudflare (Cara Paling Cepat, 0 Ketik Terminal)
Jika nameserver domain Anda menggunakan **Cloudflare**:
1. Di DNS Cloudflare, pastikan status **Proxy** aktif (awan berwarna oranye).
2. Masuk ke menu **SSL/TLS** di Cloudflare, pilih mode **Flexible** atau **Full**.
3. Akses `https://domainanda.com`. HTTPS langsung aktif otomatis tanpa perlu install apa pun di VPS!

##### METODE B: Menggunakan Let's Encrypt Certbot di VPS (Standar & Resmi)
Jika Anda ingin SSL terpasang langsung di dalam server Ubuntu Anda:

**1. Pindahkan port Docker frontend ke 8080 (agar port 80 & 443 bebas untuk SSL Nginx host):**
Buka file `.env` di VPS:
```bash
nano .env
```
Ubah baris `FRONTEND_PORT=80` menjadi:
```env
FRONTEND_PORT=8080
```
Simpan (`Ctrl + O`, `Enter`, `Ctrl + X`), lalu terapkan:
```bash
docker compose -f docker-compose.prod.yml up -d
```

**2. Buka Port HTTPS (443) di Firewall:**
```bash
sudo ufw allow 443/tcp
```

**3. Install Nginx dan Certbot di Ubuntu:**
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

**4. Buat Konfigurasi Nginx untuk Domain Anda:**
```bash
sudo nano /etc/nginx/sites-available/ergonomic-vest
```
Tempel konfigurasi berikut (ganti `domainanda.com` dengan nama domain asli Anda):
```nginx
server {
    listen 80;
    server_name domainanda.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
Simpan (`Ctrl + O`, `Enter`, `Ctrl + X`).

**5. Aktifkan Konfigurasi Nginx:**
```bash
sudo ln -s /etc/nginx/sites-available/ergonomic-vest /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

**6. Pasang Sertifikat SSL Gratis (Certbot):**
Jalankan perintah ini:
```bash
sudo certbot --nginx -d domainanda.com
```
- Masukkan alamat email Anda (untuk notifikasi perpanjangan jika perlu).
- Ketik `y` untuk menyetujui Terms of Service.
- Certbot akan otomatis menginstal sertifikat SSL, mengkonfigurasi HTTPS port 443, dan mengalihkan semua HTTP ke HTTPS!

Sekarang buka browser Anda:
```text
https://domainanda.com
```
Status koneksi akan aman dengan lambang gembok HTTPS!

---

## 🔧 Panduan Pemeliharaan & Troubleshooting

### 1. Bagaimana cara mematikan atau menyalakan ulang aplikasi?
- **Restart aplikasi:**
  ```bash
  docker compose -f docker-compose.prod.yml restart
  ```
- **Stop aplikasi:**
  ```bash
  docker compose -f docker-compose.prod.yml down
  ```
- **Start kembali:**
  ```bash
  docker compose -f docker-compose.prod.yml up -d
  ```

### 2. Bagaimana cara meng-update kode setelah ada perubahan baru?
Jika Anda mengubah kode di laptop dan meng-update-nya di VPS:
```bash
# Tarik update terbaru
git pull

# Rebuild kontainer tanpa memutus data database
docker compose -f docker-compose.prod.yml up -d --build
```
*(Catatan: Data riwayat sesi di database PostgreSQL **TIDAK AKAN HILANG** karena disimpan di volume Docker yang persisten).*

### 3. Error: "Port 80 is already in use"
Jika VPS Anda sudah terpasang Apache atau Nginx bawaan OS:
```bash
sudo systemctl stop apache2 2>/dev/null
sudo systemctl disable apache2 2>/dev/null
sudo systemctl stop nginx 2>/dev/null
sudo systemctl disable nginx 2>/dev/null
```
Lalu jalankan ulang `docker compose -f docker-compose.prod.yml up -d`.

### 4. Backup Database Manual
Jika ingin mem-backup seluruh data sesi dan sensor ke file `.sql`:
```bash
docker exec -t ev-database pg_dump -U admin ergonomic_vest > backup_data_vest.sql
```
File `backup_data_vest.sql` dapat disimpan atau dipindahkan ke komputer lokal.
