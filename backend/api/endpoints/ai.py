from fastapi import APIRouter, Depends
from api.deps import get_current_user, require_role
from schemas.ai import ChatbotRequest
from core.groq_ai import get_groq_client, SYSTEM_PROMPT
from supabase import create_client
from core.config import settings
from datetime import date

router = APIRouter()
sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def build_log_context(log: dict, child_name: str) -> str:
    """Ubah raw daily_log dict menjadi teks konteks yang bisa dimengerti Gemini"""
    meal_map  = {"habis":"menghabiskan porsinya", "setengah":"hanya makan setengah porsi", "tidak_makan":"tidak makan"}
    sleep_map = {"nyenyak":"tidur dengan nyenyak", "gelisah":"tidur tapi gelisah", "tidak_tidur":"tidak tidur siang"}
    mood_map  = {"ceria":"sangat ceria dan aktif", "biasa":"dalam kondisi normal", "rewel":"sedikit rewel", "menangis":"banyak menangis"}

    ctx = f"""=== DATA LOG HARIAN {child_name} ({log.get('log_date','')}) ===
Makan Pagi   : {meal_map.get(log.get('meal_morning',''), 'tidak tercatat')}
Makan Siang  : {meal_map.get(log.get('meal_lunch',''), 'tidak tercatat')}
Snack        : {meal_map.get(log.get('meal_snack',''), 'tidak tercatat')}
Tidur Siang  : {log.get('sleep_duration_min', 0)} menit — {sleep_map.get(log.get('sleep_quality',''), 'tidak tercatat')}
Mood         : {child_name} {mood_map.get(log.get('mood',''), 'tidak tercatat')}
Aktivitas    : {', '.join(log.get('activities') or ['tidak tercatat'])}
Catatan      : {log.get('special_notes') or 'Tidak ada catatan khusus'}
Kesehatan    : {log.get('health_notes') or 'Normal'}
Sentimen     : {log.get('sentiment_label','belum dianalisis')} (skor: {log.get('sentiment_score', '-')})
Cerita AI    : {log.get('ai_daily_summary') or 'Belum tersedia (anak belum checkout)'}
=== AKHIR DATA ==="""
    return ctx

@router.post("/chat", dependencies=[Depends(require_role("parent"))])
async def ai_chatbot(payload: ChatbotRequest, current_user = Depends(get_current_user)):
    """
    Feature A: AI Chatbot untuk orang tua.
    1. Ambil data log harian anak sebagai konteks.
    2. Ambil riwayat percakapan dari DB (max 10 pesan terakhir).
    3. Kirim ke Gemini dengan konteks log.
    4. Simpan pesan user & respons AI ke chats_ai.
    """
    # 0. Validasi jika child_id belum dipilih/kosong
    if not payload.child_id or str(payload.child_id).strip() == "" or str(payload.child_id) == "null" or str(payload.child_id) == "undefined":
        return {"status": "success", "data": {"reply": "Maaf, Anda belum memilih atau belum mendaftarkan anak. Silakan daftarkan anak Anda terlebih dahulu agar AI bisa membantu memantau perkembangannya."}}

    target_date = payload.log_date or date.today().isoformat()

    # 1. Ambil data anak
    child_res = sb.table("children").select("full_name, parent_id") \
        .eq("id", payload.child_id).single().execute()
    child_data = child_res.data
    if not isinstance(child_data, dict) or child_data.get("parent_id") != current_user["id"]:
        return {"status": "success", "data": {"reply": "Maaf, Anda belum memilih atau belum mendaftarkan anak. Silakan daftarkan anak Anda terlebih dahulu agar AI bisa membantu memantau perkembangannya."}}
    child_name = str(child_data.get("full_name") or "Anak")

    # 2. Ambil daily log hari ini
    log_res = sb.table("daily_logs").select("*") \
        .eq("child_id", payload.child_id).eq("log_date", target_date).execute()
    log_data_list = log_res.data
    log_data = log_data_list[0] if isinstance(log_data_list, list) and len(log_data_list) > 0 and isinstance(log_data_list[0], dict) else None
    
    log_context = build_log_context(log_data, child_name) if log_data else \
        f"Belum ada data log untuk {child_name} pada tanggal {target_date}."

    # 3. Ambil riwayat chat AI (10 pesan terakhir) untuk maintain konteks
    history_res = sb.table("chats_ai").select("role, message") \
        .eq("parent_id", current_user["id"]).eq("child_id", payload.child_id) \
        .order("created_at", desc=True).limit(10).execute()
        
    # Format messages array untuk Groq (OpenAI format)
    messages = [{"role": "system", "content": SYSTEM_PROMPT + f"\n\n{log_context}"}]
    
    # Masukkan riwayat (oldest first)
    raw_history = history_res.data if isinstance(history_res.data, list) else []
    for h in reversed(raw_history):
        if not isinstance(h, dict): continue
        role = "assistant" if h.get("role") == "model" else "user"
        messages.append({"role": role, "content": str(h.get("message") or "")})
        
    # Tambahkan pertanyaan baru
    messages.append({"role": "user", "content": payload.message})

    # 4. Panggil API Groq
    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_completion_tokens=1024
        )
        ai_reply = response.choices[0].message.content
    except Exception as e:
        import logging
        logging.error(f"Groq API Error: {str(e)}")
        print(f"[AI ERROR] Groq API Error: {str(e)}")
        return {"status": "success", "data": {"reply": "Maaf, sistem AI sedang sibuk atau mengalami gangguan. Mohon coba lagi beberapa saat."}}

    # 5. Simpan pesan user & AI ke DB
    log_id = log_data.get("id") if log_data else None
    sb.table("chats_ai").insert([
        {"parent_id": current_user["id"], "child_id": payload.child_id,
         "role": "user", "message": payload.message, "context_log_id": log_id},
        {"parent_id": current_user["id"], "child_id": payload.child_id,
         "role": "model", "message": ai_reply, "context_log_id": log_id},
    ]).execute()

    return {"status": "success", "data": {"reply": ai_reply}}

@router.get("/chat/history", dependencies=[Depends(require_role("parent"))])
async def get_chat_history(child_id: str, current_user = Depends(get_current_user)):
    """Ambil riwayat chat AI untuk ditampilkan di frontend"""
    res = sb.table("chats_ai").select("*") \
        .eq("parent_id", current_user["id"]).eq("child_id", child_id) \
        .order("created_at").execute()
    return {"status": "success", "data": res.data}
