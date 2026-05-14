import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("SUPABASE_URL") or ""
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
sb = create_client(url, key)

try:
    # Fetch one row from galleries to inspect keys
    res = sb.table("galleries").select("*").limit(1).execute()
    if res.data and len(res.data) > 0:
        first_row = res.data[0]
        if isinstance(first_row, dict):
            print("Found columns via data:", first_row.keys())
        else:
            print("Data format is unexpected:", type(first_row))
    else:
        # If empty, try a dummy insert to get the schema keys or look at the error message
        print("Galleries table is empty! Checking schema metadata if possible...")
        # We can also use RPC if we have one, or just try to insert an empty dict to trigger a key dump
        try:
            sb.table("galleries").insert({}).execute()
        except Exception as e:
            print("Insert trigger result:", e)
except Exception as e:
    print("Error checking galleries:", e)
