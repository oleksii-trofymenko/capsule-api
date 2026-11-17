// Creates the photo bucket and lets the web app's origins upload to it. Safe to re-run.
// Run with `node --env-file=.env`; prints names only, never values.
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const env = process.env;
const required = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
];
const missing = required.filter((name) => !env[name]);
if (missing.length > 0) {
  console.error(
    `Not set in .env: ${missing.join(', ')}. Run npm run setup:env first.`,
  );
  process.exit(1);
}

const bucket = env.S3_BUCKET;
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Bucket ${bucket} exists.`);
} catch (error) {
  if (error?.$metadata?.httpStatusCode !== 404) throw error;
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`Created bucket ${bucket}.`);
}

const origins = (env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (origins.length === 0) {
  console.log(
    'CORS_ORIGINS is empty: browsers cannot upload until it lists the web app.',
  );
} else {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ['PUT'],
            AllowedHeaders: ['content-type'],
            MaxAgeSeconds: 600,
          },
        ],
      },
    }),
  );
  console.log(
    `Uploads allowed from ${origins.length} origin(s) in CORS_ORIGINS.`,
  );
}
