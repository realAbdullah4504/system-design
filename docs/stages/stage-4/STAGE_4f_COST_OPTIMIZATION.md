# Job Processing System - Stage 4f: Cost Optimization and Auto-Scaling

## 1. Objective

Optimize resource usage and cost for production workloads through auto-scaling policies, resource optimization, monitoring-driven scaling thresholds, and load simulation to validate cost-effective scaling strategies.

---

## 2. Current State Analysis

### 2.1 Existing Resource Usage Issues
- Fixed-size infrastructure regardless of workload
- Over-provisioned resources during low traffic periods
- Manual scaling decisions based on estimates
- Limited visibility into cost per component
- No automated resource optimization
- Static allocation across all environments
- Lack of cost-performance metrics

### 2.2 Cost Inefficiencies Identified
- Idle EC2 instances during off-peak hours
- Over-provisioned memory and CPU for most workloads
- No spot instance utilization for fault-tolerant workloads
- Fixed database capacity regardless of actual usage
- Manual resource provisioning delays
- Lack of reserved instance planning
- No cost allocation by service or team

---

## 3. Target Architecture

### 3.1 Auto-Scaling Hierarchy
```
Application Layer
    ECS Service Auto-Scaling
        Task Auto-Scaling
            Container Resource Optimization
                Instance Auto-Scaling
                    Spot Instance Management
                        Cost Monitoring & Optimization
                            Performance Metrics Collection
```

### 3.2 Scaling Decision Flow
```
Metrics Collection
    │
    ├─> CPU Utilization
    ├─> Memory Usage
    ├─> Queue Depth
    ├─> Response Time
    ├─> Error Rate
    └─> Custom Business Metrics
         │
         ▼
Scaling Decision Engine
    │
    ├─> Scale-Out Conditions
    ├─> Scale-In Conditions
    ├─> Predictive Scaling
    └─> Cost Optimization Rules
         │
         ▼
Resource Adjustment
    │
    ├─> Add Tasks/Instances
    ├─> Remove Tasks/Instances
    ├─> Switch Instance Types
    └─> Utilize Spot Instances
```

### 3.3 Cost Optimization Strategy
```
Resource Analysis
    │
    ├─> Usage Patterns Analysis
    ├─> Performance Requirements
    ├─> Cost per Performance Unit
    └─> SLA Requirements
         │
         ▼
Optimization Actions
    │
    ├─> Right-Sizing Resources
    ├─> Spot Instance Adoption
    ├─> Reserved Instance Planning
    ├─> Scheduling Policies
    └─> Architecture Optimization
```

---

## 4. Implementation Plan

### 4.1 Phase 1: Auto-Scaling Infrastructure Setup
**Duration: 3-4 days**

#### 4.1.1 ECS Service Auto-Scaling
**Actions:**
- Configure ECS service auto-scaling policies
- Set up target tracking scaling
- Implement step scaling policies
- Add scheduled scaling for predictable patterns

**Implementation:**
```javascript
// infrastructure/auto-scaling/ecs-auto-scaling.js
const AWS = require('aws-sdk');
const ecs = new AWS.ECS();
const cloudWatch = new AWS.CloudWatch();

class ECSAutoScaling {
  constructor() {
    this.services = {
      backend: {
        serviceName: 'job-processing-backend',
        cluster: 'job-processing-cluster',
        minCapacity: 2,
        maxCapacity: 20,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80
      },
      workers: {
        serviceName: 'job-processing-workers',
        cluster: 'job-processing-cluster',
        minCapacity: 1,
        maxCapacity: 50,
        targetCpuUtilization: 80,
        targetMemoryUtilization: 85
      }
    };
  }

  async setupAutoScaling() {
    for (const [service, config] of Object.entries(this.services)) {
      await this.createScalingPolicy(service, config);
      await this.createCloudWatchAlarms(service, config);
      await this.setupScheduledScaling(service, config);
    }
  }

  async createScalingPolicy(serviceName, config) {
    const params = {
      ServiceNamespace: 'ecs',
      ResourceId: `service/${config.cluster}/${config.serviceName}`,
      ScalableDimension: 'ecs:service:DesiredCount',
      PolicyName: `${serviceName}-target-tracking`,
      PolicyType: 'TargetTrackingScaling',
      TargetTrackingScalingPolicyConfiguration: {
        TargetValue: config.targetCpuUtilization,
        PredefinedMetricSpecification: {
          PredefinedMetricType: 'ECSServiceAverageCPUUtilization'
        },
        ScaleInCooldown: 300, // 5 minutes
        ScaleOutCooldown: 60, // 1 minute
        DisableScaleIn: false
      }
    };

    try {
      await new AWS.ApplicationAutoScaling().putScalingPolicy(params).promise();
      console.log(`Created scaling policy for ${serviceName}`);
    } catch (error) {
      console.error(`Failed to create scaling policy for ${serviceName}:`, error);
      throw error;
    }
  }

  async createCloudWatchAlarms(serviceName, config) {
    const alarms = [
      {
        AlarmName: `${serviceName}-high-cpu`,
        MetricName: 'CPUUtilization',
        Threshold: 85,
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 2,
        TreatMissingData: 'missing'
      },
      {
        AlarmName: `${serviceName}-high-memory`,
        MetricName: 'MemoryUtilization',
        Threshold: 90,
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 2,
        TreatMissingData: 'missing'
      },
      {
        AlarmName: `${serviceName}-queue-depth-high`,
        MetricName: 'ApproximateNumberOfMessagesVisible',
        Threshold: 100,
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 3,
        TreatMissingData: 'notBreaching'
      }
    ];

    for (const alarm of alarms) {
      await this.createAlarm(serviceName, alarm, config);
    }
  }

  async createAlarm(serviceName, alarmConfig, config) {
    const params = {
      AlarmName: `${config.serviceName}-${alarmConfig.AlarmName}`,
      AlarmDescription: `Alarm for ${serviceName} ${alarmConfig.MetricName}`,
      Namespace: 'AWS/ECS',
      MetricName: alarmConfig.MetricName,
      Dimensions: [
        {
          Name: 'ServiceName',
          Value: config.serviceName
        },
        {
          Name: 'ClusterName',
          Value: config.cluster
        }
      ],
      Threshold: alarmConfig.Threshold,
      ComparisonOperator: alarmConfig.ComparisonOperator,
      EvaluationPeriods: alarmConfig.EvaluationPeriods,
      Period: 300, // 5 minutes
      Statistic: 'Average',
      TreatMissingData: alarmConfig.TreatMissingData,
      AlarmActions: [
        `arn:aws:autoscaling:...:scalingPolicy:...:resource/ecs/service/${config.cluster}/${config.serviceName}`
      ]
    };

    try {
      await cloudWatch.putMetricAlarm(params).promise();
      console.log(`Created alarm: ${params.AlarmName}`);
    } catch (error) {
      console.error(`Failed to create alarm ${params.AlarmName}:`, error);
    }
  }

  async setupScheduledScaling(serviceName, config) {
    // Scheduled scaling for predictable patterns
    const schedules = [
      {
        Name: `${serviceName}-business-hours-scale-up`,
        Schedule: 'cron(0 8 * * MON-FRI)', // Weekdays 8 AM
        ScalableTargetAction: {
          MinCapacity: config.minCapacity * 2,
          MaxCapacity: config.maxCapacity
        }
      },
      {
        Name: `${serviceName}-after-hours-scale-down`,
        Schedule: 'cron(0 20 * * MON-FRI)', // Weekdays 8 PM
        ScalableTargetAction: {
          MinCapacity: config.minCapacity,
          MaxCapacity: config.maxCapacity / 2
        }
      }
    ];

    for (const schedule of schedules) {
      await this.createScheduledAction(serviceName, schedule, config);
    }
  }

  async createScheduledAction(serviceName, schedule, config) {
    const params = {
      ServiceNamespace: 'ecs',
      ResourceId: `service/${config.cluster}/${config.serviceName}`,
      ScalableDimension: 'ecs:service:DesiredCount',
      ScheduledActionName: schedule.Name,
      Schedule: schedule.Schedule,
      ScalableTargetAction: schedule.ScalableTargetAction
    };

    try {
      await new AWS.ApplicationAutoScaling().putScheduledAction(params).promise();
      console.log(`Created scheduled action: ${schedule.Name}`);
    } catch (error) {
      console.error(`Failed to create scheduled action ${schedule.Name}:`, error);
    }
  }
}

module.exports = ECSAutoScaling;
```

