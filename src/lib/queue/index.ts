import { Queue } from 'bullmq';
import { getRedisConfig } from './redis';

let _queue: Queue | null = null;
let _previewQueue: Queue | null = null;

export function getRenderQueue(): Queue {
  if (!_queue) {
    const config = getRedisConfig();
    _queue = new Queue('video-render', {
      connection: config,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
    console.log(`[Queue] video-render connected to ${config.host}:${config.port}`);
  }
  return _queue;
}

export function getPreviewQueue(): Queue {
  if (!_previewQueue) {
    const config = getRedisConfig();
    _previewQueue = new Queue('template-preview-render', {
      connection: config,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      },
    });
    console.log(`[Queue] template-preview-render connected to ${config.host}:${config.port}`);
  }
  return _previewQueue;
}
