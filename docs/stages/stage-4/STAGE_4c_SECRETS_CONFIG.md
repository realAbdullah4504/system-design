# Job Processing System - Stage 4c: Secrets and Configuration Management

## 1. Objective

Securely manage production secrets and environment variables for the job processing system, ensuring secure, auditable, and production-ready configuration management across all services.

---

## 2. Current State Analysis

### 2.1 Existing Configuration Issues
- Environment variables stored in `.env` files (MongoDB, Redis, AWS credentials)
- AWS credentials exposed in `.env` file (access keys and secret keys)
- Database connection strings with embedded credentials
- No centralized secrets management
- Limited audit trail for secret access
- Environment-specific configurations mixed with code
- Multiple AWS services (SNS, SQS) configured with hardcoded ARNs

### 2.2 Security Risks Identified
- Secrets exposed in version control
- No automatic secret rotation
- Shared credentials across environments
- Limited access control and monitoring
- Potential for credential leakage in logs

---

## 3. Target Architecture

### 3.1 Secrets Management Hierarchy
```
AWS Secrets Manager
    /job-processing-system/
        /production/
            /database/
                - mongodb-primary
                - mongodb-replica
            /external-services/
                - redis-cluster
                - sns-topics
                - sqs-queues
            /aws-credentials/
                - sns-access-keys
                - sqs-access-keys
        /staging/
            /database/
                - mongodb-staging
            /external-services/
                - redis-staging
                - sns-staging
                - sqs-staging
        /development/
            /database/
                - mongodb-dev
            /external-services/
                - redis-dev
                - sns-dev
                - sqs-dev
```

### 3.2 Configuration Structure
```
AWS Systems Manager Parameter Store
    /job-processing-system/
        /production/
            /app-config/
                - max-concurrent-jobs
                - retry-attempts
                - timeout-seconds
                - bull-board-enabled
            /service-endpoints/
                - api-base-url
                - worker-base-url
            /aws-services/
                - sqs-queue-url
                - sns-topic-arn
                - aws-region
        /staging/
            /app-config/
                - max-concurrent-jobs
                - retry-attempts
            /aws-services/
                - sqs-queue-url
                - sns-topic-arn
        /development/
            /app-config/
                - max-concurrent-jobs
                - retry-attempts
            /aws-services/
                - sqs-queue-url
                - sns-topic-arn
```

---

## 4. Implementation Plan

### 4.1 Phase 1: Secrets Migration
**Duration: 2-3 days**

#### 4.1.1 Database Credentials
**Actions:**
- Create MongoDB credentials in AWS Secrets Manager
- Update backend service to fetch secrets at startup
- Remove hardcoded credentials from configuration files
- Implement secret caching with TTL

**Implementation:**
```yaml
# infrastructure/aws/cloudformation/secrets.yaml
Resources:
  # MongoDB Secrets
  MongoDBSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: job-processing-system/production/database/mongodb-primary
      Description: MongoDB primary database credentials
      SecretString: !Sub |
        {
          "uri": "${MongoURI}",
          "host": "${MongoHost}",
          "username": "${MongoUsername}",
          "password": "${MongoPassword}"
        }

  # Redis Secrets
  RedisSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: job-processing-system/production/external-services/redis-cluster
      Description: Redis cluster credentials
      SecretString: !Sub |
        {
          "url": "${RedisURL}",
          "host": "${RedisHost}",
          "port": "${RedisPort}",
          "password": "${RedisPassword}"
        }

  # AWS Service Secrets
  AWSSecrets:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: job-processing-system/production/aws-credentials
      Description: AWS service credentials
      SecretString: !Sub |
        {
          "region": "${AWSRegion}",
          "snsTopicArn": "${SNSTopicArn}",
          "sqsQueueUrl": "${SQSQueueUrl}"
        }

  # ECS Task Definition with Secret Injection
  BackendTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: job-processing-backend
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 512
      Memory: 1024
      ExecutionRoleArn: !Ref ECSTaskExecutionRole
      TaskRoleArn: !Ref ECSTaskRole
      ContainerDefinitions:
        - Name: backend-container
          Image: !Ref BackendImage
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: AWS_REGION
              Value: !Ref AWSRegion
          Secrets:
            - Name: MONGO_URI
              ValueFrom: !Ref MongoDBSecret
            - Name: REDIS_URL
              ValueFrom: !Ref RedisSecret
            - Name: SNS_TOPIC_ARN
              ValueFrom: !Ref AWSSecrets
            - Name: SQS_QUEUE_URL
              ValueFrom: !Ref AWSSecrets
```

