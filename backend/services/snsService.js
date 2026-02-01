import { PublishCommand } from "@aws-sdk/client-sns";
import { snsClient, TOPIC_ARN } from "../config/sns.js";

export const publishMessage = async (message) => {
    try {
        const command = new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify(message),
        });
        await snsClient.send(command);
    } catch (error) {
        console.error("Error publishing message to SNS:", error);
    }
};