#### 4.1.2 EC2 Instance Auto-Scaling
**Actions:**
- Create auto-scaling groups for different instance types
- Configure mixed instances policy with spot instances
- Set up instance type optimization
- Implement lifecycle hooks for graceful termination

### 4.2 Phase 2: Resource Optimization
**Duration: 3-4 days**

#### 4.2.1 Resource Usage Analysis
**Actions:**
- Implement resource usage monitoring
- Analyze historical usage patterns
- Identify over-provisioned resources
- Create right-sizing recommendations

**Implementation:**
```javascript
// optimization/resource-analyzer.js
class ResourceAnalyzer {
  constructor() {
    this.cloudWatch = new AWS.CloudWatch();
    this.costExplorer = new AWS.CostExplorer();
    this.ec2 = new AWS.ECS();
  }

  async analyzeResourceUsage() {
    const analysis = {
      services: await this.analyzeServices(),
      instances: await this.analyzeInstances(),
      databases: await this.analyzeDatabases(),
      storage: await this.analyzeStorage()
    };

    return this.generateOptimizationRecommendations(analysis);
  }

  async analyzeServices() {
    const services = ['job-processing-backend', 'job-processing-workers'];
    const analysis = {};

    for (const service of services) {
      const metrics = await this.getServiceMetrics(service);
      const costs = await this.getServiceCosts(service);

      analysis[service] = {
        currentConfig: await this.getServiceConfig(service),
        utilization: metrics,
        costs: costs,
        recommendations: this.generateServiceRecommendations(metrics, costs)
      };
    }

    return analysis;
  }

  async getServiceMetrics(service) {
    const metrics = ['CPUUtilization', 'MemoryUtilization'];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const results = {};
    for (const metric of metrics) {
      const params = {
        Namespace: 'AWS/ECS',
        MetricName: metric,
        Dimensions: [
          {
            Name: 'ServiceName',
            Value: service
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour
        Statistics: ['Average', 'Maximum', 'Minimum']
      };

      try {
        const data = await this.cloudWatch.getMetricStatistics(params).promise();
        results[metric] = this.processMetricData(data.Datapoints);
      } catch (error) {
        console.error(`Failed to get metrics for ${service} ${metric}:`, error);
        results[metric] = null;
      }
    }

    return results;
  }

  processMetricData(datapoints) {
    if (!datapoints || datapoints.length === 0) {
      return null;
    }

    const values = datapoints.map(dp => dp.Average);
    return {
      average: values.reduce((a, b) => a + b, 0) / values.length,
      maximum: Math.max(...datapoints.map(dp => dp.Maximum)),
      minimum: Math.min(...datapoints.map(dp => dp.Minimum)),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };
  }

  calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  generateServiceRecommendations(metrics, costs) {
    const recommendations = [];

    if (metrics && metrics.CPUUtilization) {
      const cpu = metrics.CPUUtilization;
      
      if (cpu.average < 30) {
        recommendations.push({
          type: 'right_size',
          priority: 'high',
          description: 'CPU utilization is consistently low. Consider reducing CPU allocation.',
          potentialSavings: this.calculatePotentialSavings(costs, 0.3),
          action: 'reduce_cpu_by_50%'
        });
      }

      if (cpu.p95 < 50) {
        recommendations.push({
          type: 'right_size',
          priority: 'medium',
          description: 'CPU utilization rarely exceeds 50%. Consider moderate reduction.',
          potentialSavings: this.calculatePotentialSavings(costs, 0.2),
          action: 'reduce_cpu_by_25%'
        });
      }
    }

    if (metrics && metrics.MemoryUtilization) {
      const memory = metrics.MemoryUtilization;
      
      if (memory.average < 40) {
        recommendations.push({
          type: 'right_size',
          priority: 'high',
          description: 'Memory utilization is consistently low. Consider reducing memory allocation.',
          potentialSavings: this.calculatePotentialSavings(costs, 0.25),
          action: 'reduce_memory_by_50%'
        });
      }
    }

    return recommendations;
  }

  calculatePotentialSavings(costs, reductionPercentage) {
    const monthlyCost = costs.monthly || 0;
    return monthlyCost * reductionPercentage;
  }

  async getServiceCosts(service) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

    const params = {
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0]
      },
      Granularity: 'MONTHLY',
      Metrics: ['BlendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE'
        }
      ],
      Filter: {
        Dimensions: {
          Key: 'SERVICE',
          Values: ['Amazon EC2 Container Service']
        }
      }
    };

    try {
      const data = await this.costExplorer.getCostAndUsage(params).promise();
      return {
        monthly: data.ResultsByTime[0].Total.BlendedCost.Amount,
        currency: data.ResultsByTime[0].Total.BlendedCost.Unit
      };
    } catch (error) {
      console.error(`Failed to get costs for ${service}:`, error);
      return { monthly: 0, currency: 'USD' };
    }
  }
}

module.exports = ResourceAnalyzer;
```

