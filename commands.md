## SNS and SQS Setup
aws sns create-topic \
    --name loadtest-events-topic

aws sqs create-queue \
  --queue-name notification-queue

aws sqs create-queue \
  --queue-name notification-dlq

aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/notification-dlq \
  --attribute-names QueueArn

aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/notification-queue \
  --attributes '{
      "RedrivePolicy":"{\"maxReceiveCount\":\"3\", \"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:123456789012:notification-dlq\"}"
  }'

aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:588738579221:job-events-topic \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:588738579221:notification-queue

aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1:588738579221/notification-queue \
  --attributes '{"Policy":"{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"sqs:SendMessage\",\"Resource\":\"arn:aws:sqs:us-east-1:588738579221:notification-queue\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"arn:aws:sns:us-east-1:588738579221:job-events-topic\"}}}]}"}'

## Reaching server
curl -v https://sqs.us-east-1.amazonaws.com




## Docker Commands

### Login to AWS ECR
```bash
aws ecr get-login-password --region us-east-1 \
| docker login --username AWS --password-stdin 588738579221.dkr.ecr.us-east-1.amazonaws.com
```

### Build Docker Image
```bash
docker build -t notification-service:latest .

docker build -t worker-service:latest .
```

### Tag Docker Image
```bash
docker tag notification-service:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-service

docker tag worker-service:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/worker-service:latest
```

### Push to ECR
```bash
docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-service:latest

docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/worker-service:latest
```

## Load Testing Commands

### Run Load Test
```bash
artillery run load-test.yml
```

### Generate Report
```bash
artillery report load-test.yml
```

### CPU Load Test
```bash
artillery run load-test.yml --output result.json
artillery report result.json
```