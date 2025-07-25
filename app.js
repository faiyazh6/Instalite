import express from 'express';
import pkg from 'kafkajs';
const { Kafka, CompressionTypes, CompressionCodecs } = pkg;
import SnappyCodec from 'kafkajs-snappy';
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
import { saveKafkaPost } from "./kafka_db.js";
import testRouter from './testRouter.js';
import { getIO } from './server/chat/websocket.js';
import requireSessionAuth from './react-backend/routes/registerRoutes.js';
import { handleUserSearch } from './instalite-backend/routes/routes.js';



import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const app = express();
const kafka = new Kafka({
    clientId: 'g01-kafka-client',
    brokers: config.bootstrapServers
});

const consumer = kafka.consumer({ groupId: config.groupId });
let kafka_messages = [];


// Helper: extract hashtags from post text
function extractHashtags(text) {
    if (typeof text !== 'string') return [];
    return (text.match(/#[\w]+/g) || []).map(tag => tag.slice(1).toLowerCase());
}

app.get('/', (req, res) => {
    res.send(JSON.stringify(kafka_messages));
});

// START CONSUMER
const run = async () => {
    await consumer.connect();

    for (const topic of config.topics) {
        console.log(`Subscribing to ${topic}`);
        await consumer.subscribe({
            topic,
            fromBeginning: false,
            compression: CompressionTypes.Snappy
        });
    }

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const raw = message.value.toString();
            kafka_messages.push({ topic, value: raw });

            try {
                const parsed = JSON.parse(raw);
                // if (parsed.type === 'comment') {
                //     console.log(`[${topic}] Received comment:`, parsed);
                //     await saveKafkaComment(parsed); // we’ll write this next
                //     return;
                //   }
                let postToSave;

                if (topic === "Bluesky-Kafka") {
                    // 🔄 Username normalization (Spec: create dummy/proxy user IDs)
                    const normalizedUsername = `bluesky_${parsed.author?.displayName.replace(/\s+/g, "_").toLowerCase() || "user"}`;

                    // 🏷 Hashtag extraction (Spec: hashtags could be inside post text)
                    const hashtags = extractHashtags(parsed.text);

                    postToSave = {
                        username: normalizedUsername,
                        avatar: parsed.author?.avatar || null,
                        post_text: parsed.text,
                        hashtags,
                        external: true,
                        source_site: 'bluesky',
                        post_uuid_within_site: parsed.uri || null,
                        created_at: parsed.created_at || new Date()
                    };
                } else {
                    // FederatedPosts (Spec: reuse backend logic but use proxy IDs)
                    const rawUsername = parsed.username || 'unknown_user';
const normalizedUsername = `federated_${rawUsername.toLowerCase()}`;
                    const hashtags = extractHashtags(parsed.post_text);
                    postToSave = {
                        ...parsed,
                        username: normalizedUsername,
                        hashtags,
                        external: true,
                        created_at: new Date() // Optional — overwrite if needed
                    };
                }

                console.log(`[${topic}]`, postToSave);

                // TODO: Replace this with actual DB logic
                await saveKafkaPost(postToSave);

                // inside your Kafka consumer's eachMessage block:
                const io = getIO();
            if (io) {
            io.emit('newPost', postToSave);
            console.log("📢 Emitted newPost to socket clients:", postToSave);
            } else {
            console.warn("⚠️ Socket.io not initialized; skipping emit.");
            }

            } catch (err) {
                console.error("Error parsing Kafka message:", err);
            }
        }
    });
};

run().catch(console.error);
app.use(express.json()); // already using express — enable JSON body parsing
app.use('/test', testRouter); // now you can call POST /test/create
app.post("/user/search", requireSessionAuth, handleUserSearch);
app.listen(config.port, () => {
    console.log(`App is listening on port ${config.port}`);
});