#### 4.2.2 Spot Instance Implementation
**Actions:**
- Configure mixed instances policy
- Implement spot instance interruption handling
- Set up fallback to on-demand instances
- Monitor spot price trends

### 4.3 Phase 3: Monitoring-Driven Scaling
**Duration: 2-3 days**

#### 4.3.1 Custom Metrics Integration
**Actions:**
- Implement business metrics for scaling decisions
- Add queue depth-based scaling
- Create custom performance metrics
- Set up predictive scaling

**Implementation:**
```javascript
// scaling/custom-metrics.js
class CustomMetricsCollector {
  constructor() {
    this.cloudWatch = new AWS.CloudWatch();
    this.sqs = new AWS.SQS();
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async publishCustomMetrics() {
    const metrics = await this.collectMetrics();
    
    for (const metric of metrics) {
      await this.publishMetric(metric);
    }
  }

  async collectMetrics() {
    return [
      await this.getQueueDepthMetrics(),
      await this.getProcessingLatencyMetrics(),
      await this.getErrorRateMetrics(),
      await this.getBusinessMetrics(),
      await this.getCostMetrics()
    ];
  }

  async getQueueDepthMetrics() {
    const queues = [
      'job-processing-queue',
      'high-priority-queue',
      'low-priority-queue'
    ];

    const metrics = [];
    for (const queueUrl of queues) {
      try {
        const attributes = await this.sqs.getQueueAttributes({
          QueueUrl: queueUrl,
          AttributeNames: ['ApproximateNumberOfMessagesVisible']
        }).promise();

        const depth = parseInt(attributes.Attributes.ApproximateNumberOfMessagesVisible);
        
        metrics.push({
          Namespace: 'JobProcessing',
          MetricName: 'QueueDepth',
          Dimensions: [
            { Name: 'QueueName', Value: queueUrl.split('/').pop() }
          ],
          Value: depth,
          Unit: 'Count'
        });
      } catch (error) {
        console.error(`Failed to get queue depth for ${queueUrl}:`, error);
      }
    }

    return metrics;
  }

  async getProcessingLatencyMetrics() {
    try {
      const avgLatency = await this.redis.get('metrics:avg_processing_latency');
      const p95Latency = await this.redis.get('metrics:p95_processing_latency');
      const p99Latency = await this.redis.get('metrics:p99_processing_latency');

      return [
        {
          Namespace: 'JobProcessing',
          MetricName: 'ProcessingLatency',
          Dimensions: [{ Name: 'Statistic', Value: 'Average' }],
          Value: parseFloat(avgLatency) || 0,
          Unit: 'Milliseconds'
        },
        {
          Namespace: 'JobProcessing',
          MetricName: 'ProcessingLatency',
          Dimensions: [{ Name: 'Statistic', Value: 'P95' }],
          Value: parseFloat(p95Latency) || 0,
          Unit: 'Milliseconds'
        },
        {
          Namespace: 'JobProcessing',
          MetricName: 'ProcessingLatency',
          Dimensions: [{ Name: 'Statistic', Value: 'P99' }],
          Value: parseFloat(p99Latency) || 0,
          Unit: 'Milliseconds'
        }
      ];
    } catch (error) {
      console.error('Failed to get processing latency metrics:', error);
      return [];
    }
  }

  async getErrorRateMetrics() {
    try {
      const totalJobs = await this.redis.get('metrics:total_jobs_processed');
      const failedJobs = await this.redis.get('metrics:failed_jobs');
      
      const errorRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;

      return [
        {
          Namespace: 'JobProcessing',
          MetricName: 'ErrorRate',
          Dimensions: [{ Name: 'Service', Value: 'Worker' }],
          Value: errorRate,
          Unit: 'Percent'
        }
      ];
    } catch (error) {
      console.error('Failed to get error rate metrics:', error);
      return [];
    }
  }

  async getBusinessMetrics() {
    try {
      const activeUsers = await this.redis.get('metrics:active_users');
      const jobsPerMinute = await this.redis.get('metrics:jobs_per_minute');
      const revenuePerHour = await this.redis.get('metrics:revenue_per_hour');

      return [
        {
          Namespace: 'JobProcessing',
          MetricName: 'ActiveUsers',
          Dimensions: [{ Name: 'Application', Value: 'JobProcessing' }],
          Value: parseInt(activeUsers) || 0,
          Unit: 'Count'
        },
        {
          Namespace: 'JobProcessing',
          MetricName: 'JobsPerMinute',
          Dimensions: [{ Name: 'Application', Value: 'JobProcessing' }],
          Value: parseFloat(jobsPerMinute) || 0,
          Unit: 'Count'
        },
        {
          Namespace: 'JobProcessing',
          MetricName: 'RevenuePerHour',
          Dimensions: [{ Name: 'Application', Value: 'JobProcessing' }],
          Value: parseFloat(revenuePerHour) || 0,
          Unit: 'USD'
        }
      ];
    } catch (error) {
      console.error('Failed to get business metrics:', error);
      return [];
    }
  }

  async getCostMetrics() {
    try {
      const costPerJob = await this.redis.get('metrics:cost_per_job');
      const costPerMinute = await this.redis.get('metrics:cost_per_minute');

      return [
        {
          Namespace: 'JobProcessing',
          MetricName: 'CostPerJob',
          Dimensions: [{ Name: 'Cost', Value: 'PerJob' }],
          Value: parseFloat(costPerJob) || 0,
          Unit: 'USD'
        },
        {
          Namespace: 'JobProcessing',
          MetricName: 'CostPerMinute',
          Dimensions: [{ Name: 'Cost', Value: 'PerMinute' }],
          Value: parseFloat(costPerMinute) || 0,
          Unit: 'USD'
        }
      ];
    } catch (error) {
      console.error('Failed to get cost metrics:', error);
      return [];
    }
  }

  async publishMetric(metric) {
    const params = {
      Namespace: metric.Namespace,
      MetricName: metric.MetricName,
      Dimensions: metric.Dimensions,
      Value: metric.Value,
      Unit: metric.Unit,
      Timestamp: new Date()
    };

    try {
      await this.cloudWatch.putMetricData({
        MetricData: [params]
      }).promise();
    } catch (error) {
      console.error(`Failed to publish metric ${metric.MetricName}:`, error);
    }
  }
}

module.exports = CustomMetricsCollector;
```

