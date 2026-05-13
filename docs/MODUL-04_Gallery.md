# MODUL-04 — Galeri Aktivitas (Cloudinary)

> **Fase:** 4 | **Estimasi:** 1 hari | **Prasyarat:** MODUL-01, MODUL-02

---

## Tujuan Modul

Pengasuh dapat mengunggah foto/video aktivitas anak ke Cloudinary. Orang tua dapat melihat galeri dalam tampilan grid/lightbox yang elegan.

---

## Checklist Tugas

- [ ] 4.1 Backend: Cloudinary service
- [ ] 4.2 Backend: Gallery endpoints (upload, list, delete)
- [ ] 4.3 Frontend: Halaman Upload Galeri (Caregiver)
- [ ] 4.4 Frontend: Halaman View Galeri (Parent)

---

## 4.1 — Backend: Cloudinary Service

### `backend/services/cloudinary_service.py`
```python
import cloudinary
import cloudinary.uploader
from core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

def upload_media(file_bytes: bytes, filename: str, media_type: str = "image") -> dict:
    """
    Upload file ke Cloudinary.
    Return: {"url": ..., "public_id": ...}
    """
    resource_type = "video" if media_type == "video" else "image"
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="anaku/gallery",
        public_id=filename,
        resource_type=resource_type,
        overwrite=False,
        transformation=[{"quality": "auto", "fetch_format": "auto"}]
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}

def delete_media(public_id: str, media_type: str = "image") -> bool:
    """Hapus file dari Cloudinary berdasarkan public_id"""
    resource_type = "video" if media_type == "video" else "image"
    result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    return result.get("result") == "ok"
```

---

## 4.2 — Backend: Gallery Endpoints

### `backend/api/endpoints/galleries.py`
```python
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from api.deps import get_current_user, require_role
from services.cloudinary_service import upload_media, delete_media
from supabase import create_client
from core.config import settings
import uuid

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

@router.post("/upload", dependencies=[Depends(require_role("caregiver"))])
async def upload_gallery(
    file: UploadFile = File(...),
    child_id: str = Form(...),
    caption: str = Form(""),
    activity_date: str = Form(""),
    current_user = Depends(get_current_user)
):
    """[Caregiver] Upload foto/video ke Cloudinary, lalu simpan metadata ke DB"""
    # Validasi tipe file
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipe file tidak didukung: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, "Ukuran file melebihi 50 MB")

    media_type = "video" if file.content_type.startswith("video") else "photo"
    unique_name = f"{child_id}_{uuid.uuid4().hex[:8]}"

    # Upload ke Cloudinary
    cloud_result = upload_media(content, unique_name, media_type)

    # Simpan metadata ke database
    gallery_data = {
        "child_id": child_id,
        "uploader_id": current_user["id"],
        "cloudinary_url": cloud_result["url"],
        "public_id": cloud_result["public_id"],
        "media_type": media_type,
        "caption": caption,
        "activity_date": activity_date or None,
    }
    res = sb.table("galleries").insert(gallery_data).execute()
    return {"status": "success", "data": res.data[0]}

@router.get("/")
async def list_gallery(
    child_id: str = None,
    current_user = Depends(get_current_user)
):
    """Ambil galeri. Parent hanya lihat anaknya sendiri."""
    query = sb.table("galleries").select("*, children(full_name), users!uploader_id(full_name)")
    if child_id:
        query = query.eq("child_id", child_id)
    elif current_user["role"] == "parent":
        kids = sb.table("children").select("id").eq("parent_id", current_user["id"]).execute()
        ids = [k["id"] for k in kids.data]
        if ids:
            query = query.in_("child_id", ids)
    res = query.order("created_at", desc=True).execute()
    return {"status": "success", "data": res.data}

@router.delete("/{gallery_id}", dependencies=[Depends(require_role("caregiver"))])
async def delete_gallery(gallery_id: str):
    """[Caregiver] Hapus foto dari DB dan Cloudinary"""
    item = sb.table("galleries").select("*").eq("id", gallery_id).single().execute()
    if not item.data:
        raise HTTPException(404, "Media tidak ditemukan")
    delete_media(item.data["public_id"], item.data["media_type"])
    sb.table("galleries").delete().eq("id", gallery_id).execute()
    return {"status": "success", "message": "Media berhasil dihapus"}
```

---

## 4.3 — Frontend: Upload Galeri (Caregiver)

