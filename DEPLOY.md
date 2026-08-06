# KYA Service — Deployment Guide (Oracle Cloud Infrastructure)

**KYA (Know Your Agent)** — Sanctions Screening Microservice for agent identity and compliance.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [OCI Setup](#oci-setup)
4. [Deploying the Container](#deploying-the-container)
5. [DNS & TLS Setup](#dns--tls-setup)
6. [Reverse Proxy with nginx](#reverse-proxy-with-nginx)
7. [OCI Functions (Edge) Deployment](#oci-functions-edge-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                      Internet
                          │
                    [Cloudflare / WAF]
                          │
                    [OCI Load Balancer]
                          │
                    [nginx Reverse Proxy]
                    (TLS termination, security headers)
                          │
                    [KYA Hono Container]
                    (port 3000, internal only)
                          │
              ┌───────────┼───────────┐
              │           │           │
        [Supabase]  [Algorand]  [OFAC/
         API SDK]    REST      Watchlists]
```

The KYA service runs as a containerized Hono HTTP application behind an nginx reverse proxy with TLS termination. On OCI, this can be deployed via:

- **OCI Container Instance** — simple single-container deployment (recommended for most use cases)
- **OCI Functions (Fn Project)** — serverless edge deployment (for scale-free, pay-per-use)

---

## Prerequisites

### OCI Account & Access

1. **OCI Compartment** — Create a compartment named `kya-service` (or your preferred name)
2. **OCI CLI** — Install and configure:
   ```bash
   # Install OCI CLI
   pip install oci-cli

   # Configure (follow prompts for API key upload)
   oci setup setup
   ```
3. **OCI CLI config** should have a profile that grants access to:
   - Compute Instances (for Container Instances)
   - Networking (VCN, Subnets, Load Balancers)
   - Object Storage (for container image storage)
   - DNS (optional, for domain management)

### Domain Name

You'll need a domain name pointing to the service:

```
kya.yourdomain.com  →  <your-oci-ip-or-dns>
```

For testing, you can use:
- A subdomain on a domain you own
- DuckDNS free dynamic DNS
- OCI DNS zones

---

## OCI Setup

### 1. Create VCN and Networking

```bash
# Create a Virtual Cloud Network (VCN)
oci network vcn create \
  --display-name "kya-vcn" \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --cidr-block "10.0.0.0/16" \
  --dns-label "kyanvasn" \
  --domain-name "kya-vcn.oraclevcn.com"

# Note the VCN OCID from the output — you'll need it for subnet creation
VCN_ID="<output_vcn_ocid>"
```

Create a public subnet:

```bash
oci network subnet create \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --display-name "kya-public-subnet" \
  --vcn-id "$VCN_ID" \
  --cidr-block "10.0.0.0/24" \
  --route-table-id "default" \
  --dhcp-options-id "default"
```

### 2. Set Up SSH Keys

```bash
# Generate SSH key if you don't have one
ssh-keygen -t rsa -b 4096 -f ~/.ssh/kya_oci -N "" -q

# Upload public key to OCI (or use your existing key's fingerprint)
oci compute key create \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --public-key-file ~/.ssh/kya_oci.pub \
  --display-name "kya-deploy-key"
```

### 3. Create OCI Registry (OCIR) Namespace

```bash
# Get your tenancy OCID
TENANCY_ID=$(oci iam region-subscription list --all --query 'data[0].regionInfo[0].tenantId' --raw-output)
REGION="us-ashburn-1"  # Adjust to your region

# Create a private registry namespace (or use existing)
oci artifacts container-registry namespace create \
  --compartment-id "$TENANCY_ID" \
  --display-name "kya"
```

---

## Deploying the Container

### Option A: OCI Container Instance (Recommended)

#### 1. Build and Push the Docker Image

```bash
cd /path/to/kya-service

# Build the production image
docker build -t kya-service:latest .

# Tag for OCI Registry
OCIR_ENDPOINT="iad.ocir.io"  # Adjust for your region (see below)
IMAGE_TAG="$OCIR_ENDPOINT/<your-namespace>/kya-service:latest"
docker tag kya-service:latest "$IMAGE_TAG"

# Login to OCIR (use username as tenancy/user)
# Username format: tenancy-namespace/username (e.g., company_acme/john.doe)
docker login "$OCIR_ENDPOINT"

# Push the image
docker push "$IMAGE_TAG"
```

**Region-specific OCIR endpoints:**

| Region | Endpoint |
|--------|----------|
| US Ashburn (iad) | `iad.ocir.io` |
| US Phoenix (phx) | `phx.ocir.io` |
| EU Frankfurt (fra) | `fra.ocir.io` |
| UK London (lhr) | `lhr.ocir.io` |
| AP Sydney (syd) | `syd.ocir.io` |
| AP Tokyo (nrt) | `nrt.ocir.io` |

#### 2. Create Container Instance

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
        "SUPABASE_ANON_KEY": "<your-anon-key>",
        "ALGORAND_NETWORK_URL": "<your-algo-rpc>",
        "ALGORAND_API_TOKEN": "<your-algo-token>",
        "SCREENING_FAIL_THRESHOLD": "0.85",
        "SCREENING_FLAG_THRESHOLD": "0.50",
        "LOG_LEVEL": "info"
      }
    }
  ] \
  --vcn-id "$VCN_ID" \
  --subnet-id <YOUR_SUBNET_OCID> \
  --assign-public-ip true \
  --shape-config-memory-in-gbs 2 \
  --assign-private-vip true
```

#### 3. Get the Public IP

```bash
# Find the container instance
INSTANCE_ID=$(oci compute container-instance list \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --display-name "kya-container" \
  --raw-output --query 'data[0].id')

# Get the public IP
PUBLIC_IP=$(oci compute container-instance get \
  --container-instance-id "$INSTANCE_ID" \
  --raw-output --query 'data."public-ip"')

echo "KYA Service Public IP: $PUBLIC_IP"
```

### Option B: OCI Functions (Edge Deployment)

For a serverless edge deployment, you can deploy the KYA service as an OCI Function. This requires:

1. **Install Fn Project CLI** and initialize your environment
2. **Create a Dockerfile for edge-runtime** (see [OCI Functions (Edge) Deployment](#oci-functions-edge-deployment) section)
3. **Deploy with Fn**:
   ```bash
   fn init --runtime node --trigger http kya-func
   cd kya-func
   fn deploy --app kya-app --registry iad.ocir.io/<your-namespace>/
   ```

The edge deployment uses OCI's serverless compute with automatic scaling, pay-per-use pricing, and built-in DDoS protection.

---

## DNS & TLS Setup

### 1. Configure DNS

#### Using OCI DNS Zone

```bash
# Create DNS zone (if not exists)
oci dns zone create \
  --compartment-id <YOUR_COMPARTMENT_OCID> \
  --display-name "yourdomain.com" \
  --zone-type "PRIMARY" \
  --retry-after "PT1H"

# Create A record for kya service
oci dns record-set create \
  --zone-name "yourdomain.com" \
  --zone-name-and-type-query '{"zoneNameAndType": {"name": "yourdomain.com", "type": "A"}}' \
  --item '{"name": "kya.yourdomain.com", "type": "A", "ttl": 300, "rdata": {"address": "'"$PUBLIC_IP"'"}}'
```

#### Using External DNS (Cloudflare, Route 53, etc.)

Create an A record pointing to the public IP:

```
Type: A
Name: kya
Value: <PUBLIC_IP_FROM_STEP_ABOVE>
TTL: 300 (5 min)
Proxy: On (if using Cloudflare)
```

### 2. TLS Certificate

#### Let's Encrypt (Production)

Use the included `ssl-setup.sh` script:

```bash
./ssl-setup.sh --domain kya.yourdomain.com --mode letsencrypt
```

This installs certbot and obtains a Let's Encrypt certificate.

For automated renewal, the script sets up certbot's built-in renewal cron.

#### Self-Signed (Development / Testing)

```bash
./ssl-setup.sh --domain localhost --mode selfsigned
```

#### OCI Managed Certificates

For production workloads on OCI Load Balancers:

```bash
# Upload certificate to OCI Vault/Secrets Manager
oci vault secret create ...

# Reference the secret in your Load Balancer TLS config
oci network load-balancer update ...
```

---

## Reverse Proxy with nginx

### Production Setup

The nginx reverse proxy is included in the deployment stack. For a standalone nginx deployment:

#### 1. Install nginx on your OCI instance

```bash
# Oracle Linux / RHEL
sudo yum install -y nginx

# Ubuntu / Debian
sudo apt-get install -y nginx
```

#### 2. Configure nginx

Copy `nginx.conf` from the project and customize:

```bash
sudo cp /path/to/kya-service/nginx.conf /etc/nginx/nginx.conf
sudo sed -i "s/\${SERVER_NAME:-localhost}/kya.yourdomain.com/" /etc/nginx/nginx.conf
```

#### 3. Place TLS certificates

```bash
sudo mkdir -p /etc/nginx/certs
sudo cp /etc/letsencrypt/live/kya.yourdomain.com/fullchain.pem /etc/nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/kya.yourdomain.com/privkey.pem /etc/nginx/certs/privkey.pem
sudo chmod 600 /etc/nginx/certs/privkey.pem
```

#### 4. Test and start nginx

```bash
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Docker Compose Setup (Alternative)

If you prefer Docker Compose for simpler management:

```bash
# Clone the repo
git clone <your-kya-repo> && cd kya-service

# Copy env file
cp .env.example .env
# Edit .env with your actual values

# Start with nginx proxy
docker compose up -d --build
```

---

## OCI Functions (Edge) Deployment

For a serverless edge deployment that works on OCI's edge/runtime environment:

### 1. Create an Edge-Compatible Dockerfile

```dockerfile
# Dockerfile.edge — OCI Functions compatible
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
RUN npm run build

# OCI Functions expects a specific structure
FROM node:22-alpine AS runtime

WORKDIR /function

COPY --from=build /app/package.json ./
RUN npm ci --omit=dev --production

COPY --from=build /app/dist/ ./dist/

# OCI Functions entry point pattern
CMD ["node", "dist/index.js"]
```

### 2. Build and Deploy

```bash
# Build with edge runtime
docker build -f Dockerfile.edge -t kya-edge:latest .

# Tag and push
docker tag kya-edge:latest iad.ocir.io/<namespace>/kya-edge:latest
docker push iad.ocir.io/<namespace>/kya-edge:latest

# Deploy with Fn CLI
fn deploy --app kya-app --name kya-service --registry iad.ocir.io/<namespace>/
```

### 3. Configure Environment Variables

```bash
# Set env vars for the function
fn update function --env PORT=3000 --env NODE_ENV=production kya-app kya-service
```

### 4. Access the Edge Endpoint

The function will be available at:

```
https://<your-fn-domain>/kya-service
```

OCI Functions provides automatic scaling, built-in HTTPS, and edge caching.

---

## Monitoring & Maintenance

### Health Checks

The KYA service exposes a health endpoint:

```bash
# Direct (internal)
curl http://localhost:3000/api/v1/health

# Through nginx (external)
curl -k https://kya.yourdomain.com/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-01T00:00:00.000Z"}
```

### Log Access

#### Container Instance logs

```bash
# View container logs
oci compute container-instance logs get \
  --container-instance-id <INSTANCE_ID> \
  --stream STDOUT

# Follow logs
oci compute container-instance logs get \
  --container-instance-id <INSTANCE_ID> \
  --stream STDOUT --follow
```

#### Docker Compose logs

```bash
docker compose logs -f kya
```

### Watchlist Updates

Watchlists should refresh automatically when the container starts. For manual updates:

```bash
curl -X POST https://kya.yourdomain.com/api/v1/watchlist/refresh \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Database/Storage Maintenance

If using Supabase or Algorand, monitor:

```bash
# Supabase project health
# Algorand indexer status
# Watchlist cache size in /app/data
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker compose logs kya

# Check if port is in use
ss -tlnp | grep 3000

# Rebuild from scratch
docker compose down --rmi all --volumes
docker compose up --build
```

### TLS Errors

```bash
# Check certificate files exist
ls -la /etc/nginx/certs/

# Test nginx config
nginx -t

# Check cert permissions
ls -la /etc/letsencrypt/live/kya.yourdomain.com/
```

### Connection Refused

```bash
# Test from inside the container
docker exec -it kya-app wget http://localhost:3000/api/v1/health

# Check network connectivity
telnet kya.yourdomain.com 443

# Check OCI security lists
oci network security-list list --compartment-id <OCID>
```

### High Memory Usage

```bash
# Check container resource usage
docker stats kya-app

# Increase shape resources if needed
oci compute instance update ...
```

### Watchlist Download Fails

```bash
# Check network access from container
docker exec -it kya-app wget --spider https://www.treasury.gov/ofac/downloads/sdn.csv

# Force refresh
curl -X POST https://kya.yourdomain.com/api/v1/watchlist/refresh -d '{"force": true}'
```

---

## Quick Reference

### Commands

| Action | Command |
|--------|---------|
| Build image | `docker build -t kya-service .` |
| Local test | `docker compose up --build` |
| Push to OCIR | `docker push iad.ocir.io/<ns>/kya-service:latest` |
| Deploy to OCI | `oci compute container-instance create ...` |
| Get logs | `docker compose logs -f kya` |
| Health check | `curl https://kya.yourdomain.com/health` |
| Refresh watchlists | `curl -X POST .../api/v1/watchlist/refresh` |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `production` | Node environment |
| `SUPABASE_URL` | No | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | No | — | Supabase anon key |
| `ALGORAND_NETWORK_URL` | No | — | Algorand RPC endpoint |
| `ALGORAND_API_TOKEN` | No | — | Algorand API token |
| `SCREENING_FAIL_THRESHOLD` | No | `0.85` | FAIL confidence threshold |
| `SCREENING_FLAG_THRESHOLD` | No | `0.50` | FLAGGED confidence threshold |
| `LOG_LEVEL` | No | `info` | Log level |

---

## License

KYA Service is licensed under **AGPL-3.0**. See the [LICENSE](LICENSE) file for the full license text.
