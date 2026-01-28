const kafka = require("./kafka");

const GROUP_ID = "notification-service-group";

const consumer = kafka.consumer({ groupId: GROUP_ID });

async function startNotificationService() {
    console.log("Notification Service starting...");
    await consumer.connect();
    await consumer.subscribe({ topic: "jobs", fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const data = JSON.parse(message.value.toString());

            console.log(`[Notification Service] Sending notification for Job ID: ${data.jobId}`);

            // Simulate sending a notification (Email/Push/SMS)
            await new Promise((resolve) => setTimeout(resolve, 500));

            console.log(`[Notification Service] Successfully notified about Job: ${data.jobId}`);
        },
    });
}

startNotificationService().catch((err) => {
    console.error("Error in Notification Service:", err);
});
