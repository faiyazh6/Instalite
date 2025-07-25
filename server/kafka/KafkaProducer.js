import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

const kafka = new Kafka({
  clientId: 'g01-producer',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

const run = async () => {
  await producer.connect();

  const message = {
    username: 'shreya2',
    source_site: 'g01',
    post_uuid_within_site: uuidv4(),
    post_text: 'hello from kafka 2!',
    content_type: 'text/plain',
    attach: null
  };

  await producer.send({
    topic: 'FederatedPosts',
    messages: [{ value: JSON.stringify(message) }]
  });

  console.log("Sent message to FederatedPosts");
  await producer.disconnect();
};

run().catch(console.error);
