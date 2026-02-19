import { PublishCommand } from "@aws-sdk/client-sns";
import { snsClient, TOPIC_ARN } from "../config/sns.js";

export const publishJobEvent = async (message) => {
    try {
        console.log(`[SNS] Preparing to publish message:`, message);
        console.log(`[SNS] Topic ARN: ${TOPIC_ARN}`);
        
        const command = new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify(message),
        });
        
        const result = await snsClient.send(command);
        console.log(`[SNS] Message published successfully. MessageId: ${result.MessageId}`);
        console.log(`[SNS] SequenceNumber: ${result.SequenceNumber || 'N/A'}`);
        
        return result;
    } catch (error) {
        console.error("[SNS] ERROR - Failed to publish message:", error);
        console.error("[SNS] Error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        throw error;
    }
};