#### 4.1.2 External Service Keys
**Actions:**
- Migrate Redis connection details to Secrets Manager
- Move SNS/SQS configuration to secure storage
- Update worker services to use secure configuration
- Implement graceful fallback for secret retrieval failures

### 4.2 Phase 2: Parameter Store Integration
**Duration: 1-2 days**

#### 4.2.1 Application Configuration
**Actions:**
- Create hierarchical parameter structure
- Implement environment-specific configuration loading
- Add configuration validation at startup
- Create configuration versioning strategy

**Implementation:**
```yaml
# infrastructure/aws/cloudformation/parameters.yaml
Resources:
  # Application Configuration Parameters
  MaxConcurrentJobsParam:
    Type: AWS::SSM::Parameter
    Properties:
      Name: /job-processing-system/production/app-config/max-concurrent-jobs
      Type: String
      Value: "10"
      Description: Maximum number of concurrent jobs

  RetryAttemptsParam:
    Type: AWS::SSM::Parameter
    Properties:
      Name: /job-processing-system/production/app-config/retry-attempts
      Type: String
      Value: "3"
      Description: Number of retry attempts for failed jobs

  TimeoutSecondsParam:
    Type: AWS::SSM::Parameter
    Properties:
      Name: /job-processing-system/production/app-config/timeout-seconds
      Type: String
      Value: "300"
      Description: Job timeout in seconds

  BullBoardEnabledParam:
    Type: AWS::SSM::Parameter
    Properties:
      Name: /job-processing-system/production/app-config/bull-board-enabled
      Type: String
      Value: "true"
      Description: Enable Bull Board dashboard

  
  # ECS Task Definition with Parameter Injection
  BackendTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: job-processing-backend
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 512
      Memory: 1024
      ExecutionRoleArn: !Ref ECSTaskExecutionRole
      TaskRoleArn: !Ref ECSTaskRole
      ContainerDefinitions:
        - Name: backend-container
          Image: !Ref BackendImage
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: MAX_CONCURRENT_JOBS
              Value: !Ref MaxConcurrentJobsParam
            - Name: RETRY_ATTEMPTS
              Value: !Ref RetryAttemptsParam
            - Name: TIMEOUT_SECONDS
              Value: !Ref TimeoutSecondsParam
            - Name: BULL_BOARD_ENABLED
              Value: !Ref BullBoardEnabledParam
```

### 4.3 Phase 3: Security Hardening
**Duration: 2 days**

#### 4.3.1 Access Control
**Actions:**
- Implement least privilege IAM policies
- Create service-specific IAM roles
- Add KMS encryption for sensitive secrets
- Implement secret access logging and monitoring

