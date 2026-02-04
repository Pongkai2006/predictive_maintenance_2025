"""
Clear Firebase Realtime Database
This script deletes data from Firebase. By default, it clears /sensor.
It can also clear the entire database with --all.

Usage:
  python clear_database.py              # Interactive mode (clears /sensor)
  python clear_database.py --force      # Skip confirmation
  python clear_database.py --all        # Clear EVERYTHING (root)
  python clear_database.py --force --all
"""

import argparse
import sys
from firebase_admin import credentials, initialize_app, db

def init_firebase():
    """Initialize Firebase connection"""
    try:
        cred = credentials.Certificate("firebase_key.json")
        initialize_app(cred, {
            "databaseURL": "https://cloud-esp32-567c6-default-rtdb.asia-southeast1.firebasedatabase.app/"
        })
        print("✅ Connected to Firebase\n")
    except ValueError as e:
        # App might already be initialized if running in some environments, though unlikely here
        print(f"ℹ️  Firebase might already be initialized: {e}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        sys.exit(1)

def clear_path(path, description):
    """Clear a specific path in the database"""
    try:
        ref = db.reference(path)
        ref.delete()
        print(f"✅ Cleared {path} ({description})")
    except Exception as e:
        print(f"⚠️  Error clearing {path}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Clear Firebase Realtime Database")
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--all", action="store_true", help="Clear the ENTIRE database (root /)")
    
    args = parser.parse_args()
    
    print("🗑️  Firebase Database Cleanup Tool\n")
    init_firebase()

    # Determine what to clear
    paths_to_clear = []
    
    if args.all:
        paths_to_clear.append(("/", "ENTIRE DATABASE"))
        warning_msg = "⚠️  WARNING: This will DELETE ALMOST EVERYTHING in the database (root /)!"
    else:
        paths_to_clear.append(("/sensor/raw", "all sensor readings"))
        paths_to_clear.append(("/sensor/status", "AI predictions"))
        warning_msg = "⚠️  WARNING: This will DELETE all data from /sensor/raw and /sensor/status."

    # Confirmation
    if not args.force:
        print(warning_msg)
        if args.all:
            print("   (This includes all sensor data, status, and any other nodes)")
        print()
        
        confirm = input("Type 'YES' to confirm deletion: ")
        if confirm != "YES":
            print("\n❌ Cancelled - No data deleted")
            sys.exit(0)
    else:
        print("⚡ Force mode active - skipping confirmation")

    print("\n🗑️  Clearing database...\n")
    
    for path, desc in paths_to_clear:
        clear_path(path, desc)

    print("\n✅ Database cleanup completed!")
    print("\nYou can now:")
    print("1. Restart test_integration.py to generate fresh data")
    print("2. Or wait for ESP32 to send new sensor data")

if __name__ == "__main__":
    main()
