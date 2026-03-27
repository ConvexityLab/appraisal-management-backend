/**
 * handleSftpPoisonQueue.js
 *
 * Monitors the poison queue for SFTP order processing failures.
 * After 5 failed dequeue attempts, Azure Storage automatically moves messages
 * to `sftp-order-events-poison`. This function logs the details so operators
 * can investigate without manually polling the queue.
 *
 * This is NOT a retry mechanism — by the time a message reaches the poison
 * queue, it has already been retried 5 times by the main handler. This
 * function exists purely for observability and alerting.
 */

"use strict";

const { app } = require("@azure/functions");

app.storageQueue("handleSftpPoisonQueue", {
  queueName: "sftp-order-events-poison",
  connection: "AZURE_STORAGE_CONNECTION_STRING",

  handler: async (poisonMessage, context) => {
    // Extract whatever information we can from the dead message
    let messageBody;
    try {
      messageBody = typeof poisonMessage === "string"
        ? JSON.parse(poisonMessage)
        : poisonMessage;
    } catch {
      messageBody = poisonMessage;
    }

    // Pull the blob name from the Event Grid payload if possible
    const event = Array.isArray(messageBody) ? messageBody[0] : messageBody;
    const blobUrl = event?.data?.url ?? "unknown";
    const subject = event?.subject ?? "unknown";

    context.error(
      `POISON QUEUE ALERT: SFTP order file processing permanently failed after max retries. ` +
      `Subject: ${subject} | Blob URL: ${blobUrl} | ` +
      `Full message: ${JSON.stringify(messageBody)}`
    );

    // The message is consumed (removed from poison queue) after this handler
    // returns successfully. If you want to keep it for manual inspection,
    // throw here — but that would cause infinite retries of the poison handler
    // itself. Better to log clearly and let ops investigate via App Insights.
  },
});