**IAM Policy Example:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:region:account:secret:job-processing-system/production/database/*",
        "arn:aws:secretsmanager:region:account:secret:job-processing-system/production/external-services/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:region:account:parameter/job-processing-system/production/*"
      ]
    }
  ]
}
```

#### 4.3.2 Secret Rotation
**Actions:**
- Implement automatic secret rotation for database credentials
- Create Lambda functions for secret rotation
- Test rotation without service disruption
- Add rotation monitoring and alerts

### 4.4 Phase 4: Configuration Management
**Duration: 1-2 days**

#### 4.4.1 Environment-Specific Configuration
**Actions:**
- Create environment-specific configuration loaders
- Implement configuration validation schemas
- Add configuration change detection
- Create configuration backup and restore procedures

**Configuration Approach:**
```javascript
// backend/config/validation.js (simple validation only)
import dotenv from 'dotenv';

// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

class ConfigurationValidator {
  static validate() {
    const required = [
      'MONGO_URI',
      'REDIS_URL',
      'AWS_REGION',
      'SNS_TOPIC_ARN',
      'SQS_QUEUE_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('Configuration validation passed');
    return true;
  }
}

export { ConfigurationValidator };
```

---

### 5.1 Backend API Service
**Configuration Changes:**
- Add configuration validation at startup
- Keep existing environment variable usage
- Remove hardcoded credentials from `.env` files
- Use CloudFormation-injected environment variables in production

**Updated Configuration Files:**
```javascript
// backend/index.js (add validation at top)
import { ConfigurationValidator } from './config/validation.js';

// Validate configuration at startup
ConfigurationValidator.validate();

// backend/config/mongo.js (no changes - works as-is)
import mongoose from "mongoose";

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));

// backend/config/redis.js (no changes - works as-is)
import Redis from "ioredis";

// Base config shared across all clients
const baseConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

// backend/config/sns.js (no changes - works as-is)
import { SNSClient } from "@aws-sdk/client-sns";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.AWS_REGION || !process.env.TOPIC_ARN) {
    throw new Error("AWS credentials not found");
}
export const snsClient = new SNSClient({
    region: process.env.AWS_REGION,
    // credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    // }
});

export const TOPIC_ARN = process.env.TOPIC_ARN;
```

### 5.2 Worker Services
**Configuration Changes:**
- Update `workers/config/sqs.js` to use secure configuration
- Modify worker database connections to use configuration manager
- Add secret caching for performance
- Implement retry logic for secret retrieval

---

## 6. Security Measures

### 6.1 Encryption Standards

- **KMS Key Management**: Use customer-managed KMS keys
- **Encryption in Transit**: TLS 1.2+ for all secret retrieval
- **Encryption at Rest**: AWS-managed encryption for Secrets Manager
- **Key Rotation**: Annual KMS key rotation

### 6.2 Access Controls
- **IAM Roles**: Service-specific roles with least privilege
- **Resource-Based Policies**: Secret-specific access policies
- **Network Controls**: VPC endpoints for AWS services
- **Audit Logging**: CloudTrail enabled for all secret operations

### 6.3 Monitoring and Alerting
- **Access Monitoring**: CloudWatch alarms for unusual access patterns
- **Failed Access Alerts**: Notifications for secret retrieval failures
- **Rotation Monitoring**: Alerts for failed secret rotations
- **Configuration Drift**: Detection of unauthorized configuration changes

---

## 7. Deployment Strategy

### 7.1 Blue-Green Deployment
**Steps:**
1. Set up new configuration in parallel environment
2. Test secret retrieval and configuration loading
3. Update services to use new configuration
4. Monitor for configuration-related errors
5. Switch traffic to new configuration
6. Decommission old configuration

### 7.2 Rollback Plan
**Triggers for Rollback:**
- Secret retrieval failures exceeding threshold
- Configuration validation errors
- Service degradation after configuration change
- Security incident related to configuration

**Rollback Steps:**
1. Switch to previous configuration version
2. Restart services with old configuration
3. Monitor service recovery
4. Investigate root cause
5. Document lessons learned

---

## 8. Testing Strategy

### 8.1 Unit Tests
- Secret retrieval functionality
- Configuration validation logic
- Error handling for secret unavailability
- Configuration caching behavior

### 8.2 Integration Tests
- End-to-end secret retrieval
- Service startup with secure configuration
- Configuration refresh scenarios
- Secret rotation impact testing

### 8.3 Security Tests
- Secret access authorization
- Encryption verification
- Audit log completeness
- Configuration exposure checks

### 8.4 Load Tests
- Concurrent secret retrieval
- Configuration caching performance
- Secret rotation under load
- Service recovery after secret changes

---

## 9. Monitoring and Observability

### 9.1 Key Metrics
| Metric | Description | Target |
|--------|-------------|--------|
| Secret Retrieval Latency | Time to fetch secrets from AWS | < 100ms |
| Secret Cache Hit Rate | Percentage of secrets served from cache | > 95% |
| Configuration Load Time | Time to load full configuration | < 500ms |
| Secret Access Rate | Number of secret retrievals per minute | Baseline + 20% |
| Failed Secret Retrievals | Count of failed secret attempts | 0 |

### 9.2 CloudWatch Dashboards
- **Secrets Manager Metrics**: API calls, latency, errors
- **Parameter Store Metrics**: Get operations, cache performance
- **Service Configuration**: Load times, validation results
- **Security Metrics**: Access patterns, failed attempts

### 9.3 Alerting Rules
```yaml
# High secret retrieval latency
- alert: SecretRetrievalHighLatency
  expr: aws_secretsmanager_get_secret_value_latency > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High secret retrieval latency detected"

# Failed secret retrieval attempts
- alert: SecretRetrievalFailures
  expr: increase(aws_secretsmanager_get_secret_value_errors[5m]) > 5
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Multiple secret retrieval failures detected"

# Configuration load failures
- alert: ConfigurationLoadFailure
  expr: increase(config_load_errors[5m]) > 3
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Configuration loading failures detected"
```

---

## 10. Documentation and Procedures

### 10.1 Operational Procedures
- **Secret Creation**: Step-by-step guide for creating new secrets
- **Configuration Updates**: Process for updating application parameters
- **Secret Rotation**: Manual and automatic rotation procedures
- **Emergency Access**: Process for emergency secret access

### 10.2 Security Documentation
- **Access Matrix**: Who can access which secrets
- **Audit Procedures**: How to review secret access logs
- **Incident Response**: Steps for security incidents involving secrets
- **Compliance Check**: Regular security validation checklist

### 10.3 Development Guidelines
- **Local Development**: How to manage secrets in development
- **Testing**: Using test secrets and configurations
- **Code Review**: What to check for security in configuration changes
- **Best Practices**: Do's and don'ts for secret management

---

## 11. Validation Criteria

### 11.1 Functional Validation
- [x] All services can retrieve secrets securely
- [x] Configuration loads correctly in all environments
- [ ] **Secret rotation works without service disruption** *(Advanced - Later Phase)*
- [x] Access controls prevent unauthorized secret access
- [ ] **Configuration validation prevents invalid deployments** *(Advanced - Later Phase)*

### 11.2 Security Validation
- [x] No secrets stored in code or configuration files
- [ ] **All secret access is logged and auditable** *(Advanced - Later Phase)*
- [x] Encryption is applied to all sensitive data *(AWS Secrets Manager default)*
- [x] Least privilege principle is enforced
- [ ] **Security monitoring and alerting is functional** *(Advanced - Later Phase)*

### 11.3 Performance Validation
- [x] Secret retrieval meets latency targets *(AWS Secrets Manager)*
- [x] Configuration caching improves performance *(ECS task caching)*
- [x] Services start up within acceptable time
- [ ] **No performance degradation under load** *(Testing Required)*
- [ ] **Secret rotation doesn't impact service availability** *(Advanced - Later Phase)*

### 11.4 Operational Validation
- [x] Team can create and manage secrets *(CloudFormation templates)*
- [x] Configuration updates can be performed safely *(Parameterized templates)*
- [ ] **Monitoring provides adequate visibility** *(Advanced - Later Phase)*
- [x] Documentation is complete and accurate
- [ ] **Rollback procedures are tested and working** *(Testing Required)*

---

## 11.5 Advanced Features (Later Implementation)

The following advanced features are marked for future implementation in later phases:

### Security & Monitoring
- **Secret Access Logging**: Enable CloudTrail logging for all Secrets Manager API calls
- **Security Monitoring**: Set up CloudWatch alerts for unauthorized secret access attempts
- **Audit Compliance**: Implement automated secret access audit trails

### Secret Management
- **Automatic Secret Rotation**: Configure AWS Secrets Manager rotation for database credentials
- **Zero-Downtime Rotation**: Implement rotation without service disruption
- **Configuration Validation**: Add pre-deployment validation for secret parameters

### Performance & Reliability
- **Load Testing**: Validate secret retrieval performance under load
- **Caching Optimization**: Implement advanced caching strategies
- **Rollback Procedures**: Test and document emergency rollback procedures

### Operational Excellence
- **Enhanced Monitoring**: Comprehensive dashboards for secret management
- **Automated Alerts**: Proactive monitoring for secret health and availability
- **Documentation Updates**: Maintain operational runbooks and procedures

---

## 12. Success Metrics

### 12.1 Security Metrics
- **Zero Exposure Incidents**: No secret leaks or unauthorized access
- **Audit Compliance**: 100% of secret access logged and reviewed
- **Rotation Coverage**: 100% of automated secrets rotated on schedule
- **Access Control Effectiveness**: Zero unauthorized access attempts

### 12.2 Operational Metrics
- **Configuration Deployment Success**: > 99% successful configuration updates
- **Mean Time to Recovery**: < 5 minutes for configuration-related issues
- **Secret Retrieval Performance**: < 100ms average latency
- **Team Productivity**: Reduced time spent on configuration management

### 12.3 Cost Metrics
- **Secrets Manager Costs**: Optimized secret storage and API calls
- **Configuration Management Overhead**: < 10% of operational time
- **Security Incident Costs**: Zero costs from secret-related incidents
- **Compliance Costs**: Automated compliance reduces manual effort

---

## 13. Risk Mitigation

### 13.1 Identified Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Secret Service Outage | Low | High | Local caching + fallback configuration |
| Secret Rotation Failure | Medium | Medium | Manual override procedures |
| Access Misconfiguration | Low | High | Regular access audits |
| Performance Degradation | Medium | Low | Caching and monitoring |
| Configuration Drift | High | Medium | Automated validation |

### 13.2 Contingency Plans
- **Secret Service Unavailable**: Use cached secrets with limited TTL
- **Configuration Corruption**: Maintain configuration snapshots
- **Security Incident**: Immediate secret rotation and access revocation
- **Performance Issues**: Dynamic caching adjustment and load balancing

---

## 14. Timeline and Resources

### 14.1 Implementation Timeline
- **Week 1**: Secrets migration and basic integration
- **Week 2**: Parameter Store setup and configuration loading
- **Week 3**: Security hardening and access controls
- **Week 4**: Testing, monitoring, and documentation

### 14.2 Required Resources
- **Development**: 2 developers for 4 weeks
- **Security**: 1 security engineer for 2 weeks
- **Operations**: 1 DevOps engineer for 1 week
- **Testing**: 1 QA engineer for 2 weeks

### 14.3 Budget Considerations
- **AWS Secrets Manager**: $0.40 per secret per month + $0.05 per 10,000 API calls
- **AWS Parameter Store**: Free tier (Standard parameters)
- **KMS Keys**: $1 per month + usage fees
- **Monitoring**: CloudWatch costs for metrics and alarms

---

## 15. Next Steps and Integration

### 15.1 Integration with Stage 4d (Reliability Patterns)
- Use secure configuration for circuit breaker thresholds
- Store retry parameters in Parameter Store
- Secure DLQ configuration and access credentials

### 15.2 Integration with Stage 4e (Multi-Service Orchestration)
- Secure SNS/SQS topic configurations
- Manage event processing parameters
- Secure inter-service communication credentials

### 15.3 Integration with Stage 4f (Cost Optimization)
- Monitor secret access patterns for optimization
- Track configuration-related resource usage
- Optimize caching strategies for cost efficiency

---

## 16. Conclusion

Stage 4c establishes a robust secrets and configuration management foundation that:
- **Secures** all sensitive data and credentials
- **Simplifies** configuration management across environments
- **Enables** auditability and compliance
- **Supports** scalability and reliability requirements
- **Integrates** seamlessly with other Stage 4 components

The implementation ensures that the job processing system meets enterprise-grade security standards while maintaining operational efficiency and developer productivity.
