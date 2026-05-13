import base64
import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from supabase import create_client
from postgrest.exceptions import APIError

from core.config import settings

# Inisialisasi Security & Admin Client
security = HTTPBearer()
supabase_admin = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# Data Kunci Publik ES256 (P-256) dari JWKS Supabase Project xijxyjdhicfdgzfwrpnw
# Ini digunakan karena Supabase Anda menggunakan algoritma ECC (ES256) untuk JWT signing
def get_supabase_public_key():
    x_b64 = "0OCGMEa2bsrux6PJHZGb86Mq_ouZ_m5b6Y41lB-TXqU"
    y_b64 = "ZPHBXUed7t8H7b4QyRTO2v4S8NN8cyATWNFn3xHx8dU"
    
    def b64_decode(data):
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        return base64.urlsafe_b64decode(data)

    try:
        x_bytes = b64_decode(x_b64)
        y_bytes = b64_decode(y_b64)
        
        public_numbers = ec.EllipticCurvePublicNumbers(
            int.from_bytes(x_bytes, "big"),
            int.from_bytes(y_bytes, "big"),
            ec.SECP256R1()
        )
        return public_numbers.public_key()
    except Exception as e:
        print(f"FAILED TO LOAD PUBLIC KEY: {e}")
        return None

PUBLIC_KEY = get_supabase_public_key()

async def get_auth_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Memvalidasi JWT tanpa mengecek tabel public.users (digunakan untuk registrasi)"""
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        # 1. Validasi Token
        if alg == "ES256" and PUBLIC_KEY:
            payload = jwt.decode(token, PUBLIC_KEY, algorithms=["ES256"], options={"verify_aud": False}, leeway=30)
        else:
            payload = jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False}, leeway=30)

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID tidak ditemukan dalam token")
        
        return {"id": user_id, "email": payload.get("email", "")}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi Anda telah berakhir, silakan login kembali")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Token tidak valid: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"AUTH ERROR (get_auth_user): {str(e)}")
        raise HTTPException(status_code=401, detail="Gagal melakukan autentikasi")


async def get_current_user(auth_user: dict = Depends(get_auth_user)):
    """Middleware untuk memvalidasi JWT Token Supabase (ES256/HS256) dan public.users"""
    user_id = auth_user["id"]
    try:
        # 2. Ambil data profil user dari tabel public.users
        # Gunakan limit(1) alih-alih single() untuk menghindari exception bawaan postgrest jika tidak ditemukan
        result = supabase_admin.table("users").select("*").eq("id", user_id).limit(1).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Profil user tidak ditemukan di database")

        user = result.data[0]
        if not isinstance(user, dict):
            raise HTTPException(status_code=500, detail="Format profil user tidak valid")
            
        role = user.get("role", "parent")
        status = user.get("status", "active")
        
        if role != "admin":
            if status == "pending":
                raise HTTPException(status_code=403, detail="ACCOUNT_PENDING")
            if status == "rejected":
                reason = user.get("rejection_reason") or ""
                raise HTTPException(status_code=403, detail=f"ACCOUNT_REJECTED:{reason}")

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi Anda telah berakhir, silakan login kembali")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Token tidak valid: {str(e)}")
    except APIError as e:
        import traceback
        traceback.print_exc()
        print(f"DB ERROR (get_current_user): {str(e)}")
        # Gagal koneksi ke DB/Supabase bukan berarti sesi berakhir. Kembalikan 503 agar frontend tidak me-logout paksa.
        raise HTTPException(status_code=503, detail="Gagal terhubung ke database profil. Silakan coba sesaat lagi.")
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"SYSTEM ERROR (get_current_user): {str(e)}")
        # Gunakan 500 alih-alih 401 untuk error sistem umum agar frontend tidak auto-logout
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal pada sistem")

def require_role(*roles):
    """Decorator untuk membatasi akses berdasarkan role (admin, caregiver, parent)"""
    async def checker(current_user=Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini."
            )
        return current_user
    return checker
