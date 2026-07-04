# StreamVista OCI Terraform (reference)

Infrastructure-as-code definitions for the Oracle Cloud resources StreamVista
depends on. **Not applied by the app build** — kept here as reference so the
runtime config (`site_config`, `VITE_ORACLE_BUCKET`, `ORACLE_PRIVATE_KEY`) has
a matching source of truth.

## Files

- `streamvista.tf` — VCN, service gateway, private transcoder subnet, and the
  production studio vault bucket (`streamvista-studio-vault-prod`).

## Required variables

Provide via `terraform.tfvars` or `-var`:

- `tenancy_ocid`
- `user_ocid`
- `fingerprint`
- `private_key_path`
- `region`
- `compartment_ocid`
- `bucket_namespace`

## Apply

```
terraform init
terraform plan
terraform apply
```

After apply, update `site_config` (via the admin console) so the app's edge
functions target the newly provisioned bucket and namespace.