### 4.4 Phase 4: Load Simulation and Validation
**Duration: 2-3 days**

#### 4.4.1 Load Testing Framework
**Actions:**
- Create load testing scenarios
- Simulate different traffic patterns
- Validate scaling behavior
- Measure cost-performance trade-offs

---

## 5. Auto-Scaling Configurations

### 5.1 ECS Service Scaling
```yaml
# auto-scaling/ecs-config.yml
services:
  backend:
    min_capacity: 2
    max_capacity: 20
    target_cpu: 70
    target_memory: 80
    scale_out_cooldown: 60
    scale_in_cooldown: 300
    
    scaling_policies:
      - name: cpu_tracking
        type: target_tracking
        metric: CPUUtilization
        target: 70
        
      - name: memory_tracking
        type: target_tracking
        metric: MemoryUtilization
        target: 80
        
      - name: queue_depth
        type: step_scaling
        metric: QueueDepth
        steps:
          - lower_bound: 0
            upper_bound: 50
            scaling_adjustment: 0
          - lower_bound: 50
            upper_bound: 100
            scaling_adjustment: 2
          - lower_bound: 100
            upper_bound: null
            scaling_adjustment: 5

  workers:
    min_capacity: 1
    max_capacity: 50
    target_cpu: 80
    target_memory: 85
    scale_out_cooldown: 30
    scale_in_cooldown: 120
    
    scaling_policies:
      - name: cpu_tracking
        type: target_tracking
        metric: CPUUtilization
        target: 80
        
      - name: queue_depth_based
        type: target_tracking
        metric: QueueDepth
        target: 10
        
      - name: latency_based
        type: step_scaling
        metric: ProcessingLatency
        steps:
          - lower_bound: 0
            upper_bound: 1000
            scaling_adjustment: 0
          - lower_bound: 1000
            upper_bound: 5000
            scaling_adjustment: 3
          - lower_bound: 5000
            upper_bound: null
            scaling_adjustment: 10
```

### 5.2 EC2 Auto-Scaling Groups
```yaml
# auto-scaling/ec2-config.yml
auto_scaling_groups:
  backend_instances:
    min_size: 2
    max_size: 10
    desired_capacity: 3
    
    mixed_instances_policy:
      instances_distribution:
        on_demand_base_capacity: 1
        on_demand_percentage_above_base_capacity: 50
        spot_allocation_strategy: capacity-optimized
        
      launch_template:
        launch_template_specification:
          launch_template_name: job-processing-backend
          version: '$Latest'
          
        overrides:
          - instance_type: t3.medium
            weighted_capacity: 1
          - instance_type: t3.large
            weighted_capacity: 2
          - instance_type: m5.large
            weighted_capacity: 2
            
  worker_instances:
    min_size: 1
    max_size: 20
    desired_capacity: 2
    
    mixed_instances_policy:
      instances_distribution:
        on_demand_base_capacity: 0
        on_demand_percentage_above_base_capacity: 20
        spot_allocation_strategy: capacity-optimized
        
      launch_template:
        launch_template_specification:
          launch_template_name: job-processing-workers
          version: '$Latest'
          
        overrides:
          - instance_type: c5.large
            weighted_capacity: 1
          - instance_type: c5.xlarge
            weighted_capacity: 2
          - instance_type: m5.large
            weighted_capacity: 1
```

---

## 6. Cost Optimization Strategies

