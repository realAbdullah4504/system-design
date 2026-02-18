# SQS commands
aws sqs create-queue --queue-name my-app-jobs

# Reaching server
curl -v https://sqs.us-east-1.amazonaws.com




# Docker Commands

## Login to AWS ECR
```bash
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin 588738579221.dkr.ecr.us-east-1.amazonaws.com
```

## Build Docker Image
```bash
docker build -t notification-service:latest .

docker build -t worker-service:latest .
```

## Tag Docker Image
```bash
docker tag notification-service:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-service

docker tag worker-service:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/worker-service:latest
```

## Push to ECR
```bash
docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-service:latest

docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/worker-service:latest
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

## CPU Load Test
```bash
artillery run load-test.yml --output result.json
artillery report result.json
```