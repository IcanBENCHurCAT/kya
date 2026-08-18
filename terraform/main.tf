terraform {
  required_version = ">= 1.2.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }
}

variable "tenancy_ocid" {
  type        = string
  description = "OCI Tenancy OCID"
}

variable "user_ocid" {
  type        = string
  description = "OCI User OCID"
}

variable "fingerprint" {
  type        = string
  description = "OCI API Key Fingerprint"
}

variable "private_key_path" {
  type        = string
  description = "Path to OCI API Private Key (.pem)"
}

variable "region" {
  type        = string
  default     = "us-ashburn-1"
  description = "OCI Region (e.g. us-ashburn-1, us-phoenix-1)"
}

variable "compartment_ocid" {
  type        = string
  description = "OCI Compartment OCID"
}

variable "ssh_public_key" {
  type        = string
  description = "Public SSH key to inject into instance"
}

# Application Environment Variables
variable "container_image" {
  type        = string
  default     = "iad.ocir.io/id1fbfmorrpo/kya-service:latest"
  description = "Docker image URL for OCI Container Instance (Multi-Arch AMD64/ARM64)"
}

variable "container_ocpus" {
  type        = number
  default     = 1
  description = "Number of OCPUs for Container Instance"
}

variable "container_memory_in_gbs" {
  type        = number
  default     = 4
  description = "RAM in GBs for Container Instance"
}

variable "supabase_url" {
  type    = string
  default = ""
}

variable "supabase_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "algorand_network_url" {
  type    = string
  default = "https://mainnet-api.algonode.cloud"
}

variable "algorand_api_token" {
  type      = string
  default   = ""
  sensitive = true
}

variable "duckdns_subdomain" {
  type    = string
  default = "kya-service"
}

variable "duckdns_token" {
  type      = string
  default   = ""
  sensitive = true
}

variable "notification_email" {
  type        = string
  default     = "alerts@kya-service.com"
  description = "Email address to receive critical OCI monitoring alerts"
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# Virtual Cloud Network (VCN)
resource "oci_core_vcn" "kya_vcn" {
  compartment_id = var.compartment_ocid
  cidr_block     = "10.1.0.0/16"
  display_name   = "kya-vcn"
  dns_label      = "kyavcn"
}

# Internet Gateway
resource "oci_core_internet_gateway" "kya_ig" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.kya_vcn.id
  display_name   = "kya-ig"
  enabled        = true
}

# Route Table
resource "oci_core_route_table" "kya_rt" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.kya_vcn.id
  display_name   = "kya-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.kya_ig.id
  }
}

# Security List (Allows SSH 22, HTTP 80, HTTPS 443, App 3000, App 4021)
resource "oci_core_security_list" "kya_sl" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.kya_vcn.id
  display_name   = "kya-security-list"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 3000
      max = 3000
    }
  }

  # Backend Health Probe port
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 4021
      max = 4021
    }
  }
}

# Subnet
resource "oci_core_subnet" "kya_subnet" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.kya_vcn.id
  cidr_block        = "10.1.1.0/24"
  display_name      = "kya-subnet"
  dns_label         = "kyasubnet"
  route_table_id    = oci_core_route_table.kya_rt.id
  security_list_ids = [oci_core_security_list.kya_sl.id]
}

# Flexible Load Balancer (Public HTTPS / Ingress)
resource "oci_load_balancer_load_balancer" "kya_lb" {
  compartment_id = var.compartment_ocid
  display_name   = "kya-service-lb"
  shape          = "flexible"
  subnet_ids     = [oci_core_subnet.kya_subnet.id]

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = 10
  }

  is_private = false
}

# Load Balancer Backend Set
resource "oci_load_balancer_backend_set" "kya_backend_set" {
  name             = "kya-backend-set"
  load_balancer_id = oci_load_balancer_load_balancer.kya_lb.id
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol            = "HTTP"
    port                = 3000
    url_path            = "/api/v1/health"
    return_code         = 200
    interval_ms         = 10000
    timeout_in_millis   = 3000
    retries             = 3
  }
}

# Load Balancer Listener (HTTP 80)
resource "oci_load_balancer_listener" "kya_listener_http" {
  load_balancer_id = oci_load_balancer_load_balancer.kya_lb.id
  name             = "kya-http-listener"
  default_backend_set_name = oci_load_balancer_backend_set.kya_backend_set.name
  port             = 80
  protocol         = "HTTP"
}

