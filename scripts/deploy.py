#!/usr/bin/env python3
import os
import sys
import subprocess
import time

FTP_HOST = os.environ.get("FTP_HOST", "ftp.robotku.id")
FTP_USER = os.environ.get("FTP_USER", "u294386579.robotkuHUB")
FTP_PASS = os.environ.get("FTP_PASS", "V1d=tqPKuDA")

def run_curl(args):
    cmd = [
        "curl",
        "-s",
        "--fail",
        "--connect-timeout", "15",
        "--max-time", "60",
        "--disable-epsv",
        "-u", f"{FTP_USER}:{FTP_PASS}",
    ] + args
    return subprocess.run(cmd, capture_output=True, text=True)

def main():
    out_dir = os.path.abspath("out")
    if not os.path.exists(out_dir):
        print("Error: out/ missing. Run npm run build first.", file=sys.stderr)
        sys.exit(1)

    print(f"🚀 Deploying out/ to https://hub.robotku.id (FTP: {FTP_HOST})...\n")

    all_dirs = set()
    all_files = []

    for root, dirs, files in os.walk(out_dir):
        rel_dir = os.path.relpath(root, out_dir)
        if rel_dir != ".":
            norm_dir = rel_dir.replace("\\", "/")
            all_dirs.add(norm_dir)
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.normpath(os.path.join(rel_dir, f)).replace("\\", "/")
            if rel_path.startswith("./"):
                rel_path = rel_path[2:]
            all_files.append((rel_path, local_path, f, rel_dir))

    sorted_dirs = sorted(list(all_dirs), key=lambda d: (d.count("/"), d))

    print(f"📁 Pre-creating {len(sorted_dirs)} remote directories...")
    for d in sorted_dirs:
        run_curl(["-Q", f"-MKD {d}", f"ftp://{FTP_HOST}/"])

    total = len(all_files)
    print(f"📦 Uploading {total} files...\n")
    sys.stdout.flush()

    success_count = 0
    fail_count = 0

    for idx, (rel_path, local_path, filename, rel_dir) in enumerate(all_files, start=1):
        remote_url = f"ftp://{FTP_HOST}/{rel_path}"
        dir_part = "" if rel_dir == "." else rel_dir.replace("\\", "/")
        lock_file = f"{dir_part}/.in.{filename}." if dir_part else f".in.{filename}."

        args = [
            "-Q", f"-DELE {lock_file}",
            "-T", local_path,
            remote_url
        ]

        uploaded = False
        err_msg = ""
        for attempt in range(1, 4):
            res = run_curl(args)
            if res.returncode == 0:
                uploaded = True
                break
            else:
                err_msg = res.stderr.strip() or f"exit code {res.returncode}"
                if attempt < 3:
                    time.sleep(1)

        if uploaded:
            success_count += 1
            print(f"[{idx}/{total}] ✅ {rel_path}")
        else:
            fail_count += 1
            print(f"[{idx}/{total}] ❌ {rel_path} ({err_msg})")
        sys.stdout.flush()

    print(f"\n🎉 Deployment completed: {success_count}/{total} files uploaded successfully.")
    if fail_count > 0:
        print(f"⚠️ {fail_count} files failed to upload.")
        sys.exit(1)
    else:
        print("✅ Live URL: https://hub.robotku.id")

if __name__ == "__main__":
    main()




