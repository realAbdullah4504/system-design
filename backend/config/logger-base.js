import winston from "winston";
import { mkdirSync } from 'node:fs';

// Create logs directory if it doesn't exist
try {
  mkdirSync('logs', { recursive: true });
} catch (err) {
  if (err.code !== 'EEXIST') {
    throw err;
  }
}

export const createLogger = (serviceName) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'ISO8601' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { 
      service: serviceName,
      instanceId: process.env.HOSTNAME || 'unknown',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
      }),
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        format: winston.format.json()
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        format: winston.format.json()
      })
    ]
  });
};
