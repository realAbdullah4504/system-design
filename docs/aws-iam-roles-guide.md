# AWS IAM Roles Guide: Service Roles vs Instance Roles vs Regular Roles

## Overview

AWS IAM roles are a secure way to grant permissions to entities that need temporary access to AWS resources. Different types of roles serve different purposes and are used by various AWS services and compute resources.

## Role Types

### 1. Service Roles
Service roles are assumed by AWS services to perform actions on your behalf.

**When to use:** When an AWS service needs to access other AWS resources.

**Common services requiring service roles:**

#### Compute Services
- **AWS Lambda** - To access other AWS services (DynamoDB, S3, SNS, etc.)
- **AWS ECS/EKS** - For container services to access AWS resources
- **AWS Batch** - To manage compute environments and job queues
- **AWS Glue** - To access data sources and targets
- **AWS EMR** - To access S3, DynamoDB, and other services

#### Analytics Services
- **Amazon Redshift** - For COPY/UNLOAD operations to S3
- **Amazon Athena** - To query data in S3 and Glue catalogs
- **AWS QuickSight** - To access data sources

#### Integration & Messaging
- **Amazon SNS** - To publish to other services
- **Amazon SQS** - For dead-letter queue configurations
- **AWS Step Functions** - To orchestrate other AWS services

#### Machine Learning
- **Amazon SageMaker** - To access training data, models, and endpoints
- **Amazon Comprehend** - To process text data
- **Amazon Rekognition** - To access images and videos

#### Management & Monitoring
- **AWS CloudFormation** - To manage stack resources
- **AWS CodeBuild/CodeDeploy/CodePipeline** - For CI/CD operations
- **Amazon CloudWatch** - To create alarms and metrics
- **AWS Config** - To track resource configuration changes

#### Security Services
- **AWS GuardDuty** - To analyze VPC flow logs and DNS logs
- **AWS Macie** - To discover and protect sensitive data
- **AWS Security Hub** - To aggregate security findings

### 2. Instance Roles (EC2 Instance Profile)
Instance roles are assumed by EC2 instances to access AWS resources securely.

**When to use:** When EC2 instances need to access AWS services without storing credentials on the instance.

**Common use cases:**

#### Application Servers
- Web servers accessing S3 for static assets
- Application servers connecting to DynamoDB
- API servers accessing SQS queues

#### Data Processing
- EMR clusters accessing S3 data
- Data processing instances writing to Redshift
- Log aggregation instances shipping to CloudWatch Logs

#### Monitoring & Management
- Monitoring instances accessing CloudWatch
- Backup instances accessing S3 for snapshots
- Management instances accessing Systems Manager

#### Development & Testing
- Build servers accessing CodeCommit
- Test instances accessing parameter store
- CI/CD runners accessing artifact repositories

### 3. Regular IAM Roles
Regular roles are assumed by users, applications, or services from outside AWS using STS.

**When to use:** For cross-account access, federation, or temporary credentials.

**Common use cases:**

#### Cross-Account Access
- Granting access to resources in another AWS account
- Sharing resources between development and production accounts
- Multi-account organizational access patterns

#### Federation & SSO
- Corporate identity federation (SAML, OIDC)
- Third-party identity providers
- Web identity federation (Facebook, Google, Amazon)

#### Application Access
- On-premises applications accessing AWS
- Mobile applications using temporary credentials
- Third-party services requiring AWS access

## Role Configuration Best Practices

### Principle of Least Privilege
- Grant only the permissions necessary for the specific task
- Use AWS managed policies as starting points
- Create custom policies for specific requirements

### Role Naming Conventions
```
Service Roles:    service-{ServiceName}-{Purpose}-{Environment}
Instance Roles:   instance-{Application}-{Purpose}-{Environment}
Regular Roles:    role-{Purpose}-{Environment}-{Account}
```

### Trust Relationships
#### Service Role Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### Cross-Account Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {}
    }
  ]
}
```

#### Federation Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT-ID:oidc-provider/oidc.example.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {}
    }
  ]
}
```

## Security Considerations

### Monitoring and Auditing
- Enable CloudTrail to log all role assumption events
- Use IAM Access Analyzer to identify unintended access
- Monitor role usage with CloudWatch metrics

### Rotation and Lifecycle
- Regularly review and rotate role permissions
- Use IAM Access Advisor to identify unused permissions
- Implement automated role cleanup processes

### Conditional Access
- Use condition keys to restrict role usage
- Implement IP restrictions for sensitive roles
- Use MFA requirements for human-assumable roles

## Common Patterns

### Microservices Architecture
```
API Gateway → Lambda (Service Role) → DynamoDB
EC2 Instance (Instance Role) → SQS → Lambda (Service Role) → S3
```

### Data Pipeline
```
Kinesis → Lambda (Service Role) → S3
EMR Cluster (Instance Role) → S3 → Redshift
```

### CI/CD Pipeline
```
CodeBuild (Service Role) → CodeCommit → ECR
CodeDeploy (Service Role) → EC2 (Instance Role)
```

## Troubleshooting

### Common Issues
1. **Trust Relationship Errors** - Verify the service principal is correct
2. **Permission Denied** - Check policy syntax and resource ARNs
3. **Role Chaining Limits** - AWS allows maximum 10 role assumptions
4. **Cross-Account Access** - Ensure both accounts have proper configurations

### Debugging Commands
```bash
# Get current caller identity
aws sts get-caller-identity

# Assume a role
aws sts assume-role --role-arn ARN --role-session-name SESSION

# List attached policies
aws iam list-attached-role-policies --role-name ROLE-NAME
```

## Conclusion

Choosing the right type of IAM role is crucial for maintaining security while enabling necessary functionality. Service roles are for AWS services, instance roles are for EC2 instances, and regular roles are for cross-account or federated access. Always follow the principle of least privilege and regularly review role configurations to ensure they remain secure and appropriate for their intended use.
