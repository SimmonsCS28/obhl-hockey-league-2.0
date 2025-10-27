terraform {
  backend "s3" {
    bucket         = "obhl-terraform-state-1761590429"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "obhl-terraform-locks"
    encrypt        = true
  }
}
