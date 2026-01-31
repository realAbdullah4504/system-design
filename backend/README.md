# Backend System Design

## Folder Structure

```
backend/
├── config/
│   ├── database.js     # MongoDB connection
│   └── sqs.js          # SQS client configuration
├── controllers/
│   └── jobController.js # HTTP request handlers
├── models/
│   └── Job.js          # MongoDB schema
├── routes/
│   └── jobRoutes.js    # Express routes
├── services/
│   ├── jobService.js   # Business logic for jobs
│   └── sqsService.js   # SQS operations
├── utils/
│   └── sleep.js        # Utility functions
├── workers/
│   ├── queueWorker.js  # Main queue processor
│   └── dlqWorker.js    # Dead Letter Queue monitor
├── index.js            # Application entry point
└── package.json
```

## Environment Variables

```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
SQS_QUEUE_URL=your-main-queue-url
SQS_DLQ_URL=your-dlq-queue-url
```

## Features

- **Job Processing**: Create and process jobs via SQS
- **DLQ Handling**: Automatic failed job routing after 3 retries
- **Monitoring**: DLQ monitoring with logging
- **REST API**: Create and fetch jobs via HTTP endpoints

## API Endpoints

- `POST /jobs` - Create a new job
- `GET /jobs/:id` - Get job status by ID
