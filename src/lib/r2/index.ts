import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

let _s3: S3Client | null = null;

function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

export async function uploadToR2(
  file: Buffer,
  contentType: string,
  folder: string = 'uploads'
): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
  const ext = contentType.split('/')[1] || 'bin';
  const key = `${folder}/${uuidv4()}.${ext}`;

  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  return `${publicUrl}/${key}`;
}

export async function deleteFromR2(url: string): Promise<void> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
  const key = url.replace(`${publicUrl}/`, '');

  await getS3().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