### 6.1 Right-Sizing Recommendations
```javascript
// optimization/right-sizing.js
class RightSizingOptimizer {
  constructor() {
    this.analyzer = new ResourceAnalyzer();
    this.recommendations = [];
  }

  async generateRightSizingPlan() {
    const analysis = await this.analyzer.analyzeResourceUsage();
    
    for (const [service, data] of Object.entries(analysis.services)) {
      const recommendations = this.generateServiceRightSizing(service, data);
      this.recommendations.push(...recommendations);
    }

    return {
      summary: this.generateSummary(),
      recommendations: this.recommendations,
      estimatedSavings: this.calculateTotalSavings(),
      implementationPlan: this.createImplementationPlan()
    };
  }

  generateServiceRightSizing(serviceName, serviceData) {
    const recommendations = [];
    const { utilization, currentConfig } = serviceData;

    if (utilization && utilization.CPUUtilization) {
      const cpu = utilization.CPUUtilization;
      
      if (cpu.average < 30 && cpu.p95 < 50) {
        recommendations.push({
          service: serviceName,
          type: 'cpu_rightsize',
          current: currentConfig.cpu,
          recommended: Math.ceil(currentConfig.cpu * 0.5),
          reason: 'CPU utilization consistently low',
          confidence: 0.9,
          estimatedSavings: this.calculateSavings(serviceName, 'cpu', 0.5)
        });
      } else if (cpu.average < 50 && cpu.p95 < 70) {
        recommendations.push({
          service: serviceName,
          type: 'cpu_rightsize',
          current: currentConfig.cpu,
          recommended: Math.ceil(currentConfig.cpu * 0.75),
          reason: 'CPU utilization moderate',
          confidence: 0.7,
          estimatedSavings: this.calculateSavings(serviceName, 'cpu', 0.25)
        });
      }
    }

    if (utilization && utilization.MemoryUtilization) {
      const memory = utilization.MemoryUtilization;
      
      if (memory.average < 40 && memory.p95 < 60) {
        recommendations.push({
          service: serviceName,
          type: 'memory_rightsize',
          current: currentConfig.memory,
          recommended: Math.ceil(currentConfig.memory * 0.5),
          reason: 'Memory utilization consistently low',
          confidence: 0.85,
          estimatedSavings: this.calculateSavings(serviceName, 'memory', 0.5)
        });
      }
    }

    return recommendations;
  }

  calculateSavings(serviceName, resourceType, reductionPercentage) {
    // Simplified calculation - in reality would use actual cost data
    const baseCosts = {
      backend: { cpu: 100, memory: 80 },
      workers: { cpu: 200, memory: 150 }
    };

    const serviceCost = baseCosts[serviceName] || { cpu: 0, memory: 0 };
    const resourceCost = serviceCost[resourceType] || 0;
    
    return resourceCost * reductionPercentage;
  }

  createImplementationPlan() {
    const plan = {
      phase1: [],
      phase2: [],
      phase3: []
    };

    // Sort recommendations by confidence and savings
    const sortedRecs = this.recommendations
      .sort((a, b) => (b.confidence * b.estimatedSavings) - (a.confidence * a.estimatedSavings));

    // Phase 1: High confidence, low risk changes
    plan.phase1 = sortedRecs.filter(rec => 
      rec.confidence > 0.8 && rec.type.includes('rightsize')
    );

    // Phase 2: Medium confidence changes
    plan.phase2 = sortedRecs.filter(rec => 
      rec.confidence > 0.6 && rec.confidence <= 0.8
    );

    // Phase 3: Lower confidence or higher risk changes
    plan.phase3 = sortedRecs.filter(rec => 
      rec.confidence <= 0.6
    );

    return plan;
  }
}

module.exports = RightSizingOptimizer;
```

### 6.2 Spot Instance Strategy
```javascript
// optimization/spot-optimizer.js
class SpotInstanceOptimizer {
  constructor() {
    this.ec2 = new AWS.EC2();
    this.pricing = new AWS.Pricing();
  }

  async optimizeSpotUsage() {
    const spotPrices = await this.getSpotPriceHistory();
    const recommendations = await this.generateSpotRecommendations(spotPrices);
    
    return {
      currentUsage: await this.getCurrentSpotUsage(),
      recommendations,
      estimatedSavings: this.calculateSpotSavings(recommendations),
      implementation: this.createSpotImplementationPlan(recommendations)
    };
  }

  async getSpotPriceHistory() {
    const instanceTypes = ['t3.medium', 't3.large', 'c5.large', 'c5.xlarge', 'm5.large', 'm5.xlarge'];
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const prices = {};
    for (const instanceType of instanceTypes) {
      const params = {
        ProductDescriptions: ['Linux/UNIX (Amazon VPC)'],
        InstanceTypes: [instanceType],
        StartTime: startTime,
        EndTime: endTime,
        Filter: [
          {
            Name: 'availability-zone',
            Values: ['us-east-1a', 'us-east-1b', 'us-east-1c']
          }
        ]
      };

      try {
        const data = await this.pricing.getSpotPriceHistory(params).promise();
        prices[instanceType] = this.processSpotPriceData(data.SpotPriceHistory);
      } catch (error) {
        console.error(`Failed to get spot prices for ${instanceType}:`, error);
      }
    }

    return prices;
  }

  processSpotPriceData(priceHistory) {
    const prices = {};
    
    for (const price of priceHistory) {
      const az = price.AvailabilityZone;
      if (!prices[az]) {
        prices[az] = [];
      }
      prices[az].push(parseFloat(price.SpotPrice));
    }

    // Calculate statistics for each AZ
    for (const az of Object.keys(prices)) {
      const azPrices = prices[az];
      prices[az] = {
        average: azPrices.reduce((a, b) => a + b, 0) / azPrices.length,
        minimum: Math.min(...azPrices),
        maximum: Math.max(...azPrices),
        volatility: this.calculateVolatility(azPrices)
      };
    }

    return prices;
  }

  calculateVolatility(prices) {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
  }

  async generateSpotRecommendations(spotPrices) {
    const recommendations = [];

    for (const [instanceType, azPrices] of Object.entries(spotPrices)) {
      // Find best AZ based on price and volatility
      let bestAZ = null;
      let bestScore = -Infinity;

      for (const [az, priceData] of Object.entries(azPrices)) {
        const score = this.calculateAZScore(priceData);
        if (score > bestScore) {
          bestScore = score;
          bestAZ = az;
        }
      }

      if (bestAZ) {
        recommendations.push({
          instanceType,
          recommendedAZ: bestAZ,
          averagePrice: azPrices[bestAZ].average,
          volatility: azPrices[bestAZ].volatility,
          savingsPercentage: this.calculateSavingsPercentage(instanceType, azPrices[bestAZ].average),
          confidence: this.calculateConfidence(azPrices[bestAZ])
        });
      }
    }

    return recommendations.sort((a, b) => b.savingsPercentage - a.savingsPercentage);
  }

  calculateAZScore(priceData) {
    // Score based on low price and low volatility
    const priceScore = 1 / priceData.average;
    const volatilityScore = 1 / (1 + priceData.volatility);
    
    return priceScore * volatilityScore;
  }

  calculateSavingsPercentage(instanceType, spotPrice) {
    // Get on-demand price (simplified)
    const onDemandPrice = this.getOnDemandPrice(instanceType);
    return ((onDemandPrice - spotPrice) / onDemandPrice) * 100;
  }

  getOnDemandPrice(instanceType) {
    const prices = {
      't3.medium': 0.0416,
      't3.large': 0.0832,
      'c5.large': 0.085,
      'c5.xlarge': 0.17,
      'm5.large': 0.096,
      'm5.xlarge': 0.192
    };
    
    return prices[instanceType] || 0.1;
  }

  calculateConfidence(priceData) {
    // Higher confidence for lower volatility
    return Math.max(0.5, 1 - priceData.volatility);
  }
}

module.exports = SpotInstanceOptimizer;
```

