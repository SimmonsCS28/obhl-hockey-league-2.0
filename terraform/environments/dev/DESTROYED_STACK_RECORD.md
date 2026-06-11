# Destroyed Dev Stack — Record (for recreation reference)

This Terraform-managed AWS stack was deployed but **never actually used** by the
running application. The real production app runs on a single EC2 instance via
`docker compose` (see `aws_deployment_guide.md`) with Postgres in a Docker
container — not this RDS instance.

A repo-wide grep found zero references to any of the resource names/endpoints
below, confirming nothing depends on this stack. It was destroyed via
`terraform destroy` on 2026-06-10 to eliminate unnecessary AWS costs (NAT
Gateway + ALB + RDS were likely the bulk of the ~$100/mo bill).

The Terraform code that defines this stack is unchanged and still lives in
`terraform/modules/` and `terraform/environments/dev/`. To recreate this exact
stack, just run `terraform apply` again from `terraform/environments/dev/`
(it will create new resources with new IDs/endpoints — the values below are
historical only).

## AWS Account
- Account ID: `889501007532`
- Region: `us-east-1`
- IAM user used: `obhl-dev-user`

## Resources that existed (as of destruction)

### VPC (`module.vpc`)
- VPC: `vpc-0be027d59ac9aa557` (CIDR `10.0.0.0/16`)
- Public subnets:
  - `subnet-07317483367a9ac4a` — `10.0.1.0/24` — us-east-1a
  - `subnet-0bbc5d143c2f0caa1` — `10.0.2.0/24` — us-east-1b
- Private subnets:
  - `subnet-049c94d7bf6ee7189` — `10.0.3.0/24` — us-east-1a
  - `subnet-0e9f27c3023730486` — `10.0.4.0/24` — us-east-1b
- Internet Gateway: `igw-0d54ac82dec138873`
- NAT Gateway: `nat-0d02bc6e710e6cbef` (in public subnet 1)
- Elastic IP (NAT): `eipalloc-0cb753cedeaa90266` — `18.210.179.46`

### ECS Cluster (`module.ecs_cluster`)
- Cluster: `obhl-dev-cluster` (empty — no services/tasks ever deployed)
- ALB: `obhl-dev-alb` — `obhl-dev-alb-1802482545.us-east-1.elb.amazonaws.com`
- CloudWatch log group: `/ecs/obhl-dev` (7-day retention)
- Security groups: ALB SG + ECS SG (auto-named with `name_prefix`)

### RDS (`module.rds`)
- Instance identifier: `obhl-dev-database`
- Engine: Postgres 15.13, `db.t3.micro`, 20GB gp2, single-AZ, not publicly accessible
- Endpoint (gone): `obhl-dev-database.c2z2ogswscgs.us-east-1.rds.amazonaws.com:5432`
- DB name: `obhl_db`, master username: `obhl_admin`
- Subnet group: `obhl-dev-db-subnet-group` (the two private subnets above)
- Credentials stored in Secrets Manager: `obhl-dev-db-credentials`
- Enhanced monitoring IAM role: `obhl-dev-rds-monitoring-role`

## Terraform state backend (still exists — not destroyed)
- S3 bucket: `obhl-terraform-state-1761590429`
- State key: `dev/terraform.tfstate`
- DynamoDB lock table: `obhl-terraform-locks`

These were left in place since they cost essentially nothing (S3 + DynamoDB
on-demand) and are needed if this stack is ever recreated. If you want to
fully decommission Terraform for this project, these can be deleted manually
afterward — but check `terraform state list` is empty first.
