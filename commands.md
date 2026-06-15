## Cloud-formation commands
# Create key pair
aws ec2 create-key-pair --key-name keypair --query 'KeyMaterial' --output text > keypair.pem
 
# Set correct permissions
chmod 400 keypair.pem
 
# Then deploy with the key name

aws cloudformation deploy \
  --template-file infrastructure/aws/cloudformation/cloudformation-sqs-sns-stack.yaml \
  --stack-name sqs-sns-stack \
  --parameter-overrides Environment=dev \
  --capabilities CAPABILITY_NAMED_IAM


aws cloudformation deploy \
  --template-file infrastructure/aws/cloudformation/secrets.yaml \
  --stack-name secrets \
  --region us-east-1 \
  --parameter-overrides file://infrastructure/aws/cloudformation/params.json

aws cloudformation deploy \
  --template-file infrastructure/aws/cloudformation/ecs-cluster.yaml \
  --stack-name ecs-cluster \
  --parameter-overrides ClusterName=my-production-cluster DesiredCapacity=2 KeyName=keypair ImageTag=f570e0cdd1fb5241185955ddebf87ecdda39c295 \
  --capabilities CAPABILITY_NAMED_IAM

MSYS_NO_PATHCONV=1 aws ssm put-parameter \
  --name "/observability/adot-config" \
  --type "String" \
  --value file://infrastructure/aws/cloudformation/ecs-adot-config.yaml \
  --overwrite

aws cloudformation deploy \
  --template-file infrastructure/aws/cloudformation/app-build.yaml \
  --stack-name app-build \
  --parameter-overrides GitHubRepoUrl=https://github.com/realAbdullah4504/system-design.git GitHubBranch=stage-5 \
  --capabilities CAPABILITY_NAMED_IAM



## AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id "job-system/dev/cache/redis-password" --region us-east-1


## SNS and SQS Setup
aws sns create-topic \
    --name loadtest-events-topic

aws sqs create-queue \
  --queue-name loadtest-notification-queue

aws sqs create-queue \
  --queue-name loadtest-notification-dlq

aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/588738579221/loadtest-notification-queue \
  --attribute-names QueueArn

aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/588738579221/loadtest-notification-queue \
  --attributes '{
      "RedrivePolicy":"{\"maxReceiveCount\":\"3\", \"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:588738579221:notification-dlq\"}"
  }'

aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:588738579221:loadtest-events-topic \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:588738579221:my-app-jobs

aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1:588738579221/loadtest-notification-queue \
  --attributes '{"Policy":"{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"sqs:SendMessage\",\"Resource\":\"arn:aws:sqs:us-east-1:588738579221:loadtest-notification-queue\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"arn:aws:sns:us-east-1:588738579221:loadtest-events-topic\"}}}]}"}'

## Reaching server
curl -v https://sqs.us-east-1.amazonaws.com




## creating ecr repository
aws ecr create-repository --repository-name system-design-notification-worker --region us-east-1



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

docker build -f notification-Dockerfile -t notification-worker .
```

### Tag Docker Image
```bash
docker tag notification-service:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-service

docker tag worker-service:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/worker-service:latest

docker tag notification-worker:latest \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-worker:latest
```

### Push to ECR
```bash
docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-service:latest

docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/worker-service:latest

docker push \
588738579221.dkr.ecr.us-east-1.amazonaws.com/notification-worker:latest
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