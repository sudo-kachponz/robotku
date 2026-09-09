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
    ftp.connect(host_ip, 21, timeout=20)
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

def upload_single_file(host_ip, rel_path, local_path, rel_dir, filename):
    for attempt in range(1, 4):
        ftp = None
        try:
            ftp = create_ftp_client(host_ip)
            ensure_remote_dirs(ftp, rel_dir)
            
            # Remove any stale Pure-FTPd upload lock file
            lock_name = f"{rel_dir}/.in.{filename}." if rel_dir and rel_dir != "." else f".in.{filename}."
            try:
                ftp.delete(lock_name)
            except Exception:
                pass

            remote_path = rel_path.replace("\\", "/")
            with open(local_path, "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f, blocksize=65536)
            
            try:
                ftp.quit()
            except Exception:
                ftp.close()
            return (True, rel_path, None)
        except Exception as e:
            if ftp:
                try:
                    ftp.close()
                except Exception:
                    pass
            if attempt == 3:
                return (False, rel_path, str(e))
            time.sleep(1)
    return (False, rel_path, "Max retries exceeded")

def main():
    out_dir = os.path.abspath("out")
    if not os.path.exists(out_dir):
        print("Error: out/ missing. Run npm run build first.", file=sys.stderr)
        sys.exit(1)

    host_ip = get_ipv4_host(FTP_HOST)
    print(f"🚀 Deploying out/ to https://hub.robotku.id (FTP: {FTP_HOST} [{host_ip}])...")

    # Verify connection & pre-create all directories sequentially first
    print("📁 Pre-creating directory tree...")
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

    init_ftp = create_ftp_client(host_ip)
    # Sort dirs by depth so parent is created before child
    for d in sorted(all_dirs, key=lambda x: (x.count("/"), x)):
        try:
            init_ftp.mkd(d)
        except Exception:
            pass
    init_ftp.quit()

    total = len(all_files)
    print(f"📦 Uploading {total} files using 6 concurrent workers...\n")
    sys.stdout.flush()

    success_count = 0
    fail_count = 0
    done_count = 0

    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_file = {
            executor.submit(upload_single_file, host_ip, rel_path, local_path, rel_dir, filename): rel_path
            for (rel_path, local_path, rel_dir, filename) in all_files
        }

        for future in as_completed(future_to_file):
            ok, rpath, err = future.result()
            done_count += 1
            if ok:
                success_count += 1
                print(f"[{done_count}/{total}] ✅ {rpath}")
            else:
                fail_count += 1
                print(f"[{done_count}/{total}] ❌ {rpath} ({err})")
            sys.stdout.flush()

    print(f"\n🎉 Deployment completed: {success_count}/{total} files uploaded successfully.")
    if fail_count > 0:
        print(f"⚠️ {fail_count} files failed to upload.")
        sys.exit(1)
    else:
        print("✅ Live URL: https://hub.robotku.id")

if __name__ == "__main__":
    main()





