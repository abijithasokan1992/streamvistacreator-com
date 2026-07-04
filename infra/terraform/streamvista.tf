# StreamVista OCI infrastructure reference (Terraform).
#
# NOTE: This file is documentation only. It is not applied by the app build
# or by Lovable Cloud. Apply it with the Terraform CLI against your own OCI
# tenancy. Variables (tenancy_ocid, user_ocid, fingerprint, private_key_path,
# region, compartment_ocid, bucket_namespace) must be provided via a
# terraform.tfvars file or -var flags.
#
# Related runtime config in the app:
#   - VITE_ORACLE_BUCKET (client)               → bucket name
#   - site_config.oracle_bucket / _namespace /  → edge functions
#     _region / _tenancy_ocid / _user_ocid /
#     _fingerprint
#   - ORACLE_PRIVATE_KEY (backend secret)       → signing key

# Configure the Oracle Cloud Infrastructure Provider
provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# 1. Create the Core VCN for Media Pipelines
resource "oci_core_vcn" "streamvista_vcn" {
  compartment_id = var.compartment_ocid
  cidr_block     = "10.0.0.0/16"
  display_name   = "sv-network-prod"
  dns_label      = "streamvistavcn"
}

# 2. Service Gateway (crucial for unmetered internal media traffic)
data "oci_core_services" "all_oci_services" {}

resource "oci_core_service_gateway" "sv_storage_gateway" {
  compartment_id = var.compartment_ocid
  display_name   = "sv-storage-gateway"
  vcn_id         = oci_core_vcn.streamvista_vcn.id

  services {
    service_id = data.oci_core_services.all_oci_services.services[0].id
  }
}

# 3. Secure Private Subnet for Transcoding Engines
resource "oci_core_subnet" "private_transcoder_subnet" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.streamvista_vcn.id
  cidr_block                 = "10.0.1.0/24"
  display_name               = "sv-private-transcoder"
  dns_label                  = "transcoder"
  prohibit_public_ip_on_vnic = true
}

# 4. Production Studio Vault Bucket
resource "oci_objectstorage_bucket" "streamvista_production_vault" {
  compartment_id = var.compartment_ocid
  name           = "streamvista-studio-vault-prod"
  namespace      = var.bucket_namespace
  storage_tier   = "Standard"

  object_events_enabled = true
  versioning            = "Enabled"

  # Auto-retention logic to safeguard master files
  retention_rules {
    display_name = "protect_masters"
    duration {
      time_amount = "30"
      time_unit   = "DAYS"
    }
  }
}
