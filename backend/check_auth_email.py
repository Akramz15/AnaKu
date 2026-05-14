import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL") or ""
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
sb = create_client(url, key)

# Get the first active user's id from check_users output:
uid = "03fa5aaa-7c1e-4e8d-829a-ec8492fb7c08" # user from previous command output

print(f"Testing get_user_by_id for ID: {uid}")
try:
    u_auth = sb.auth.admin.get_user_by_id(uid)
    print("Result returned:", type(u_auth))
    print("Attributes:", dir(u_auth))
    if hasattr(u_auth, "user") and u_auth.user:
        print("User object attributes:", dir(u_auth.user))
        print("Email found:", u_auth.user.email)
    else:
        # Check if dictionary
        print("Raw value:", u_auth)
except Exception as e:
    print("ERROR IN SDK:", e)