variable "availability_domain_index" {
  type        = number
  default     = 2
  description = "Index of availability domain (0, 1, or 2 for Ashburn AD-1, AD-2, AD-3)"
}



variable "instance_shape" {
  type        = string
  default     = "VM.Standard.A1.Flex"
  description = "OCI Compute Shape (Always Free ARM64 Ampere)"
}


# Availability Domains Data
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

# Fetch Ubuntu 24.04 Image dynamically based on shape
data "oci_core_images" "ubuntu_images" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.instance_shape
}

# OCI Container Instance (Always Free CI.Standard.A1.Flex - ARM64 Ampere Altra)
resource "oci_container_instances_container_instance" "kya_container_instance" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "kya-service-container"
  shape               = "CI.Standard.A1.Flex"

  shape_config {
    ocpus         = var.container_ocpus
    memory_in_gbs = var.container_memory_in_gbs
  }

  vnics {
    subnet_id             = oci_core_subnet.kya_subnet.id
    is_public_ip_assigned = true
    display_name          = "kya-ci-vnic"
  }

  containers {
    display_name = "kya-service"
    image_url    = "node:20-alpine"
    command      = ["sh", "-c", "apk add --no-cache git ca-certificates && rm -rf /kyacode && git clone https://github.com/IcanBENCHurCAT/kya.git /kyacode && cd /kyacode && npm ci --omit=dev && mkdir -p /kyacode/data && npm start"]








    environment_variables = {
      "PORT"                     = "3000"
      "NODE_ENV"                 = "production"
      "SUPABASE_URL"             = var.supabase_url
      "SUPABASE_ANON_KEY"        = var.supabase_key
      "SUPABASE_SERVICE_ROLE_KEY"= var.supabase_key
      "ALGORAND_NETWORK_URL"     = var.algorand_network_url
      "ALGORAND_API_TOKEN"       = var.algorand_api_token
      "DUCKDNS_SUBDOMAIN"        = var.duckdns_subdomain
      "DUCKDNS_TOKEN"            = var.duckdns_token
      "KYA_TREASURY_ADDRESS"     = "W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE"
      "ESCROW_ADDRESS"           = "W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE"
      "SCREENING_FAIL_THRESHOLD" = "0.85"
      "SCREENING_FLAG_THRESHOLD" = "0.50"
      "LOG_LEVEL"                = "info"
    }

    resource_config {
      memory_limit_in_gbs = var.container_memory_in_gbs
      vcpus_limit         = var.container_ocpus
    }
  }

  # DuckDNS Sidecar container with explicit Load Balancer IP parameter
  containers {
    display_name = "duckdns-updater"
    image_url    = "alpine:latest"
    command      = ["sh", "-c", "while true; do wget -qO- \"https://www.duckdns.org/update?domains=${var.duckdns_subdomain}&token=${var.duckdns_token}&ip=${oci_load_balancer_load_balancer.kya_lb.ip_address_details[0].ip_address}\"; sleep 300; done"]

    resource_config {
      memory_limit_in_gbs = 0.5
      vcpus_limit         = 0.5
    }
  }

  graceful_shutdown_timeout_in_seconds = 30
}

# Auto-register Container Instance IP into Load Balancer Backend Set
resource "oci_load_balancer_backend" "kya_container_backend" {
  load_balancer_id = oci_load_balancer_load_balancer.kya_lb.id
  backendset_name  = oci_load_balancer_backend_set.kya_backend_set.name
  ip_address       = oci_container_instances_container_instance.kya_container_instance.vnics[0].private_ip
  port             = 3000
  backup           = false
  drain            = false
  offline          = false
  weight           = 1
}

output "container_instance_id" {
  value       = oci_container_instances_container_instance.kya_container_instance.id
  description = "OCID of the deployed OCI Container Instance"
}

output "load_balancer_ip" {
  value       = oci_load_balancer_load_balancer.kya_lb.ip_address_details[0].ip_address
  description = "Public IP address of the Flexible Load Balancer"
}

output "gateway_url" {
  value       = "https://${var.duckdns_subdomain}.duckdns.org"
  description = "HTTPS Gateway URL with Load Balancer & DuckDNS TLS"
}

output "notification_topic_ocid" {
  value       = oci_ons_notification_topic.kya_alerts.id
  description = "OCID of ONS Notification Topic"
}

output "notification_email" {
  value       = var.notification_email
  description = "Subscribed email address for OCI Monitoring alarms"
}


