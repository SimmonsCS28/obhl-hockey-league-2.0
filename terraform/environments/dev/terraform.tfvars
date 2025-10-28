# Project Configuration
project_name = "obhl"
environment  = "dev"
aws_region   = "us-east-1"
owner        = "your-name"  # Change this to your name

# VPC Configuration
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.3.0/24", "10.0.4.0/24"]
enable_nat_gateway   = true

# RDS Configuration (Free Tier)
db_instance_class     = "db.t3.micro"
db_allocated_storage  = 20
db_deletion_protection = false
db_final_snapshot     = false
