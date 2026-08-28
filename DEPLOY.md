# KYA Service — Deployment Guide (Oracle Cloud Infrastructure & Docker)

**KYA (Know Your Agent)** — Trust Infrastructure for AI Agents — Verifiable Evidence & Risk Signals on Algorand.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [OCI Setup](#oci-setup)
4. [Deploying the Container](#deploying-the-container)
5. [DNS & TLS Setup](#dns--tls-setup)
6. [Reverse Proxy Configuration](#reverse-proxy-configuration)
7. [OCI Functions (Edge) Deployment](#oci-functions-edge-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Quick Reference](#quick-reference)

---

## Architecture Overview

```
                      Internet
                          │
                    [Cloudflare / WAF]
                          │
                    [OCI Load Balancer]
                          │
              [Reverse Proxy (nginx / Caddy)]
             (TLS termination, security headers)
                          │
                    [KYA Hono Container]
                    (port 3000, internal only)
                          │
         ┌────────────────┼────────────────┐
         │                │                │
   [Supabase]       [Algorand]       [OFAC/Watchlist
 (Auth & Storage)  (Algod/Indexer)      Sources Disk]
```

The KYA service runs as a containerized Hono HTTP application behind a reverse proxy with TLS termination. Deployment options include:

- **Docker Compose / Container Instance** — Recommended standard container deployment
- **OCI Functions (Fn Project)** — Serverless edge deployment

---

## Prerequisites

### OCI Account & Access

1. **OCI Compartment** — Create a compartment named `kya-service` (or preferred name).
2. **OCI CLI** — Install and configure:
   ```bash
   pip install oci-cli
   oci setup setup
   ```
3. Ensure OCI CLI profile has permission for Compute, Networking, Object Storage, and DNS.

### Domain Name & Hostname

Set up an A record or CNAME pointing to your server/load balancer:
```
kya.yourdomain.com  →  <your-oci-ip-or-dns>
```

---

## OCI Setup

### 1. Create VCN and Networking

```bash
# Create Virtual Cloud Network (VCN)
oci network vcn create \
  --display-name "kya-vcn" \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --cidr-block "10.0.0.0/16" \
  --dns-label "kyanvasn" \
  --domain-name "kya-vcn.oraclevcn.com"

# Note the returned VCN OCID
VCN_ID="<output_vcn_ocid>"

# Create Public Subnet
oci network subnet create \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --display-name "kya-public-subnet" \
  --vcn-id "$VCN_ID" \
  --cidr-block "10.0.0.0/24" \
  --route-table-id "default" \
  --dhcp-options-id "default"
```

### 2. Configure OCIR Container Registry

```bash
TENANCY_ID=$(oci iam region-subscription list --all --query 'data[0].regionInfo[0].tenantId' --raw-output)
REGION="us-ashburn-1"

oci artifacts container-registry namespace create \
  --compartment-id "$TENANCY_ID" \
  --display-name "kya"
```

---

## Deploying the Container

### 1. Build and Push Docker Image

```bash
# Build production image
docker build -t kya-service:latest .

# Tag for OCIR
OCIR_ENDPOINT="iad.ocir.io"  # Adjust for your region
IMAGE_TAG="$OCIR_ENDPOINT/<your-namespace>/kya-service:latest"
docker tag kya-service:latest "$IMAGE_TAG"

# Login and push
docker login "$OCIR_ENDPOINT"
docker push "$IMAGE_TAG"
```

### 2. Create OCI Container Instance

```bash
oci compute container-instance create \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --display-name "kya-container" \
  --shape "VM.Standard.E4.Flex" \
  --ocpu-count 1 \
  --memory-in-gbs 2 \
  --container-repository-credentials "{\"username\":\"<OCIR_USERNAME>\",\"password\":\"<OCIR_PASSWORD>\"}" \
  --containers [
    {
      "name": "kya",
      "image": "$IMAGE_TAG",
      "portMappings": [
        {"containerPort": 3000, "protocol": "TCP"}
      ],
      "environment": {
        "PORT": "3000",
        "NODE_ENV": "production",
        "SUPABASE_URL": "<your-supabase-url>",
        "SUPABASE_SERVICE_ROLE_KEY": "<your-service-role-key>",
        "KYA_PRIVATE_KEY": "<your-ed25519-private-key-pem>",
        "ALGORAND_NETWORK_URL": "https://mainnet-api.algonode.cloud",
        "ALGORAND_INDEXER_URL": "https://mainnet-indexer.algonode.cloud",
        "X402_PRICE_MICROALGO": "1000",
        "KYA_TREASURY_ADDRESS": "<your-treasury-address>"
      }
    }
  ] \
  --vcn-id "$VCN_ID" \
  --subnet-id <YOUR_SUBNET_OCID> \
  --assign-public-ip true
```

---

## Reverse Proxy Configuration

### Nginx

Copy `nginx.conf` to `/etc/nginx/nginx.conf` and update your hostname and TLS certificate paths:

```bash
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl restart nginx
```

### Caddy Alternative

Use the provided `Caddyfile` for automated Let's Encrypt TLS management:

```caddy
kya-service.duckdns.org {
    reverse_proxy localhost:3000
}
```

---

## Monitoring & Maintenance

### Health Checks

Un-gated health endpoints respond immediately:

```bash
# Direct HTTP
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/health

# Via Reverse Proxy
curl https://kya.yourdomain.com/health
```

Expected output:
```json
{"status":"ok","timestamp":"2026-08-12T00:00:00.000Z"}
```

### Watchlist Refresh

Trigger manual sanctions list refresh:

```bash
curl -X POST https://kya.yourdomain.com/api/v1/watchlist/refresh \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

---

## Troubleshooting

### Container Health Check Fails
- Verify port 3000 is open internally.
- Inspect container startup logs for initialization errors.
- Confirm environment variables (`KYA_TREASURY_ADDRESS`, `ALGORAND_NETWORK_URL`) are populated.

### TLS / Reverse Proxy Issues
- Verify `/health` is excluded from payment middleware and proxied correctly.
- Check certificate expiration with `openssl x509 -in /etc/nginx/certs/fullchain.pem -text -noout`.

---

## Quick Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server listening port |
| `NODE_ENV` | No | `development` | Environment mode (`production`, `development`, `test`) |
| `SUPABASE_URL` | No | — | Supabase URL (falls back to in-memory mode if omitted) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | — | Supabase service key |
| `KYA_PRIVATE_KEY` | No | — | Ed25519 private key for claims & VC passports (generates ephemeral key if omitted) |
| `KYA_KEY_ID` | No | `default-key` | Key identifier string |
| `ALGORAND_NETWORK_URL` | No | `https://testnet-api.algonode.cloud` | Algod RPC endpoint |
| `ALGORAND_INDEXER_URL` | No | `https://testnet-indexer.algonode.cloud` | Algorand Indexer endpoint |
| `X402_PRICE_MICROALGO` | No | `1000` | Base price in microALGOs per request |
| `KYA_TREASURY_ADDRESS` | No | — | Algorand receiver wallet for micro-payments |

---

## License

AGPL-3.0 — See [LICENSE](LICENSE) file for full text.
