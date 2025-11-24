# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.service_name}"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.service_name}-logs"
    }
  )
}

# Security Group for ECS Service
resource "aws_security_group" "service" {
  name        = "${var.service_name}-sg"
  description = "Security group for ${var.service_name} ECS service"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow traffic from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = var.alb_security_group_ids
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.service_name}-sg"
    }
  )
}

# ECS Task Definition
resource "aws_ecs_task_definition" "this" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name  = var.container_name
    image = var.container_image

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = var.environment_variables

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = var.health_check_command
      interval    = var.health_check_interval
      timeout     = var.health_check_timeout
      retries     = var.health_check_retries
      startPeriod = var.health_check_start_period
    }
  }])

  tags = merge(
    var.tags,
    {
      Name = "${var.service_name}-task"
    }
  )
}

# ALB Target Group
resource "aws_lb_target_group" "this" {
  name        = "${var.service_name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = var.target_group_health_check_healthy_threshold
    unhealthy_threshold = var.target_group_health_check_unhealthy_threshold
    timeout             = var.target_group_health_check_timeout
    interval            = var.target_group_health_check_interval
    path                = var.target_group_health_check_path
    protocol            = "HTTP"
    matcher             = var.target_group_health_check_matcher
  }

  deregistration_delay = var.deregistration_delay

  tags = merge(
    var.tags,
    {
      Name = "${var.service_name}-tg"
    }
  )
}

# ALB Listener Rule
resource "aws_lb_listener_rule" "this" {
  listener_arn = var.alb_listener_arn
  priority     = var.listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }

  condition {
    path_pattern {
      values = var.listener_rule_paths
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.service_name}-rule"
    }
  )
}

# ECS Service
resource "aws_ecs_service" "this" {
  name            = var.service_name
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [
    aws_lb_listener_rule.this
  ]

  tags = merge(
    var.tags,
    {
      Name = var.service_name
    }
  )
}
