# Ergonomic Vest - Machine Learning HAR Microservice (Python FastAPI)

Microservice berbasis **FastAPI** dan **Scikit-Learn (Random Forest)** untuk mengenali aktivitas kerja operator (*Human Activity Recognition*) dan menilai risiko ergonomi secara *real-time*.

---

## 🎯 3 Kelas Aktivitas yang Dikenali

1. **`Neutral`**:
   - Operator berdiri tegak / istirahat santai di tempat kerja.
   - Tampilan Three.js: Tangan santai di samping tubuh, **tangan kosong (tanpa objek)**.
2. **`Material Picking`**:
   - Operator membungkuk (*trunk flexion*) mengambil material / kotak perakitan.
   - Tampilan Three.js: Tangan menjangkau ke depan/bawah dan memegang **Kotak Kardus (Material Box)** dengan animasi halus.
3. **`Fastening with Tool`**:
   - Operator memegang dan mengoperasikan bor/alat (*Impact Wrench ON*).
   - Tampilan Three.js: Tangan terangkat ke depan memegang **Bor (Impact Wrench)**.

---

## 🚀 Menjalankan Service

### Opsi 1: Menjalankan Langsung di Python Lokal / VPS
1. Buat virtual environment (opsional):
   ```bash
   python -m venv venv
   source venv/bin/activate   # Linux / Mac
   # atau di Windows:
   .\venv\Scripts\activate
   ```
2. Pasang dependensi:
   ```bash
   pip install -r requirements.txt
   ```
3. Jalankan server:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```
   API dokumentasi Swagger akan tersedia di `http://localhost:8000/docs`.

### Opsi 2: Menggunakan Docker (Direkomendasikan di VPS)
Service ini sudah terintegrasi ke dalam file `docker-compose.prod.yml`:
```bash
docker compose -f docker-compose.prod.yml up -d ml-service
```

---

## 🏋️‍♂️ Cara Membuat Dataset & Melatih Model (3 Langkah Mudah)

1. **Rekam Sesi di Web Dashboard**:
   Buka dashboard web Anda, gunakan fitur **Start Session** untuk merekam 3 sesi terpisah (masing-masing 2 menit):
   - Sesi 1: `TRAIN_NEUTRAL` (berdiri tegak atau bekerja normal di meja).
   - Sesi 2: `TRAIN_PICKING` (lakukan gerakan membungkuk mengambil kotak lalu berdiri kembali berulang kali).
   - Sesi 3: `TRAIN_FASTENING` (pegang alat dan nyalakan saklar tombol Impact Wrench ON).

2. **Ekspor Berkas CSV**:
   Buka menu riwayat sesi di web dashboard, klik tombol **Export CSV** pada masing-masing sesi di atas, lalu kumpulkan file CSV ke dalam satu folder (misal `datasets/`).

3. **Jalankan Pelatihan**:
   Jalankan skrip berikut di terminal:
   ```bash
   python train_model.py --dir datasets/
   ```
   *Skrip akan otomatis mengekstrak fitur, melatih algoritma Random Forest, mengevaluasi akurasi, dan menyimpan model ke `har_model.joblib`.*

Begitu file `har_model.joblib` terbentuk, server akan otomatis memuat dan menggunakan model kustom hasil rekaman Anda!
