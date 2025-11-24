# ECS Service Module

Terraform module for deploying a Fargate ECS service with ALB integration.

## Features

- ECS Fargate service with auto-scaling capability
- ALB target group and listener rule
- CloudWatch logging
- Security groups
- Health checks (container and target group)
- Configurable environment variables

## Usage

```hcl
module "api_gateway_service" {
  source = "../../modules/ecs-service"

  service_name   = "obhl-api-gateway"
  container_name = "api-gateway"
  container_image = "${module.ecr_api_gateway.repository_url}:latest"
  container_port = 8000

  ecs_cluster_id      = module.ecs_cluster.cluster_id
  execution_role_arn  = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn       = aws_iam_role.ecs_task_role.arn

  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnets

  alb_listener_arn        = module.alb.http_listener_arn
  alb_security_group_ids  = [module.alb.security_group_id]
  listener_rule_priority  = 100
  listener_rule_paths     = ["/api/*", "/docs", "/redoc"]

  target_group_health_check_path = "/api/v1/health"

  environment_variables = [
    {
      name  = "ENVIRONMENT"
      value = "dev"
    },
    {
      name  = "DATABASE_URL"
      value = "postgresql://..."
    }
  ]

  aws_region = "us-east-1"

  tags = {
    Environment = "dev"
    Project     = "OBHL"
  }
}
```

## Inputs

See `variables.tf` for all available inputs.

## Outputs

See `outputs.tf` for all available outputs.