---

## 7. Monitoring and Metrics

### 7.1 Cost Monitoring Dashboard
| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Daily Cost | Total daily spend | <$500 | >$600 |
| Cost per Job | Cost per processed job | <$0.01 | >$0.02 |
| Instance Utilization | Average CPU/Memory usage | 60-80% | <30% or >90% |
| Scaling Events | Number of scaling actions | 5-10/day | >20/day |
| Spot Instance Savings | Savings from spot usage | >30% | <20% |

### 7.2 Performance vs Cost Metrics
```javascript
// monitoring/cost-performance-tracker.js
class CostPerformanceTracker {
  constructor() {
    this.metrics = new Map();
    this.benchmarks = {
      costPerJob: 0.01,
      costPerMinute: 0.50,
      performanceThreshold: 1000 // ms
    };
  }

  recordJobMetrics(jobData) {
    const timestamp = Date.now();
    const cost = this.calculateJobCost(jobData);
    const performance = jobData.processingTime;

    const dailyKey = new Date(timestamp).toISOString().split('T')[0];
    
    if (!this.metrics.has(dailyKey)) {
      this.metrics.set(dailyKey, {
        totalJobs: 0,
        totalCost: 0,
        totalPerformance: 0,
        maxPerformance: 0,
        minPerformance: Infinity
      });
    }

    const dayMetrics = this.metrics.get(dailyKey);
    dayMetrics.totalJobs++;
    dayMetrics.totalCost += cost;
    dayMetrics.totalPerformance += performance;
    dayMetrics.maxPerformance = Math.max(dayMetrics.maxPerformance, performance);
    dayMetrics.minPerformance = Math.min(dayMetrics.minPerformance, performance);
  }

  calculateJobCost(jobData) {
    // Simplified cost calculation
    const cpuCostPerSecond = 0.00001; // $0.01 per 1000 seconds
    const memoryCostPerSecond = 0.000005; // $0.005 per 1000 seconds
    
    const processingTime = jobData.processingTime / 1000; // Convert to seconds
    return (cpuCostPerSecond + memoryCostPerSecond) * processingTime;
  }

  getCostPerformanceReport() {
    const report = {};
    
    for (const [date, metrics] of this.metrics) {
      const avgCostPerJob = metrics.totalCost / metrics.totalJobs;
      const avgPerformance = metrics.totalPerformance / metrics.totalJobs;
      const costEfficiency = avgPerformance / avgCostPerJob;
      
      report[date] = {
        totalJobs: metrics.totalJobs,
        totalCost: metrics.totalCost,
        avgCostPerJob,
        avgPerformance,
        costEfficiency,
        performanceVsBenchmark: avgPerformance / this.benchmarks.performanceThreshold,
        costVsBenchmark: avgCostPerJob / this.benchmarks.costPerJob
      };
    }
    
    return report;
  }

  getOptimizationOpportunities() {
    const opportunities = [];
    const report = this.getCostPerformanceReport();
    
    for (const [date, metrics] of Object.entries(report)) {
      if (metrics.costVsBenchmark > 1.5) {
        opportunities.push({
          type: 'cost_optimization',
          date,
          issue: 'Cost per job is 50% above benchmark',
          potentialSavings: metrics.totalCost * 0.33,
          recommendations: ['reduce_instance_size', 'optimize_code', 'use_spot_instances']
        });
      }
      
      if (metrics.performanceVsBenchmark > 2) {
        opportunities.push({
          type: 'performance_optimization',
          date,
          issue: 'Performance is 100% below benchmark',
          impact: 'Poor user experience',
          recommendations: ['increase_resources', 'optimize_algorithms', 'add_caching']
        });
      }
    }
    
    return opportunities;
  }
}

module.exports = CostPerformanceTracker;
```

---

## 8. Testing and Validation

