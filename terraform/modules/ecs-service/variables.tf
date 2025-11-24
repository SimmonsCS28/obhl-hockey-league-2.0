# Service Identification
variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "container_name" {
  description = "Name of the container"
  type        = string
}

variable "container_image" {
  description = "Docker image URL (e.g., ECR repository URL with tag)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8000
}

# ECS Configuration
variable "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  type        = string
}

variable "task_cpu" {
  description = "CPU units for the task (256, 512, 1024, etc.)"
  type        = string
  default     = "256"
}

variable "task_memory" {
  description = "Memory for the task in MB"
  type        = string
  default     = "512"
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

# IAM Roles
variable "execution_role_arn" {
  description = "ARN of the task execution role"
  type        = string
}

variable "task_role_arn" {
  description = "ARN of the task role"
  type        = string
}

# Network Configuration
variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

# ALB Configuration
variable "alb_listener_arn" {
  description = "ARN of the ALB listener"
  type        = string
}

variable "alb_security_group_ids" {
  description = "List of ALB security group IDs"
  type        = list(string)
}

variable "listener_rule_priority" {
  description = "Priority for the ALB listener rule (1-50000)"
  type        = number
}

variable "listener_rule_paths" {
  description = "Path patterns for routing"
  type        = list(string)
  default     = ["/*"]
}

# Target Group Health Check
variable "target_group_health_check_path" {
  description = "Path for target group health checks"
  type        = string
  default     = "/health"
}

variable "target_group_health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "target_group_health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "target_group_health_check_healthy_threshold" {
  description = "Healthy threshold count"
  type        = number
  default     = 2
}

variable "target_group_health_check_unhealthy_threshold" {
  description = "Unhealthy threshold count"
  type        = number
  default     = 3
}

variable "target_group_health_check_matcher" {
  description = "HTTP status codes for successful health checks"
  type        = string
  default     = "200"
}

variable "deregistration_delay" {
  description = "Deregistration delay in seconds"
  type        = number
  default     = 30
}

# Container Health Check
variable "health_check_command" {
  description = "Command for container health check"
  type        = list(string)
  default     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
}

variable "health_check_interval" {
  description = "Container health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Container health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_retries" {
  description = "Container health check retry count"
  type        = number
  default     = 3
}

variable "health_check_start_period" {
  description = "Container health check start period in seconds"
  type        = number
  default     = 60
}

# Environment Variables
variable "environment_variables" {
  description = "List of environment variables for the container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

# CloudWatch
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

# Tags
variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