### `frontend/src/pages/caregiver/GalleryUpload.jsx`
```jsx
import { useEffect, useRef, useState } from 'react'
import api from '../../lib/axios'
import toast from 'react-hot-toast'

export default function GalleryUpload() {
  const [children, setChildren] = useState([])
  const [form, setForm] = useState({ child_id:'', caption:'', activity_date:'' })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [gallery, setGallery] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    api.get('/api/v1/children').then(r => setChildren(r.data.data))
    loadGallery()
  }, [])

  const loadGallery = async () => {
    const r = await api.get('/api/v1/galleries')
    setGallery(r.data.data)
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file || !form.child_id) { toast.error('Pilih anak dan file'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('child_id', form.child_id)
    fd.append('caption', form.caption)
    fd.append('activity_date', form.activity_date)
    try {
      await api.post('/api/v1/galleries/upload', fd, { headers:{'Content-Type':'multipart/form-data'} })
      toast.success('Foto/video berhasil diunggah!')
      setFile(null); setPreview(null)
      setForm(f => ({...f, caption:'', activity_date:''}))
      loadGallery()
    } catch(e) {
      toast.error(e.response?.data?.detail || 'Gagal upload')
    }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus media ini?')) return
    await api.delete(`/api/v1/galleries/${id}`)
    toast.success('Media dihapus')
    loadGallery()
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>🖼️ Unggah Galeri Aktivitas</h2>

      {/* Upload Form */}
      <form onSubmit={handleUpload} style={styles.uploadCard}>
        <div style={styles.dropZone} onClick={() => fileRef.current.click()}>
          {preview
            ? <img src={preview} alt="preview" style={styles.previewImg} />
            : <div style={styles.dropText}><span style={{fontSize:'2.5rem'}}>📸</span><br/>Klik untuk pilih foto/video</div>
          }
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:'none'}} onChange={handleFile} />
        </div>
        <select style={styles.input} value={form.child_id}
          onChange={e => setForm(f=>({...f, child_id:e.target.value}))} required>
          <option value="">-- Pilih Anak --</option>
          {children.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <input style={styles.input} placeholder="Caption (opsional)"
          value={form.caption} onChange={e => setForm(f=>({...f, caption:e.target.value}))} />
        <input style={styles.input} type="date" value={form.activity_date}
          onChange={e => setForm(f=>({...f, activity_date:e.target.value}))} />
        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? '⏳ Mengunggah...' : '🚀 Upload'}
        </button>
      </form>

      {/* Galeri Grid */}
      <h3 style={{marginBottom:'1rem', marginTop:'2rem'}}>📁 Semua Foto/Video</h3>
      <div style={styles.grid}>
        {gallery.map(item => (
          <div key={item.id} style={styles.mediaCard}>
            {item.media_type === 'video'
              ? <video src={item.cloudinary_url} style={styles.media} controls />
              : <img src={item.cloudinary_url} alt={item.caption} style={styles.media} />
            }
            <div style={styles.caption}>{item.caption || '(tanpa caption)'}</div>
            <div style={styles.meta}>{item.children?.full_name} · {item.activity_date}</div>
            <button style={styles.delBtn} onClick={() => handleDelete(item.id)}>🗑️ Hapus</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  page:       { padding:'2rem' },
  title:      { fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' },
  uploadCard: { background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-lg)', padding:'1.5rem',
                display:'flex', flexDirection:'column', gap:'1rem', maxWidth:'480px' },
  dropZone:   { border:'2px dashed var(--primary)', borderRadius:'var(--radius-md)',
                minHeight:'160px', display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer', overflow:'hidden' },
  dropText:   { textAlign:'center', color:'var(--text-muted)', fontSize:'0.9rem' },
  previewImg: { width:'100%', maxHeight:'200px', objectFit:'cover' },
  input:      { background:'var(--surface-2)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-sm)', padding:'0.75rem', color:'var(--text)' },
  btn:        { background:'var(--primary)', color:'#fff', border:'none',
                borderRadius:'var(--radius-md)', padding:'0.8rem', fontWeight:600, cursor:'pointer' },
  grid:       { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:'1rem' },
  mediaCard:  { background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-md)', overflow:'hidden' },
  media:      { width:'100%', height:'160px', objectFit:'cover' },
  caption:    { padding:'0.5rem 0.75rem', fontWeight:500, fontSize:'0.85rem' },
  meta:       { padding:'0 0.75rem 0.25rem', color:'var(--text-muted)', fontSize:'0.75rem' },
  delBtn:     { margin:'0 0.75rem 0.75rem', background:'transparent', border:'1px solid var(--danger)',
                color:'var(--danger)', borderRadius:'var(--radius-sm)', padding:'0.3rem 0.75rem',
                cursor:'pointer', fontSize:'0.8rem' },
}
```

