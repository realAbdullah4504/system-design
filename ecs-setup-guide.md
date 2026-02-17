# AWS ECS Setup with awsvpc Mode for SQS Integration

This guide covers setting up AWS ECS with awsvpc networking mode to connect your Node.js application to SQS.

## Prerequisites

- AWS CLI installed and configured
- Docker installed
- Your application code (already prepared in `/backend`)

## 1. Create ECR Repository

```bash
# Create ECR repository
aws ecr create-repository --repository-name system-design-app --region us-east-1

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

## 2. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t system-design-app ./backend

# Tag the image for ECR
docker tag system-design-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/system-design-app:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/system-design-app:latest
```

## 3. Create VPC and Networking Components

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)

# Create subnets
PUBLIC_SUBNET1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --query 'Subnet.SubnetId' --output text)
PUBLIC_SUBNET2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --query 'Subnet.SubnetId' --output text)

# Create internet gateway
IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# Create route table
RT_ID=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID

# Associate route table with subnets
aws ec2 associate-route-table --route-table-id $RT_ID --subnet-id $PUBLIC_SUBNET1
aws ec2 associate-route-table --route-table-id $RT_ID --subnet-id $PUBLIC_SUBNET2
```

## 4. Create Security Group

```bash
# Create security group for ECS tasks
SG_ID=$(aws ec2 create-security-group --group-name ecs-sqs-sg --description "Security group for ECS tasks" --vpc-id $VPC_ID --query 'GroupId' --output text)

# Allow inbound HTTP traffic
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0

# Allow outbound HTTPS traffic (for SQS)
aws ec2 authorize-security-group-egress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
```

## 5. Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name system-design-cluster
```

## 6. Create Task Definition

Create a file named `task-definition.json`:

```json
{
  "family": "system-design-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "system-design-app",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/system-design-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "AWS_ACCESS_KEY_ID",
          "valueFrom": "aws-access-key-id"
        },
        {
          "name": "AWS_SECRET_ACCESS_KEY",
          "valueFrom": "aws-secret-access-key"
        },
        {
          "name": "SQS_QUEUE_URL",
          "valueFrom": "sqs-queue-url"
        },
        {
          "name": "AWS_REGION",
          "valueFrom": "aws-region"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/system-design-task",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Register the task definition:
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

## 7. Create IAM Roles

### Task Execution Role
Create `ecs-task-execution-role.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

```bash
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-task-execution-role.json
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Task Role with SQS Access
Create `ecs-task-role.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

```bash
aws iam create-role --role-name ecsTaskRole --assume-role-policy-document file://ecs-task-role.json
aws iam attach-role-policy --role-name ecsTaskRole --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess
```

## 8. Create Secrets in AWS Secrets Manager

```bash
# Store AWS credentials
aws secretsmanager create-secret --name aws-access-key-id --secret-string "your-access-key-id"
aws secretsmanager create-secret --name aws-secret-access-key --secret-string "your-secret-access-key"
aws secretsmanager create-secret --name sqs-queue-url --secret-string "your-sqs-queue-url"
aws secretsmanager create-secret --name aws-region --secret-string "us-east-1"
```

## 9. Create ECS Service

```bash
aws ecs create-service \
  --cluster system-design-cluster \
  --service-name system-design-service \
  --task-definition system-design-task \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET1,$PUBLIC_SUBNET2],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
  --health-check-grace-period-seconds 30
```

## 10. Create Application Load Balancer (Optional but Recommended)

```bash
# Create load balancer
LB_ARN=$(aws elbv2 create-load-balancer --name system-design-alb --subnets $PUBLIC_SUBNET1 $PUBLIC_SUBNET2 --security-groups $SG_ID --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create target group
TG_ARN=$(aws elbv2 create-target-group --name system-design-tg --protocol HTTP --port 3000 --vpc-id $VPC_ID --target-type ip --query 'TargetGroups[0].TargetGroupArn' --output text)

# Create listener
aws elbv2 create-listener --load-balancer-arn $LB_ARN --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Update ECS service with load balancer
aws ecs update-service \
  --cluster system-design-cluster \
  --service system-design-service \
  --load-balancers targetGroupArn=$TG_ARN,containerName=system-design-app,containerPort=3000
```

## 11. Update Application for Production

Update your `backend/config/sqs.js` to use IAM roles instead of hard-coded credentials:

```javascript
import { SQSClient } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

export const REGION = process.env.AWS_REGION || "us-east-1";
export const QUEUE_URL = process.env.SQS_QUEUE_URL;

// For production, let AWS SDK use IAM role from task role
export const sqsClient = new SQSClient({
  region: REGION,
  // Remove credentials section when using IAM roles
  // credentials will be automatically picked up from the task role
});
```

## Key Points for awsvpc Mode

1. **Network Isolation**: Each task gets its own ENI (Elastic Network Interface)
2. **Static IP Assignment**: Tasks get stable IP addresses within your VPC
3. **Security Groups**: Apply directly to tasks for granular control
4. **VPC Integration**: Full access to VPC resources like RDS, ElastiCache, etc.
5. **Public IP**: Enable `assignPublicIp=ENABLED` for internet access (needed for SQS)

## Verification

```bash
# Check service status
aws ecs describe-services --cluster system-design-cluster --services system-design-service

# Check task status
aws ecs list-tasks --cluster system-design-cluster

# View logs
aws logs tail /ecs/system-design-task --follow
```

## Troubleshooting

1. **SQS Connection Issues**: Ensure security group allows outbound HTTPS (port 443)
2. **Task Fails to Start**: Check CloudWatch logs for detailed error messages
3. **Network Issues**: Verify VPC routing and internet gateway configuration
4. **Permission Errors**: Ensure IAM roles have proper SQS permissions

## Cost Optimization

- Use Fargate Spot for non-critical workloads
- Set appropriate CPU/memory limits
- Enable auto-scaling based on queue length or CPU utilization
- Use CloudWatch cost alerts

This setup provides a secure, scalable ECS deployment with awsvpc networking mode that can communicate with SQS and other AWS services.
