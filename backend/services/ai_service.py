from core.groq_ai import get_groq_client
from core.config import settings
from supabase import create_client

sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# ── Feature B: Sentiment Analysis ────────────────────────────────────────────
async def analyze_sentiment(log_id: str, text: str):
    """
    Kirim teks ke Gemini, dapatkan label + skor sentimen,
    lalu update tabel daily_logs.
    Dipanggil sebagai BackgroundTask setelah daily log tersimpan.
    """
    prompt = f"""Kamu adalah analis emosi anak di daycare.
Analisis teks berikut dari perspektif kondisi emosi anak.
Klasifikasikan ke salah satu: positif, netral, atau negatif.
Berikan juga skor keyakinan antara 0.0 hingga 1.0.

Teks: "{text}"

Jawab HANYA dalam format JSON berikut (tanpa teks lain):
{{"label": "positif|netral|negatif", "score": 0.0}}"""

    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_completion_tokens=100
        )
        reply = response.choices[0].message.content or ""
        import json, re
        json_match = re.search(r'\{.*?\}', reply, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            sb.table("daily_logs").update({
                "sentiment_label": result.get("label", "netral"),
                "sentiment_score": result.get("score", 0.5)
            }).eq("id", log_id).execute()
    except Exception as e:
        print(f"[Sentiment Error] log_id={log_id}: {e}")

# ── Feature C: AI Daily Summary ───────────────────────────────────────────────
async def generate_daily_summary(child_id: str, log_date: str):
    """
    Dipanggil saat checkout. Baca daily_log hari ini,
    minta Gemini buat cerita hangat, simpan ke ai_daily_summary.
    """
    log_res = sb.table("daily_logs").select("*, children(full_name)") \
        .eq("child_id", child_id).eq("log_date", log_date).single().execute()
    if not log_res.data:
        return

    log = log_res.data
    if not isinstance(log, dict):
        return
        
    children_data = log.get("children")
    child_dict = children_data if isinstance(children_data, dict) else {}
    child_name = child_dict.get("full_name", "Si kecil")
    meal_map = {"habis": "menghabiskan", "setengah": "hanya setengah", "tidak_makan": "tidak makan"}
    mood_map = {"ceria": "sangat ceria", "biasa": "baik-baik saja", "rewel": "sedikit rewel", "menangis": "cukup banyak menangis"}

    meal_morning = str(log.get('meal_morning') or '')
    meal_lunch = str(log.get('meal_lunch') or '')
    meal_snack = str(log.get('meal_snack') or '')
    mood_val = str(log.get('mood') or '')
    
    act_data = log.get('activities')
    activities_list = act_data if isinstance(act_data, list) else ['bermain']

    prompt = f"""Buatkan satu paragraf cerita yang HANGAT, PERSONAL, dan MENYENANGKAN
dalam Bahasa Indonesia untuk orang tua tentang hari ini {child_name} di daycare.

Data hari ini:
- Makan pagi: {meal_map.get(meal_morning, 'tidak tercatat')}
- Makan siang: {meal_map.get(meal_lunch, 'tidak tercatat')}
- Snack: {meal_map.get(meal_snack, 'tidak tercatat')}
- Tidur siang: {log.get('sleep_duration_min', 0)} menit ({str(log.get('sleep_quality') or '')})
- Mood: {mood_map.get(mood_val, 'tidak tercatat')}
- Aktivitas: {', '.join(str(a) for a in activities_list)}
- Catatan pengasuh: {str(log.get('special_notes') or 'tidak ada catatan khusus')}

Gunakan nama {child_name}. Tulis dengan hangat, seperti surat singkat dari pengasuh.
Panjang: 3–4 kalimat. Jangan gunakan bullet point."""

    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_completion_tokens=300
        )
        reply = response.choices[0].message.content or ""
        from datetime import datetime, timezone
        sb.table("daily_logs").update({
            "ai_daily_summary": reply.strip(),
            "summary_generated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", log["id"]).execute()
    except Exception as e:
        print(f"[Summary Error] child_id={child_id}: {e}")