---

## 4.4 — Frontend: View Galeri (Parent)

### `frontend/src/pages/parent/Gallery.jsx`
```jsx
import { useEffect, useState } from 'react'
import api from '../../lib/axios'

export default function ParentGallery() {
  const [gallery, setGallery] = useState([])
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    api.get('/api/v1/galleries').then(r => setGallery(r.data.data))
  }, [])

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>🖼️ Galeri Aktivitas Si Kecil</h2>
      <div style={styles.grid}>
        {gallery.map(item => (
          <div key={item.id} style={styles.card} onClick={() => setLightbox(item)}>
            {item.media_type === 'video'
              ? <video src={item.cloudinary_url} style={styles.thumb} />
              : <img src={item.cloudinary_url} alt={item.caption} style={styles.thumb} />
            }
            <div style={styles.overlay}>
              <div style={styles.captionOverlay}>{item.caption}</div>
              <div style={styles.dateOverlay}>{item.activity_date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={styles.lightboxBg} onClick={() => setLightbox(null)}>
          <div style={styles.lightboxBox} onClick={e => e.stopPropagation()}>
            {lightbox.media_type === 'video'
              ? <video src={lightbox.cloudinary_url} style={styles.lightboxMedia} controls autoPlay />
              : <img src={lightbox.cloudinary_url} alt={lightbox.caption} style={styles.lightboxMedia} />
            }
            <div style={styles.lightboxCaption}>{lightbox.caption}</div>
            <div style={styles.lightboxMeta}>
              {lightbox.children?.full_name} · {lightbox.activity_date}
            </div>
            <button style={styles.closeBtn} onClick={() => setLightbox(null)}>✕ Tutup</button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page:           { padding:'2rem' },
  title:          { fontSize:'1.5rem', fontWeight:700, marginBottom:'1.5rem' },
  grid:           { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' },
  card:           { position:'relative', borderRadius:'var(--radius-md)', overflow:'hidden',
                    cursor:'pointer', aspectRatio:'1', border:'1px solid var(--border)' },
  thumb:          { width:'100%', height:'100%', objectFit:'cover', display:'block',
                    transition:'transform 0.3s' },
  overlay:        { position:'absolute', bottom:0, left:0, right:0,
                    background:'linear-gradient(transparent,rgba(0,0,0,0.7))',
                    padding:'0.75rem', opacity:0, transition:'opacity 0.2s' },
  captionOverlay: { color:'#fff', fontSize:'0.85rem', fontWeight:500 },
  dateOverlay:    { color:'rgba(255,255,255,0.7)', fontSize:'0.75rem', marginTop:'0.2rem' },
  lightboxBg:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
                    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  lightboxBox:    { background:'var(--surface)', borderRadius:'var(--radius-lg)',
                    padding:'1.5rem', maxWidth:'90vw', maxHeight:'90vh',
                    display:'flex', flexDirection:'column', gap:'0.75rem' },
  lightboxMedia:  { maxWidth:'70vw', maxHeight:'60vh', borderRadius:'var(--radius-md)',
                    objectFit:'contain' },
  lightboxCaption:{ fontWeight:600 },
  lightboxMeta:   { color:'var(--text-muted)', fontSize:'0.85rem' },
  closeBtn:       { background:'var(--danger)', color:'#fff', border:'none',
                    borderRadius:'var(--radius-sm)', padding:'0.5rem 1rem', cursor:'pointer' },
}
```

---

## Verifikasi Modul-04

| Test | Expected |
|------|----------|
| Caregiver upload foto JPG | File muncul di Cloudinary dashboard & gallery DB |
| Caregiver upload video MP4 | Berhasil, thumbnail muncul di grid |
| Upload file > 50 MB | Error 400 |
| Parent buka `/parent/gallery` | Hanya lihat foto anaknya sendiri |
| Klik foto di galeri parent | Lightbox terbuka |
| Caregiver hapus foto | Terhapus dari Cloudinary & DB |
