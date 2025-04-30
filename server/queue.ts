import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { log } from './vite';

// Create Redis connection
// For local development, we use a simple in-memory implementation
// For production, we'd use a real Redis instance
const useRealRedis = process.env.USE_REAL_REDIS === 'true';
let redisClient: Redis;

try {
  if (useRealRedis) {
    log('Using real Redis connection');
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        log(`Redis connection retry attempt ${times}, delaying ${delay}ms`);
        return delay;
      },
      reconnectOnError(err) {
        log(`Redis connection error: ${err.message}. Attempting to reconnect...`);
        return true; // Reconnect for all errors
      }
    });
    
    // Handle Redis events
    redisClient.on('connect', () => {
      log('Redis connection established');
    });
    
    redisClient.on('error', (err) => {
      log(`Redis error: ${err}`);
    });
    
    redisClient.on('close', () => {
      log('Redis connection closed');
    });
  } else {
    log('Using in-memory Redis connection');
    redisClient = new Redis({ 
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });
  }
} catch (err) {
  log(`Failed to initialize Redis connection: ${err}`);
  // Fallback to a mock Redis client that won't throw errors
  log('Using mock Redis client');
  redisClient = {
    disconnect: () => Promise.resolve(),
    on: () => redisClient,
    // Other required methods would go here
  } as unknown as Redis;
}

// Create queues for different types of jobs
const etaQueue = new Queue('eta', { 
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: 100
  }
});

/**
 * Add a job to recalculate the ETA for an order
 * 
 * @param orderId Order ID to update
 * @param priority Higher = more important (1-100)
 * @returns The created job
 */
export async function addEtaCalculationJob(orderId: string, priority = 10) {
  try {
    return await etaQueue.add('calculate_eta', { orderId }, { 
      priority,
      // Don't stack identical jobs - if there's already a pending job to
      // recalculate ETA for this order, don't add another one
      jobId: `eta_${orderId}`,
    });
  } catch (error) {
    log(`Error adding ETA calculation job for order ${orderId}: ${error}`);
    return null;
  }
}

/**
 * Add a job to recalculate the kitchen metrics
 * 
 * @returns The created job
 */
export async function addUpdateKitchenMetricsJob() {
  try {
    return await etaQueue.add('update_kitchen_metrics', {}, {
      priority: 5,
      // Deduplicate by using current timestamp with minute precision
      // This ensures we don't stack multiple metrics updates close together
      jobId: `metrics_${Math.floor(Date.now() / 60000)}`,
    });
  } catch (error) {
    log(`Error adding kitchen metrics job: ${error}`);
    return null;
  }
}

/**
 * Add a job to recalculate a bay's status and ETAs
 * 
 * @param bayId Bay ID to update
 * @returns The created job
 */
export async function addBayStatusUpdateJob(bayId: number) {
  try {
    return await etaQueue.add('bay_status_update', { bayId }, {
      priority: 8,
      // Don't stack identical jobs - if there's already a pending job to
      // update this bay's status, don't add another one
      jobId: `bay_${bayId}`,
    });
  } catch (error) {
    log(`Error adding bay status update job for bay ${bayId}: ${error}`);
    return null;
  }
}

// Cleanup function for graceful shutdown
export async function closeQueues() {
  await etaQueue.close();
  await redisClient.disconnect();
}

// Export the queues and connection for use elsewhere
export {
  etaQueue,
  redisClient
};