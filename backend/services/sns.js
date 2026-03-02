import { PublishCommand } from "@aws-sdk/client-sns";
import { snsClient, TOPIC_ARN } from "../config/sns.js";
import logger from "../config/logger.js";

export const publishJobEvent = async (message) => {
    try {
        logger.info('Preparing to publish SNS message', { message, topicArn: TOPIC_ARN });
        
        const command = new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify(message),
        });
        
        const result = await snsClient.send(command);
        logger.info('SNS message published successfully', { 
            messageId: result.MessageId,
            sequenceNumber: result.SequenceNumber || 'N/A',
            topicArn: TOPIC_ARN
        });
        
        return result;
    } catch (error) {
        logger.error('Failed to publish SNS message', {
            error: error.message,
            name: error.name,
            stack: error.stack,
            topicArn: TOPIC_ARN
        });
        throw error;
    }
};