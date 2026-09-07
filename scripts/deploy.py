#!/usr/bin/env python3
import os
import sys
import subprocess
from concurrent.futures import ThreadPoolExecutor

FTP_HOST = os.environ.get("FTP_HOST", "ftp.robotku.id")
FTP_USER = os.environ.get("FTP_USER", "u294386579.robotkuHUB")
FTP_PASS = os.environ.get("FTP_PASS", "V1d=tqPKuDA")

def upload_file(args):
    rel_path, local_path, idx, total = args
    remote_url = f"ftp://{FTP_HOST}/{rel_path}"
    
    cmd = [
        "curl",
        "-s",
        "--fail",
        "--disable-epsv",
        "--ftp-create-dirs",
        "-u", f"{FTP_USER}:{FTP_PASS}",
        "-T", local_path,
        remote_url
    ]
    
    for attempt in range(1, 4):
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"[{idx}/{total}] ✅ {rel_path}")
            sys.stdout.flush()
            return True
        else:
            if attempt < 3:
                print(f"[{idx}/{total}] ⚠️ Retrying {rel_path} (Attempt {attempt+1})...")
                sys.stdout.flush()
    
    print(f"[{idx}/{total}] ❌ Failed: {rel_path} - {res.stderr.strip()}")
    sys.stdout.flush()
    return False

def main():
    out_dir = os.path.abspath("out")
    if not os.path.exists(out_dir):
        print("Error: out/ missing. Run npm run build first.", file=sys.stderr)
        sys.exit(1)

    all_files = []
    for root, dirs, files in os.walk(out_dir):
        rel_dir = os.path.relpath(root, out_dir)
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.normpath(os.path.join(rel_dir, f)).replace("\\", "/")
            if rel_path.startswith("./"):
                rel_path = rel_path[2:]
            all_files.append((rel_path, local_path))

    total = len(all_files)
    print(f"🚀 Deploying {total} files to https://hub.robotku.id via cURL...\n")
    sys.stdout.flush()

    tasks = [(rel_path, local_path, i+1, total) for i, (rel_path, local_path) in enumerate(all_files)]

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(upload_file, tasks))

    success_count = sum(1 for r in results if r)
    print(f"\n🎉 Selesai! Berhasil mengunggah {success_count}/{total} file.")
    print("✅ Subdomain live di: https://hub.robotku.id")

if __name__ == "__main__":
    main()




