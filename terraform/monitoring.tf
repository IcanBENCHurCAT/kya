# OCI Notification Topic (ONS)
resource "oci_ons_notification_topic" "kya_alerts" {
  compartment_id = var.compartment_ocid
  name           = "kya-service-critical-alerts"
  description    = "Notification topic for KYA Service infrastructure alarms"
}

# Notification Subscription (Email Alerting)
resource "oci_ons_subscription" "email_subscription" {
  compartment_id = var.compartment_ocid
  topic_id       = oci_ons_notification_topic.kya_alerts.id
  protocol       = "EMAIL"
  endpoint       = var.notification_email
}

# HTTP Health Checks Probe
resource "oci_health_checks_http_monitor" "gateway_health" {
  compartment_id      = var.compartment_ocid
  display_name        = "kya-service-gateway-http-check"
  targets             = ["${var.duckdns_subdomain}.duckdns.org"]
  protocol            = "HTTPS"
  port                = 443
  path                = "/api/v1/health"
  interval_in_seconds = 60
  timeout_in_seconds  = 10
  method              = "GET"
  is_enabled          = true
}

# Monitoring Alarm: Container Instance High CPU Utilization (> 85% for 5 mins)
resource "oci_monitoring_alarm" "cpu_high" {
  compartment_id        = var.compartment_ocid
  display_name          = "kya-service-cpu-utilization-high"
  destinations          = [oci_ons_notification_topic.kya_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_containerinstances"
  query                 = "CpuUtilization[1m]{resourceId = \"${oci_container_instances_container_instance.kya_container_instance.id}\"}.mean() > 85"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "CRITICAL ALERT: CPU utilization on KYA Service Container Instance has exceeded 85% for 5 minutes."
}

# Monitoring Alarm: Container Instance High Memory Utilization (> 85% for 5 mins)
resource "oci_monitoring_alarm" "memory_high" {
  compartment_id        = var.compartment_ocid
  display_name          = "kya-service-memory-utilization-high"
  destinations          = [oci_ons_notification_topic.kya_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_containerinstances"
  query                 = "MemoryUtilization[1m]{resourceId = \"${oci_container_instances_container_instance.kya_container_instance.id}\"}.mean() > 85"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "CRITICAL ALERT: Memory utilization on KYA Service Container Instance has exceeded 85% for 5 minutes."
}

# Monitoring Alarm: Container Instance High Disk Utilization (> 85% for 5 mins)
resource "oci_monitoring_alarm" "disk_high" {
  compartment_id        = var.compartment_ocid
  display_name          = "kya-service-disk-utilization-high"
  destinations          = [oci_ons_notification_topic.kya_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_containerinstances"
  query                 = "DiskUtilization[1m]{resourceId = \"${oci_container_instances_container_instance.kya_container_instance.id}\"}.mean() > 85"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "CRITICAL ALERT: Disk space utilization on KYA Service Container Instance has exceeded 85% for 5 minutes."
}

# Monitoring Alarm: Instance Infrastructure Degraded / Unhealthy
resource "oci_monitoring_alarm" "instance_health" {
  compartment_id        = var.compartment_ocid
  display_name          = "kya-service-instance-health-degraded"
  destinations          = [oci_ons_notification_topic.kya_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_containerinstances"
  query                 = "ContainerInstanceStatus[1m]{resourceId = \"${oci_container_instances_container_instance.kya_container_instance.id}\"}.mean() != 1"
  severity              = "CRITICAL"
  pending_duration      = "PT2M"
  body                  = "CRITICAL ALERT: KYA Service Container Instance infrastructure status is unhealthy or unresponsive."
}

# Monitoring Alarm: HTTP Gateway Endpoint Downtime
resource "oci_monitoring_alarm" "http_gateway_down" {
  compartment_id        = var.compartment_ocid
  display_name          = "kya-service-http-gateway-downtime"
  destinations          = [oci_ons_notification_topic.kya_alerts.id]
  is_enabled            = true
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_healthchecks"
  query                 = "http_status[1m]{monitorId = \"${oci_health_checks_http_monitor.gateway_health.id}\"}.mean() != 1"
  severity              = "CRITICAL"
  pending_duration      = "PT2M"
  body                  = "CRITICAL ALERT: KYA Service HTTPS health check probing failed. Gateway endpoint is unreachable or returning errors."
}
