import cloudinary
import cloudinary.uploader
from core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

def upload_media(file_bytes: bytes, filename: str) -> dict:
    """
    Upload foto ke Cloudinary.
    Hanya menerima tipe gambar sesuai kesepakatan.
    Return: {"url": ..., "public_id": ...}
    """
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="anaku/gallery",
        public_id=filename,
        resource_type="image",
        overwrite=False,
        transformation=[{"quality": "auto", "fetch_format": "auto"}]
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}

def delete_media(public_id: str) -> bool:
    """Hapus foto dari Cloudinary berdasarkan public_id"""
    result = cloudinary.uploader.destroy(public_id, resource_type="image")
    return result.get("result") == "ok"
