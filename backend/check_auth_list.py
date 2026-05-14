import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("SUPABASE_URL") or ""
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
sb = create_client(url, key)

try:
    users_res = sb.auth.admin.list_users()
    print("List users successful! Count:", len(users_res))
    if users_res:
        first_user = users_res[0]
        print("First user attributes:", dir(first_user))
        print("ID:", first_user.id)
        print("Email:", first_user.email)
except Exception as e:
    print("Error listing users:", e)
