import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

const kafka = new Kafka({
  clientId: 'g01-producer',
  brokers: ['localhost:9092'] // change to actual broker if remote
});

const producer = kafka.producer();
let connected = false;

export async function producePostEvent({ username, post_text, attach = null, source_site = "g01", hashtags = [] }) {
  try {
    if (!connected) {
      await producer.connect();
      connected = true;
    }

    const message = {
      username,
      source_site,
      post_uuid_within_site: uuidv4(),
      post_text,
      content_type: 'text/plain',
      attach,
      hashtags
    };

    await producer.send({
      topic: 'FederatedPosts',
      messages: [{ value: JSON.stringify(message) }]
    });

    console.log("✔ Sent post to Kafka:", message);
    return { success: true };
  } catch (err) {
    console.error("Kafka post failed:", err);
    return { error: "Failed to produce Kafka message" };
  }
}
