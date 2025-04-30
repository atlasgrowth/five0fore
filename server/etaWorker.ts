import { Worker, Job } from 'bullmq';
import { redisClient, etaQueue } from './queue';
import { storage } from './storage';
import { getKitchenMetrics } from './metrics';

// Define job types
const JOB_TYPES = {
  RECALCULATE_ETA: 'calculate_eta',
  UPDATE_KITCHEN_METRICS: 'update_kitchen_metrics',
  UPDATE_BAY_STATUS: 'bay_status_update'
};

/**
 * Worker for processing ETA calculation jobs from the queue
 */
export function startEtaWorker() {
  console.log('Starting ETA calculation worker...');
  
  const worker = new Worker('eta', async (job: Job) => {
    try {
      console.log(`Processing job ${job.id} of type ${job.name}`);
      
      switch (job.name) {
        case JOB_TYPES.RECALCULATE_ETA:
          await processEtaJob(job);
          break;
        
        case JOB_TYPES.UPDATE_KITCHEN_METRICS:
          await processKitchenMetricsJob(job);
          break;
          
        case JOB_TYPES.UPDATE_BAY_STATUS:
          await processBayStatusJob(job);
          break;
          
        default:
          console.warn(`Unknown job type: ${job.name}`);
      }
      
      return { success: true, jobId: job.id };
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error; // Rethrow to let BullMQ handle retries
    }
  }, { 
    connection: redisClient,
    concurrency: 5
  });
  
  worker.on('completed', job => {
    console.log(`Job ${job.id} completed successfully`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error);
  });
  
  return worker;
}

/**
 * Process a job to recalculate the ETA for an order
 */
async function processEtaJob(job: Job) {
  const { orderId } = job.data;
  
  console.log(`Processing ETA calculation for order ${orderId}`);
  
  // Get the full order with items
  const order = await storage.getOrderWithItems(orderId);
  if (!order) {
    console.warn(`Order ${orderId} not found, skipping ETA calculation`);
    return;
  }
  
  // Skip closed or completed orders
  if (order.status === 'CLOSED' || order.status === 'SERVED') {
    console.log(`Order ${orderId} is ${order.status}, skipping ETA calculation`);
    return;
  }
  
  // Get current kitchen metrics
  const metrics = getKitchenMetrics();
  
  // Import and calculate new ETA
  const { computeOrderETA } = await import('./eta');
  const { estimatedCompletionTime, attentionLevel, priority } = computeOrderETA(order, metrics);
  
  // Update the order in the database
  await storage.updateOrderETA(orderId, estimatedCompletionTime);
  
  // Broadcast the update via WebSocket
  try {
    const { broadcastUpdate } = await import('./ws');
    
    broadcastUpdate('order_eta_updated', {
      orderId,
      estimatedCompletionTime,
      attentionLevel,
      priority
    });
    
    console.log(`Updated ETA for order ${orderId} to ${estimatedCompletionTime.toISOString()}`);
  } catch (error) {
    console.error(`Error broadcasting ETA update for order ${orderId}:`, error);
  }
}

/**
 * Process a job to update kitchen metrics
 */
async function processKitchenMetricsJob(job: Job) {
  console.log('Processing kitchen metrics update');
  
  try {
    // Import and update metrics
    const { updateKitchenMetrics, updateAverageCookTimes } = await import('./metrics');
    
    // Update kitchen metrics
    const metrics = await updateKitchenMetrics();
    
    // Less frequently, update average cook times
    if (Math.random() < 0.2) { // ~20% chance (so roughly every 5 updates)
      await updateAverageCookTimes();
    }
    
    console.log('Kitchen metrics updated successfully');
  } catch (error) {
    console.error('Error updating kitchen metrics:', error);
    throw error;
  }
}

/**
 * Process a job to update a bay's status based on its orders
 */
async function processBayStatusJob(job: Job) {
  const { bayId } = job.data;
  
  console.log(`Processing bay status update for bay ${bayId}`);
  
  try {
    // Recalculate bay status from current orders
    await storage.recalcBayStatus(bayId);
    console.log(`Bay ${bayId} status updated successfully`);
  } catch (error) {
    console.error(`Error updating bay ${bayId} status:`, error);
    throw error;
  }
}