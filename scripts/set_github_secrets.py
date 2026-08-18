#!/usr/bin/env python3
"""
GitHub Repository Secrets Sync Tool for kya-service

Reads local secret values from a git-ignored `.env.secrets` file or OS Keychain
and uploads them directly to GitHub Repository Secrets using the `gh` CLI.

Usage:
    1. Create a local `.env.secrets` file in project root (git-ignored).
    2. Add secret key=value pairs:
       OCI_USER_OCID=ocid1.user.oc1...
       OCI_TENANCY_OCID=ocid1.tenancy.oc1...
       OCI_TENANCY_NAMESPACE=ax8z9x21
       OCIR_USERNAME=ax8z9x21/oracle_user
       OCIR_AUTH_TOKEN=aX9#...
       OCIR_REGION_ENDPOINT=iad.ocir.io
       DUCKDNS_SUBDOMAIN=kya-service
       DUCKDNS_TOKEN=12345678-abcd-...
       SUPABASE_URL=https://your-project.supabase.co
       SUPABASE_KEY=eyJhbGciOiJIUzI1Ni...
    3. Run:
       python scripts/set_github_secrets.py
"""

import os
import sys
import subprocess
import shutil

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

REQUIRED_SECRETS = [
    "OCI_USER_OCID",
    "OCI_TENANCY_OCID",
    "OCI_TENANCY_NAMESPACE",
    "OCIR_USERNAME",
    "OCIR_AUTH_TOKEN",
    "OCIR_REGION_ENDPOINT",
    "DUCKDNS_SUBDOMAIN",
    "DUCKDNS_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "KYA_TREASURY_ADDRESS",
    "ESCROW_ADDRESS"
]

def load_env_file(filepath):
    secrets = {}
    if not os.path.exists(filepath):
        return secrets
    
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                secrets[key.strip()] = value.strip().strip('"').strip("'")
    return secrets

def main():
    if not shutil.which("gh"):
        print("❌ Error: GitHub CLI ('gh') is not installed or not in PATH.", file=sys.stderr)
        print("Please install gh CLI: https://cli.github.com/ or run 'brew install gh' / 'winget install GitHub.cli'", file=sys.stderr)
        sys.exit(1)

    # Check gh auth status
    res = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
    if res.returncode != 0:
        print("❌ Error: gh CLI is not authenticated. Please run 'gh auth login' first.", file=sys.stderr)
        sys.exit(1)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    env_secrets_path = os.path.join(project_root, ".env.secrets")

    secrets = load_env_file(env_secrets_path)

    print("🔑 Syncing GitHub Repository Secrets via gh CLI...\n")

    for key in REQUIRED_SECRETS:
        val = secrets.get(key) or os.environ.get(key)
        if not val:
            print(f"⚠️  Missing value for {key}")
            user_val = input(f"   Enter value for {key} (or press Enter to skip): ").strip()
            if user_val:
                val = user_val

        if val:
            cmd = ["gh", "secret", "set", key, "-b", val]
            set_res = subprocess.run(cmd, capture_output=True, text=True)
            if set_res.returncode == 0:
                print(f"  ✓ Set secret: {key}")
            else:
                print(f"  ❌ Failed to set {key}: {set_res.stderr.strip()}")
        else:
            print(f"  ⏭ Skipped: {key} (no value provided)")

    print("\n✅ GitHub Secrets sync completed!")

if __name__ == "__main__":
    main()
