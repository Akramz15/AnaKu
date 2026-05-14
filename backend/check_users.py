import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL") or ""
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
supabase = create_client(url, key)

res = supabase.table("users").select("*").execute()
data_list = res.data if isinstance(res.data, list) else []

print(f"Total users in public.users: {len(data_list)}")
if data_list and isinstance(data_list[0], dict):
    print("Columns in public.users:", data_list[0].keys())

for user in data_list[:3]:
    print(user)
