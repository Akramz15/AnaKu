import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("users").select("*").execute()
print(f"Total users in public.users: {len(res.data)}")
for user in res.data:
    print(f"ID: {user['id']}, Role: {user['role']}, Name: {user['full_name']}")
