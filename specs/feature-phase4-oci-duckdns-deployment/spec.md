# Feature Specification: Phase 4 — Scalable OCI Production Deployment with DuckDNS & Caddy SSL

**Feature Branch**: `feature/phase4-oci-duckdns-deployment`  
**Created**: 2026-08-12  
**Status**: Draft  
**Input**: User description: "Phase 4 (Scalable OCI Infrastructure Deployment, DuckDNS Dynamic Hostname Resolution, Automatic Caddy TLS/SSL Ingress, Docker Compose Containerization & Cloud-Native Scalability Paved-Path)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automatic HTTPS/TLS Ingress & DuckDNS Resolution (Priority: P1)
As a platform operator or client agent developer, I want KYA Service to be accessible at a secure, custom HTTPS endpoint (`https://<hostname>.duckdns.org`) with automatic Let's Encrypt TLS renewal, so that API calls and x402 micro-payments are encrypted over production public networks.

**Why this priority**: Production mainnet readiness. Unencrypted HTTP endpoints violate security standards and risk payment header interception.

**Independent Test**:
- Issue `curl -I https://<hostname>.duckdns.org/api/v1/health` $\rightarrow$ returns `HTTP/2 200 OK` with valid TLS certificate.

**Acceptance Scenarios**:
1. **Given** a DuckDNS token and domain name, **When** Caddy reverse proxy initializes, **Then** automatically request and renew Let's Encrypt TLS certificates.
2. **Given** a request to `http://<hostname>.duckdns.org`, **When** received, **Then** redirect automatically to `https://`.

---

### User Story 2 — Production Containerization & Cloud-Native Scalability (Priority: P1)
As a DevOps engineer or autonomous node operator, I want a containerized deployment architecture supporting both lightweight single-node execution (Docker Compose + Caddy) and paved-path cloud-native scalability (OCI Container Instances / GCP Cloud Run / Kubernetes), so that KYA can scale seamlessly under high transaction volume.

**Why this priority**: Ensures deployment simplicity for node operators while preserving a clear growth path for high-throughput scaling.

**Independent Test**:
- Run `docker compose up -d` $\rightarrow$ services (`kya-service`, `caddy`, `duckdns-updater`) spin up, pass healthchecks, and respond on port 443.

---

### User Story 3 — OCI Infrastructure Automation & Health Monitoring (Priority: P2)
As an infrastructure maintainer, I want Terraform scripts to provision Oracle Cloud Infrastructure (OCI) compute, virtual cloud networks (VCN), security lists, and OCI alarm metrics, so that infrastructure setup is automated, repeatable, and continuously monitored.

**Why this priority**: Fulfills Constitution Principle IX (Infrastructure Security & Pre-Commit Secret Sentinel).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a production-ready `Dockerfile` (multi-stage build) running `kya-service` on Node 20.
- **FR-002**: System MUST provide `docker-compose.yml` orchestrating `kya-service`, `caddy` (reverse proxy with automated Let's Encrypt TLS), and `duckdns` container.
- **FR-003**: System MUST provide Terraform provisioning scripts (`terraform/`) for Oracle Cloud Infrastructure (OCI) Ampere A1 (ARM64) or E2 (x86_64) instances.
- **FR-004**: System MUST document paved-path scaling patterns for transitioning from Docker Compose $\rightarrow$ OCI Container Instances / GCP Cloud Run / Kubernetes.
- **FR-005**: All credentials (`.env.deploy`, `*.tfvars`, `*.tfstate`) MUST be excluded via `.gitignore` and validated by `.githooks/pre-commit`.

---

## Paved-Path Scalability Architecture

```
                                      PAVED-PATH EVOLUTION
                                                │
 ┌──────────────────────────────────────────┐   │   ┌──────────────────────────────────────────┐
 │ PHASE 4A: Docker Compose + Caddy (Now)   │   │   │ PHASE 4B: Cloud-Native Scaling (Next)    │
 ├──────────────────────────────────────────┤   │   ├──────────────────────────────────────────┤
 │ - Single OCI Always Free VM (4 core/24G) │   │   │ - OCI Container Instances / Cloud Run    │
 │ - Caddy automatic TLS + DuckDNS updater  │───┼──►│ - OCI Load Balancer (HTTPS / TLS term)   │
 │ - Supabase PostgreSQL + Redis Cache     │   │   │ - Managed Supabase / Redis Cluster       │
 └──────────────────────────────────────────┘   │   └──────────────────────────────────────────┘
```

---

## Success Criteria *(mandatory)*

- **SC-001**: Docker Compose spins up healthy container stack in under 60 seconds.
- **SC-002**: Caddy successfully obtains Let's Encrypt TLS certificate for DuckDNS hostname.
- **SC-003**: Terraform plan executes with 0 errors.
