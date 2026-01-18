// file: src/config/aws.config.ts

import { env } from "@/env";
import { S3Client } from "@aws-sdk/client-s3";

export const awsS3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const awsS3Bucket = env.AWS_S3_BUCKET;
