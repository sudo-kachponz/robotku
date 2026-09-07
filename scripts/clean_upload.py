#!/usr/bin/env python3
import os
import sys
import ftplib
import time

FTP_HOST = "ftp.robotku.id"
FTP_USER = "u294386579.robotkuHUB"
FTP_PASS = "V1d=tqPKuDA"

def get_ftp():
    ftp = ftplib.FTP(FTP_HOST, timeout=60)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    return ftp

def main():
    print("→ Connecting to Hostinger FTP (hub.robotku.id)...")
    sys.stdout.flush()
    ftp = get_ftp()

    # Step 1: Pre-create directories
    print("→ Checking & creating remote directories...")
    sys.stdout.flush()
    for root, dirs, files in os.walk("out"):
        rel = os.path.relpath(root, "out")
        if rel != ".":
            r_path = rel.replace("\\", "/")
            try:
                ftp.mkd(r_path)
                print(f"  + Folder: {r_path}")
                sys.stdout.flush()
            except Exception:
                pass

    print("→ Uploading build files...")
    sys.stdout.flush()
    
    count = 0
    total_bytes = 0

    for root, dirs, files in os.walk("out"):
        rel = os.path.relpath(root, "out")
        r_dir = "" if rel == "." else rel.replace("\\", "/")

        for f in files:
            local_path = os.path.join(root, f)
            remote_path = f if not r_dir else f"{r_dir}/{f}"
            size = os.path.getsize(local_path)
            
            count += 1
            print(f"[{count}] {remote_path} ({size:,} B)... ", end="", flush=True)

            uploaded = False
            for attempt in range(3):
                try:
                    # Clean lock if exists
                    lock_name = f".in.{f}." if not r_dir else f"{r_dir}/.in.{f}."
                    try: ftp.delete(lock_name)
                    except Exception: pass

                    with open(local_path, "rb") as fp:
                        ftp.storbinary(f"STOR {remote_path}", fp)
                    uploaded = True
                    print("✓")
                    sys.stdout.flush()
                    break
                except Exception as err:
                    print(f"\n   Retry #{attempt+1} after error: {err}")
                    sys.stdout.flush()
                    time.sleep(1)
                    try: ftp.quit()
                    except Exception: pass
                    ftp = get_ftp()

            if uploaded:
                total_bytes += size

    try: ftp.quit()
    except Exception: pass
    print(f"\n🎉 SUCCESS! Fully deployed {count} files ({total_bytes/(1024*1024):.2f} MB) to https://hub.robotku.id")

if __name__ == "__main__":
    main()
