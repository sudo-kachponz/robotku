#!/usr/bin/env python3
import os
import sys
import socket
import ftplib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

FTP_HOST = os.environ.get("FTP_HOST", "ftp.robotku.id")
FTP_USER = os.environ.get("FTP_USER", "u294386579.robotkuHUB")
FTP_PASS = os.environ.get("FTP_PASS", "V1d=tqPKuDA")

def get_ipv4_host(hostname):
    try:
        infos = socket.getaddrinfo(hostname, 21, socket.AF_INET)
        if infos:
            return infos[0][4][0]
    except Exception:
        pass
    return hostname

def create_ftp_client(host_ip):
    ftp = ftplib.FTP()
    ftp.connect(host_ip, 21, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    return ftp

def ensure_remote_dirs(ftp, dir_path):
    if not dir_path or dir_path == ".":
        return
    parts = dir_path.replace("\\", "/").strip("/").split("/")
    current = ""
    for part in parts:
        current = f"{current}/{part}" if current else part
        try:
            ftp.mkd(current)
        except Exception:
            pass

def clean_lock_for_file(ftp, rel_dir, filename):
    lock1 = f"{rel_dir}/.in.{filename}." if rel_dir and rel_dir != "." else f".in.{filename}."
    lock2 = f"/{lock1}"
    for lk in (lock1, lock2):
        try:
            ftp.delete(lk)
        except Exception:
            pass

def upload_file_with_ftp(ftp, host_ip, rel_path, local_path, rel_dir, filename):
    remote_path = rel_path.replace("\\", "/")
    
    for attempt in range(1, 4):
        try:
            if ftp is None:
                ftp = create_ftp_client(host_ip)
                ensure_remote_dirs(ftp, rel_dir)
            
            with open(local_path, "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f, blocksize=65536)
            return (True, ftp, None)
        except Exception as e:
            err_str = str(e)
            # Reset FTP connection on any failure
            if ftp:
                try:
                    ftp.close()
                except Exception:
                    pass
                ftp = None
            
            # Open fresh connection on retry and clean locks
            try:
                ftp = create_ftp_client(host_ip)
                ensure_remote_dirs(ftp, rel_dir)
                clean_lock_for_file(ftp, rel_dir, filename)
            except Exception:
                pass
            
            if attempt == 3:
                return (False, ftp, err_str)
            time.sleep(1)
    return (False, ftp, "Max retries exceeded")

def main():
    out_dir = os.path.abspath("out")
    if not os.path.exists(out_dir):
        print("Error: out/ missing. Run npm run build first.", file=sys.stderr)
        sys.exit(1)

    host_ip = get_ipv4_host(FTP_HOST)
    print(f"🚀 Deploying out/ to https://hub.robotku.id (FTP: {FTP_HOST} [{host_ip}])...")

    # Collect files and dirs
    all_files = []
    all_dirs = set()

    for root, dirs, files in os.walk(out_dir):
        rel_dir = os.path.relpath(root, out_dir).replace("\\", "/")
        if rel_dir != ".":
            all_dirs.add(rel_dir)
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.normpath(os.path.join(rel_dir, f)).replace("\\", "/")
            if rel_path.startswith("./"):
                rel_path = rel_path[2:]
            all_files.append((rel_path, local_path, rel_dir, f))

    print("📁 Pre-creating remote directory tree and cleaning stale locks...")
    ftp = create_ftp_client(host_ip)
    for d in sorted(all_dirs, key=lambda x: (x.count("/"), x)):
        try:
            ftp.mkd(d)
        except Exception:
            pass

    # Quick pre-cleanup of any pending locks
    for (rel_path, local_path, rel_dir, f) in all_files:
        clean_lock_for_file(ftp, rel_dir, f)

    total = len(all_files)
    print(f"📦 Uploading {total} files...\n")
    sys.stdout.flush()

    success_count = 0
    fail_count = 0

    for idx, (rel_path, local_path, rel_dir, filename) in enumerate(all_files, start=1):
        # Refresh connection every 30 files to prevent pure-ftpd passive connection stall
        if idx > 1 and idx % 30 == 0 and ftp:
            try:
                ftp.quit()
            except Exception:
                ftp.close()
            ftp = None

        ok, ftp, err = upload_file_with_ftp(ftp, host_ip, rel_path, local_path, rel_dir, filename)
        if ok:
            success_count += 1
            print(f"[{idx}/{total}] ✅ {rel_path}")
        else:
            fail_count += 1
            print(f"[{idx}/{total}] ❌ {rel_path} ({err})")
        sys.stdout.flush()

    if ftp:
        try:
            ftp.quit()
        except Exception:
            ftp.close()

    print(f"\n🎉 Deployment completed: {success_count}/{total} files uploaded successfully.")
    if fail_count > 0:
        print(f"⚠️ {fail_count} files failed to upload.")
        sys.exit(1)
    else:
        print("✅ Live URL: https://hub.robotku.id")

if __name__ == "__main__":
    main()







