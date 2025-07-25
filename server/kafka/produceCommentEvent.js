// // server/kafka/produceCommentEvent.js
// import { Kafka } from 'kafkajs';
// import { v4 as uuidv4 } from 'uuid';

// const client = new Kafka({
//     clientId: 'comment-producer',
//     brokers: ['localhost:9092'],  // make sure this matches your running broker
//   });
// const producer = client.producer();
// let connected = false;

// export async function produceCommentEvent({
//   username,
//   post_uuid_within_site,
//   text,
//   source_site = "g01",
// }) {
//   if (!connected) {
//     await producer.connect();
//     connected = true;
//   }

//   const message = {
//     type: "comment",
//     comment_uuid: uuidv4(),
//     username,
//     post_uuid_within_site,
//     text,
//     source_site,
//     created_at: new Date().toISOString(),
//     external: true,
//   };

//   console.log("Sent comment to Kafka:", message);

//   await producer.send({
//     topic: "FederatedPosts",
//     messages: [{ value: JSON.stringify(message) }],
//   });

//   //test cleanup --> immediately disconnect
//   if (process.env.NODE_ENV === 'test') {
//         await producer.disconnect();
//         connected = false;
//       }

//   console.log('✔ Sent comment to Kafka');
//   return { success: true };
// }
