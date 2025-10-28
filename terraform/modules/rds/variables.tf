variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
  default     = ""
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.13"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"  # Free tier
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20  # Free tier limit
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "obhl_db"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "obhl_admin"
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false  # Set to true for production
}

variable "final_snapshot" {
  description = "Create final snapshot on deletion"
  type        = bool
  default     = false  # Set to true for production
}