### 8.1 Load Testing Scenarios
```javascript
// testing/load-simulator.js
class LoadSimulator {
  constructor() {
    this.scenarios = {
      baseline: {
        name: 'Baseline Load',
        duration: 3600, // 1 hour
        rps: 100, // requests per second
        jobTypes: ['standard'],
        expectedScaling: 'minimal'
      },
      peak_traffic: {
        name: 'Peak Traffic',
        duration: 1800, // 30 minutes
        rps: 1000,
        jobTypes: ['standard', 'priority'],
        expectedScaling: 'aggressive'
      },
      flash_crowd: {
        name: 'Flash Crowd',
        duration: 600, // 10 minutes
        rps: 5000,
        jobTypes: ['priority'],
        expectedScaling: 'immediate'
      },
      gradual_increase: {
        name: 'Gradual Increase',
        duration: 7200, // 2 hours
        rps_start: 50,
        rps_end: 2000,
        jobTypes: ['standard'],
        expectedScaling: 'progressive'
      }
    };
  }

  async runLoadTest(scenarioName) {
    const scenario = this.scenarios[scenarioName];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    console.log(`Starting load test: ${scenario.name}`);
    
    const results = {
      scenario: scenarioName,
      startTime: new Date(),
      metrics: {
        requests: [],
        responseTimes: [],
        errors: [],
        scalingEvents: []
      },
      costs: {
        startCost: await this.getCurrentCost(),
        endCost: null,
        totalCost: null
      }
    };

    // Start monitoring
    const monitoring = this.startMonitoring(results);

    try {
      await this.executeScenario(scenario, results);
    } finally {
      // Stop monitoring
      await monitoring.stop();
      
      results.endTime = new Date();
      results.costs.endCost = await this.getCurrentCost();
      results.costs.totalCost = results.costs.endCost - results.costs.startCost;
      
      await this.generateReport(results);
    }

    return results;
  }

  async executeScenario(scenario, results) {
    const startTime = Date.now();
    let currentRPS = scenario.rps_start || scenario.rps;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= scenario.duration * 1000) {
        clearInterval(interval);
        return;
      }

      // Gradual increase for gradual_increase scenario
      if (scenario.rps_start && scenario.rps_end) {
        const progress = elapsed / (scenario.duration * 1000);
        currentRPS = Math.floor(scenario.rps_start + (scenario.rps_end - scenario.rps_start) * progress);
      }

      this.generateLoad(currentRPS, scenario.jobTypes, results);
    }, 1000);
  }

  generateLoad(rps, jobTypes, results) {
    for (let i = 0; i < rps; i++) {
      const jobType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
      const startTime = Date.now();
      
      this.submitJob(jobType)
        .then(response => {
          const responseTime = Date.now() - startTime;
          results.metrics.responseTimes.push(responseTime);
          results.metrics.requests.push({
            timestamp: startTime,
            jobType,
            responseTime,
            success: true
          });
        })
        .catch(error => {
          const responseTime = Date.now() - startTime;
          results.metrics.errors.push({
            timestamp: startTime,
            jobType,
            responseTime,
            error: error.message
          });
        });
    }
  }

  async submitJob(jobType) {
    // Simulate job submission
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: jobType,
        payload: { data: 'test' }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }

  startMonitoring(results) {
    const monitoring = {
      stop: null
    };

    const interval = setInterval(async () => {
      const metrics = await this.getCurrentMetrics();
      results.metrics.scalingEvents.push({
        timestamp: Date.now(),
        ...metrics
      });
    }, 30000); // Every 30 seconds

    monitoring.stop = async () => {
      clearInterval(interval);
    };

    return monitoring;
  }

  async getCurrentMetrics() {
    // Get current ECS service metrics, EC2 instances, etc.
    return {
      backendTasks: await this.getECS TaskCount('backend'),
      workerTasks: await this.getECS TaskCount('workers'),
      ec2Instances: await this.getEC2InstanceCount(),
      queueDepth: await this.getQueueDepth()
    };
  }

  async generateReport(results) {
    const report = {
      scenario: results.scenario,
      duration: (results.endTime - results.startTime) / 1000,
      totalRequests: results.metrics.requests.length,
      successfulRequests: results.metrics.requests.filter(r => r.success).length,
      failedRequests: results.metrics.errors.length,
      averageResponseTime: this.calculateAverage(results.metrics.responseTimes),
      p95ResponseTime: this.calculatePercentile(results.metrics.responseTimes, 95),
      maxScalingEvents: Math.max(...results.metrics.scalingEvents.map(e => e.backendTasks + e.workerTasks)),
      totalCost: results.costs.totalCost,
      costPerRequest: results.costs.totalCost / results.metrics.requests.length
    };

    console.log('Load Test Report:', JSON.stringify(report, null, 2));
    
    return report;
  }
}

module.exports = LoadSimulator;
```

---

## 9. Configuration Management

### 9.1 Auto-Scaling Configuration
```yaml
# config/auto-scaling.yml
auto_scaling:
  global:
    cooldown_periods:
      scale_out: 60    # seconds
      scale_in: 300     # seconds
    
    metrics:
      collection_interval: 60    # seconds
      evaluation_periods: 3       # number of periods
      
  services:
    backend:
      min_capacity: 2
      max_capacity: 20
      desired_capacity: 3
      
      target_tracking:
        cpu_utilization: 70
        memory_utilization: 80
        
      step_scaling:
        - metric: QueueDepth
          lower_bound: 0
          upper_bound: 50
          scaling_adjustment: 0
        - metric: QueueDepth
          lower_bound: 50
          upper_bound: 100
          scaling_adjustment: 2
        - metric: QueueDepth
          lower_bound: 100
          upper_bound: null
          scaling_adjustment: 5
          
      scheduled_scaling:
        - name: business_hours_scale_up
          schedule: "cron(0 8 * * MON-FRI)"
          min_capacity: 4
          max_capacity: 20
        - name: after_hours_scale_down
          schedule: "cron(0 20 * * MON-FRI)"
          min_capacity: 2
          max_capacity: 10
          
    workers:
      min_capacity: 1
      max_capacity: 50
      desired_capacity: 2
      
      target_tracking:
        cpu_utilization: 80
        memory_utilization: 85
        queue_depth: 10
        
      predictive_scaling:
        enabled: true
        look_ahead_period: 3600    # 1 hour
        forecast_accuracy_threshold: 0.8
        
  spot_instances:
    enabled: true
    allocation_strategy: capacity-optimized
    instance_pools:
      - types: [t3.medium, t3.large]
        weight: 1
      - types: [c5.large, c5.xlarge]
        weight: 2
      - types: [m5.large, m5.xlarge]
        weight: 1.5
        
    interruption_handling:
      graceful_shutdown_timeout: 120  # seconds
      drain_tasks: true
      replacement_strategy: launch_backup
```

