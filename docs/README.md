# 📚 AnaKu — Master Module Index

> **Proyek:** AnaKu — AI-Powered Childcare Monitoring & Reporting Web App
> **Tech Stack:** React.js · FastAPI · Supabase · Cloudinary · Google Gemini API

---

## Daftar Modul Pembangunan

| File | Fase | Nama Modul | Estimasi |
|------|------|-----------|---------|
| [MODUL-00](./MODUL-00_Infrastructure.md) | Fase 0 | Project Initialization & Infrastructure | 1–2 hari |
| [MODUL-01](./MODUL-01_Authentication.md) | Fase 1 | Autentikasi & Manajemen Pengguna | 1–2 hari |
| [MODUL-02](./MODUL-02_Admin_Children_QR.md) | Fase 2 | Admin — Manajemen Anak & QR Code Presensi | 1–2 hari |
| [MODUL-03](./MODUL-03_Daily_Log_Sentiment.md) | Fase 3 | Smart Daily Log + AI Sentiment Analysis | 1–2 hari |
| [MODUL-04](./MODUL-04_Gallery.md) | Fase 4 | Galeri Aktivitas (Cloudinary) | 1 hari |
| [MODUL-05](./MODUL-05_Billing.md) | Fase 5 | Tagihan & Riwayat Pembayaran | 1 hari |
| [MODUL-06](./MODUL-06_Human_Chat.md) | Fase 6 | Chat Manusia ke Manusia (Realtime) | 1–2 hari |
| [MODUL-07](./MODUL-07_AI_Features.md) | Fase 7 | 3 Inovasi Fitur AI (Chatbot, Sentiment, Cerita) | 2–3 hari |
| [MODUL-08](./MODUL-08_Parent_Dashboard.md) | Fase 8 | Parent Dashboard — Kompilasi Semua Fitur | 1–2 hari |
| [MODUL-09](./MODUL-09_Polish_Testing.md) | Fase 9 | Polish, Testing & Deployment Prep | 1–2 hari |

**Total Estimasi: 11–18 hari kerja**

---

## Urutan Pengerjaan yang Disarankan

```
MODUL-00 → MODUL-01 → MODUL-02
                            ├── MODUL-03 (Daily Log) → AI Sentiment otomatis terpicu
                            ├── MODUL-04 (Gallery)
                            ├── MODUL-05 (Billing)
                            └── MODUL-06 (Chat) → MODUL-07 (AI Chatbot)
                                                        └── MODUL-08 (Parent Dashboard)
                                                                └── MODUL-09 (Polish)
```

---

## Konvensi Kode

- **Branch naming:** `feat/modul-XX-nama-singkat`
- **Commit format:** `[MODUL-XX] deskripsi perubahan`
- **API prefix:** semua endpoint backend → `/api/v1/...`
- **Status response:** selalu gunakan format `{ "status": "success"|"error", "data": ..., "message": ... }`
