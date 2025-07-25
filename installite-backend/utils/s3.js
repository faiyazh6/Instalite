// utils/s3.js
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { lookup } from 'mime-types';

// pull your .env values
const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  S3_BUCKET
} = process.env;

// build credentials object
const creds = {
  accessKeyId:     AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
};
if (AWS_SESSION_TOKEN) creds.sessionToken = AWS_SESSION_TOKEN;

// instantiate S3 with explicit credentials
export const s3 = new AWS.S3({
  region:      AWS_REGION,
  credentials: creds
});

console.log('→ ENV check:',
  'ACCESS_KEY=',   AWS_ACCESS_KEY_ID,
  'SECRET_KEY=',   !!AWS_SECRET_ACCESS_KEY,
  'SESSION_TOKEN=',!!AWS_SESSION_TOKEN,
  'REGION=',       AWS_REGION,
  'BUCKET=',       S3_BUCKET
);

/**
 * Upload a local file to S3 under the key `bucketKey`
 * @param {string} localFilePath  – path on disk
 * @param {string} bucketKey      – object key in S3
 * @returns {string} public URL
 */
export async function uploadToS3(localFilePath, bucketKey) {
  const Body = fs.createReadStream(localFilePath);
  const ext  = path.extname(localFilePath);
  const ContentType = lookup(ext) || 'application/octet-stream';

  await s3.upload({
    Bucket: S3_BUCKET,
    Key:    bucketKey,
    Body,
    ContentType,
  }).promise();

  // region‐aware URL
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${bucketKey}`;
}

/**
 * Generate a signed GET URL for an object in S3
 * @param {string} bucketKey 
 * @param {number} [expires=3600] seconds
 */
export function getSignedUrl(bucketKey, expires = 3600) {
  return s3.getSignedUrl('getObject', {
    Bucket:  S3_BUCKET,
    Key:     bucketKey,
    Expires: expires,
  });
}