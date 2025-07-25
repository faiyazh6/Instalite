// index_data.js
// Seed the ChromaDB "actors" collection with IMDB actor image embeddings

import AWS from 'aws-sdk';
import fs from 'fs';
import https from 'https';
import csvParser from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChromaClient } from 'chromadb';
import { generateEmbedding } from './utils/embeddings.js';

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// AWS + Chroma setup
AWS.config.update({ region: 'us-east-1' });
const s3    = new AWS.S3();
const chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

const CSV_URL  = 'https://nets2120-images.s3.us-east-1.amazonaws.com/names_paths.csv';
const CSV_FILE = path.resolve(__dirname, 'names_paths.csv');

async function downloadCSV() {
  if (!fs.existsSync(CSV_FILE)) {
    console.log('⬇️  Downloading names_paths.csv from S3...');
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(CSV_FILE);
      https.get(CSV_URL, res => {
        res.pipe(ws);
        ws.on('finish', () => ws.close(resolve));
      }).on('error', reject);
    });
    console.log('✅ Downloaded names_paths.csv');
  }
}

(async () => {
  try {
    await downloadCSV();

    const rows = [];
    let sawHeader = false;

    fs.createReadStream(CSV_FILE)
      .pipe(csvParser({ separator: '\t' }))
      .on('data', row => {
        // log once so you can confirm your column names:
        if (!sawHeader) {
          console.log('⚙️ CSV columns:', Object.keys(row).join(', '));
          sawHeader = true;
        }
        // pick the correct fields
        const { nconst, primaryName, path: bucket_path } = row;
        if (nconst && bucket_path) {
          rows.push({ nconst, name: primaryName, bucket_path });
        }
      })
      .on('end', async () => {
        console.log(`Parsed ${rows.length} actor entries`);

        if (rows.length === 0) {
          console.error('❌ No rows found—check that your CSV really is tab-delimited and headers spell exactly nconst, primaryName, path');
          process.exit(1);
        }

        // get or create the actors collection
        let coll;
        try {
          coll = await chroma.getCollection({ name: 'actors' });
          console.log('ℹ️ Reusing existing "actors" collection');
        } catch {
          coll = await chroma.createCollection({ name: 'actors' });
          console.log('✅ Created "actors" collection');
        }

        // seed each actor
        for (let i = 0; i < rows.length; i++) {
          const { nconst, name, bucket_path } = rows[i];
          try {
            const { Body } = await s3.getObject({
              Bucket: 'nets2120-images',
              Key: bucket_path
            }).promise();

            const embedding = await generateEmbedding(Body);

            await coll.add({
              ids:       [nconst],
              embeddings:[embedding],
              metadatas: [{ name, imageUrl: `https://nets2120-images.s3.us-east-1.amazonaws.com/${bucket_path}` }]
            });

            process.stdout.write(`Indexed ${nconst} (${name}) [${i+1}/${rows.length}]\r`);
          } catch (err) {
            console.error(`\n❌ Error indexing ${nconst}:`, err.message);
          }
        }

        console.log('\n✅ All actors seeded into ChromaDB');
        process.exit(0);
      });
  } catch (fatal) {
    console.error('💥 Fatal error during seeding:', fatal);
    process.exit(1);
  }
})();