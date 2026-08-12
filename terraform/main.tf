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
  default     = "iad.ocir.io/kya/kya-service:latest"
  description = "Docker image URL for OCI Container Instance"
}

variable "container_ocpus" {
  type        = number
  default     = 1
  description = "Number of OCPUs for Container Instance"
}

variable "container_memory_in_gbs" {
  type        = number
  default     = 2
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
  cidr_block     = "10.0.0.0/16"
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

# Security List (Allows SSH 22, HTTP 80, HTTPS 443, App 3000)
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
}

# Subnet
resource "oci_core_subnet" "kya_subnet" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.kya_vcn.id
  cidr_block        = "10.0.1.0/24"
  display_name      = "kya-subnet"
  dns_label         = "kyasubnet"
  route_table_id    = oci_core_route_table.kya_rt.id
  security_list_ids = [oci_core_security_list.kya_sl.id]
}

variable "availability_domain_index" {
  type        = number
  default     = 0
  description = "Index of availability domain (0, 1, or 2)"
}

variable "instance_shape" {
  type        = string
  default     = "VM.Standard.E2.1.Micro"
  description = "OCI Compute Shape"
}

# Availability Domains Data
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

# Fetch Ubuntu 24.04 Image
data "oci_core_images" "ubuntu_images" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.instance_shape
}

# OCI Container Instance (Serverless 0-to-N Scaling Container)
resource "oci_container_instances_container_instance" "kya_container_instance" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  display_name        = "kya-service-container"
  shape               = "CI.Standard.E4.Flex"

  shape_config {
    ocpus         = var.container_ocpus
    memory_in_gbs = var.container_memory_in_gbs
  }

  vnics {
    subnet_id        = oci_core_subnet.kya_subnet.id
    assign_public_ip = true
    is_public        = true
    display_name     = "kya-ci-vnic"
  }

  containers {
    display_name = "kya-service"
    image_url    = var.container_image

    environment_variables = {
      "PORT"                     = "3000"
      "NODE_ENV"                 = "production"
      "SUPABASE_URL"             = var.supabase_url
      "SUPABASE_ANON_KEY"        = var.supabase_key
      "ALGORAND_NETWORK_URL"     = var.algorand_network_url
      "ALGORAND_API_TOKEN"       = var.algorand_api_token
      "DUCKDNS_SUBDOMAIN"        = var.duckdns_subdomain
      "DUCKDNS_TOKEN"            = var.duckdns_token
      "SCREENING_FAIL_THRESHOLD" = "0.85"
      "SCREENING_FLAG_THRESHOLD" = "0.50"
      "LOG_LEVEL"                = "info"
    }

    resource_config {
      memory_limit_in_gbs = var.container_memory_in_gbs
      vcpus_limit         = var.container_ocpus
    }
  }

  graceful_shutdown_timeout_in_seconds = 30
}

# Compute Instance (VM Fallback)
resource "oci_core_instance" "kya_vm" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  display_name        = "kya-service-gateway"
  shape               = var.instance_shape

  dynamic "shape_config" {
    for_each = length(regexall("Flex", var.instance_shape)) > 0 ? [1] : []
    content {
      ocpus         = 2
      memory_in_gbs = 12
    }
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu_images.images[0].id
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.kya_subnet.id
    assign_public_ip = true
    hostname_label   = "kya-service"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(replace(<<-EOF
      #!/bin/bash
      set -ex
      iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
      iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
      iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
      netfilter-persistent save || true
    EOF
    , "\r", ""))
  }

  lifecycle {
    ignore_changes = [metadata["user_data"]]
  }
}

output "container_instance_id" {
  value       = oci_container_instances_container_instance.kya_container_instance.id
  description = "OCID of the deployed OCI Container Instance"
}

output "public_ip" {
  value       = oci_core_instance.kya_vm.public_ip
  description = "Public IP address of the deployed Gateway VM"
}

output "gateway_url" {
  value       = "https://${var.duckdns_subdomain}.duckdns.org"
  description = "HTTPS Gateway URL with Caddy & DuckDNS TLS"
}

output "notification_topic_ocid" {
  value       = oci_ons_notification_topic.kya_alerts.id
  description = "OCID of ONS Notification Topic"
}

output "notification_email" {
  value       = var.notification_email
  description = "Subscribed email address for OCI Monitoring alarms"
}
