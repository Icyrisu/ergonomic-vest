Saya memiliki project fullstack dengan struktur seperti berikut:

- frontend (React + Vite)
- backend (Node.js + Express)
- database (PostgreSQL)
- Docker Compose

Tujuan saya adalah merapikan seluruh project agar memiliki struktur yang profesional, mudah di-maintain, scalable, dan production-ready, tetapi tetap dijalankan secara lokal menggunakan Docker Compose.

Tolong lakukan refactor pada seluruh project dengan ketentuan berikut:

1. Jangan mengubah fitur atau alur kerja aplikasi.
2. Semua endpoint API harus tetap kompatibel.
3. Semua fungsi MQTT harus tetap berjalan.
4. Semua query PostgreSQL tetap bekerja.
5. Docker Compose tetap menjadi cara utama menjalankan aplikasi.
6. Pastikan seluruh service dapat dijalankan hanya dengan:

   docker compose up --build

7. Rapikan struktur folder menjadi seperti berikut jika diperlukan:

project/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   ├── assets/
│   ├── package.json
│   └── Dockerfile
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── mqtt/
│   │   ├── database/
│   │   ├── models/
│   │   ├── services/
│   │   ├── config/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── Dockerfile
│
├── database/
│   ├── init.sql
│   ├── migration/
│   └── seed/
│
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
└── README.md

8. Pisahkan konfigurasi ke file .env.

9. Semua hardcode harus dipindahkan ke environment variable.

10. Tambahkan validasi environment variable saat aplikasi dijalankan.

11. Rapikan import.

12. Hilangkan kode yang tidak digunakan.

13. Hilangkan dependency yang tidak dipakai.

14. Tambahkan error handling yang baik.

15. Tambahkan logging yang rapi.

16. Gunakan async/await secara konsisten.

17. Pastikan seluruh koneksi database menggunakan pool.

18. Pisahkan logic bisnis dari route.

19. Pisahkan konfigurasi MQTT.

20. Jangan ada duplicate code.

21. Pastikan Dockerfile menggunakan image yang ringan (misalnya node:20-alpine).

22. Optimalkan Dockerfile menggunakan layer cache.

23. Gunakan .dockerignore.

24. Pastikan volume Docker hanya digunakan saat development.

25. Tambahkan healthcheck untuk PostgreSQL dan backend.

26. Gunakan depends_on dengan kondisi service_healthy bila memungkinkan.

27. Tambahkan restart policy yang sesuai.

28. Pastikan frontend menggunakan environment variable untuk URL backend.

29. Buat README yang menjelaskan:
    - cara install
    - cara menjalankan
    - struktur project
    - konfigurasi environment
    - Docker Compose
    - troubleshooting

30. Pastikan project dapat dijalankan hanya dengan:

docker compose up --build

31. Jangan mengubah UI maupun fitur aplikasi.

32. Jangan menghapus fitur MQTT.

33. Jangan mengubah struktur database kecuali memang diperlukan.

34. Jangan membuat fitur baru.

35. Fokus hanya pada refactor, clean architecture, clean code, keamanan dasar, dan maintainability.

Saat melakukan perubahan:
- Jelaskan alasan setiap perubahan.
- Tampilkan file yang diubah.
- Berikan isi file lengkap, bukan hanya potongan kode.
- Jika ada bug, perbaiki tanpa mengubah perilaku aplikasi.
- Pastikan hasil akhirnya tetap berjalan di Docker Compose lokal tanpa error.