### 9.2 Cost Optimization Configuration
```yaml
# config/cost-optimization.yml
cost_optimization:
  analysis:
    data_retention_days: 30
    analysis_interval_hours: 6
    recommendation_threshold: 0.1  # 10% potential savings
    
  right_sizing:
    cpu_utilization_thresholds:
      underutilized: 30
      moderately_utilized: 50
      overutilized: 85
      
    memory_utilization_thresholds:
      underutilized: 40
      moderately_utilized: 60
      overutilized: 90
      
    confidence_levels:
      high: 0.8
      medium: 0.6
      low: 0.4
      
  scheduling:
    enabled: true
    business_hours:
      start: "08:00"
      end: "20:00"
      days: [MON, TUE, WED, THU, FRI]
      
    weekend_schedule:
      min_capacity_percentage: 25
      max_capacity_percentage: 50
      
  spot_optimization:
    enabled: true
    max_volatility: 0.3
    minimum_savings_percentage: 20
    fallback_to_on_demand: true
    
  monitoring:
    cost_alerts:
      daily_budget: 500
      weekly_budget: 3000
      monthly_budget: 12000
      
    performance_alerts:
      cost_per_job_threshold: 0.02
      cost_per_minute_threshold: 1.0
      utilization_low_threshold: 30
      utilization_high_threshold: 90
```

---

## 10. Validation Criteria

### 10.1 Functional Validation
- [ ] Auto-scaling policies trigger correctly based on metrics
- [ ] Spot instances are utilized effectively
- [ ] Cost optimization recommendations are accurate
- [ ] Load testing validates scaling behavior
- [ ] Scheduled scaling works as expected

### 10.2 Performance Validation
- [ ] Scaling response time < 2 minutes
- [ ] No service degradation during scaling events
- [ ] Cost per job meets target thresholds
- [ ] Resource utilization stays in optimal range
- [ ] Load testing meets performance requirements

### 10.3 Cost Validation
- [ ] Monthly costs are within budget
- [ ] Spot instance savings > 30%
- [ ] Right-sizing reduces costs by > 20%
- [ ] Cost per performance unit improves
- [ ] No unexpected cost spikes

### 10.4 Reliability Validation
- [ ] Auto-scaling doesn't cause service disruption
- [ ] Spot instance interruptions handled gracefully
- [ ] Monitoring provides accurate alerts
- [ ] Load testing doesn't affect production
- [ ] Scaling policies work under all conditions

---

## 11. Success Metrics

### 11.1 Cost Metrics
- **Monthly Cost Reduction**: > 25% compared to baseline
- **Spot Instance Savings**: > 30% of compute costs
- **Right-Sizing Impact**: > 20% reduction in over-provisioned resources
- **Cost per Job**: < $0.01 per processed job
- **Budget Adherence**: 100% within allocated budgets

### 11.2 Performance Metrics
- **Scaling Response Time**: < 2 minutes for scale-out events
- **Resource Utilization**: 60-80% average utilization
- **Service Availability**: > 99.9% during scaling events
- **Load Performance**: Meets SLA requirements under all load conditions
- **Auto-Scaling Accuracy**: > 90% of scaling decisions are appropriate

### 11.3 Operational Metrics
- **Manual Interventions**: < 5% of scaling events
- **Alert Accuracy**: < 10% false positive rate
- **Monitoring Coverage**: 100% of cost and performance metrics
- **Optimization Cycle Time**: < 24 hours for analysis and recommendations
- **Team Productivity**: Reduced time spent on capacity management

---

## 12. Risk Mitigation

### 12.1 Identified Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Over-scaling | Medium | Medium | Conservative thresholds, monitoring |
| Under-scaling | Medium | High | Predictive scaling, load testing |
| Spot Instance Loss | High | Medium | Mixed instances, graceful handling |
| Cost Overruns | Medium | High | Budget alerts, automated controls |
| Performance Degradation | Low | High | Gradual rollout, monitoring |

### 12.2 Contingency Plans
- **Scaling Failures**: Manual override procedures
- **Spot Instance Issues**: Auto-fallback to on-demand
- **Cost Overruns**: Automatic scaling limits
- **Performance Issues**: Quick rollback mechanisms
- **Monitoring Failures**: Secondary monitoring systems

---

## 13. Timeline and Resources

### 13.1 Implementation Timeline
- **Week 1**: Auto-scaling infrastructure setup
- **Week 2**: Resource optimization implementation
- **Week 3**: Monitoring-driven scaling configuration
- **Week 4**: Load testing and validation

### 13.2 Required Resources
- **DevOps**: 2 engineers for 4 weeks
- **Development**: 1 engineer for 2 weeks
- **Testing**: 1 QA engineer for 2 weeks
- **Finance**: 1 analyst for 1 week (cost analysis)

### 13.3 Budget Considerations
- **AWS Services**: Auto-scaling, CloudWatch, Cost Explorer
- **Tools**: Monitoring and optimization tools
- **Testing**: Load testing environment costs
- **Training**: Team training on cost optimization

---

## 14. Next Steps and Integration

### 14.1 Integration with Previous Stages
- Enhance CI/CD pipelines with cost validation
- Add cost metrics to observability dashboards
- Secure cost optimization configurations
- Apply reliability patterns to auto-scaling

### 14.2 Continuous Improvement
- Regular cost optimization reviews
- Automated recommendation implementation
- Performance benchmarking
- Cost-aware architecture decisions

### 14.3 Future Enhancements
- Machine learning for predictive scaling
- Advanced cost allocation models
- Multi-region cost optimization
- Real-time cost optimization

---

## 15. Conclusion

Stage 4f establishes comprehensive cost optimization and auto-scaling capabilities that:
- **Optimize** resource usage through intelligent scaling
- **Reduce** costs through spot instances and right-sizing
- **Automate** scaling decisions based on metrics
- **Validate** performance through load testing
- **Monitor** costs and performance continuously

The implementation ensures cost-efficient production environments that can handle varying workloads while maintaining optimal performance and providing clear visibility into cost-performance trade-offs.
