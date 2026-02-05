# Docker Commands

## Login to AWS ECR
```bash
aws ecr get-login-password --region <your-region> \
| docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
```

## Build Docker Image
```bash
docker build -t notification-service:latest .
```

## Tag Docker Image
```bash
docker tag notification-service:latest \
<account-id>.dkr.ecr.<region>.amazonaws.com/notification-service:latest
```

## Push to ECR
```bash
docker push \
<account-id>.dkr.ecr.<region>.amazonaws.com/notification-service:latest
```

# Load Testing Commands

## Run Load Test
```bash
artillery run load-test.yml
```

## Generate Report
```bash
artillery report load-test.yml
```