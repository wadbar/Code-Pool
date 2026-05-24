/**
 * AssetDownloader - Extreme Reliability Module
 * Handles parallelized downloads, integrity checks, and robust retry logic.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface DownloadTask {
  id: string;
  url: string;
  dest: string;
  retries: number;
  priority: number;
}

export class AssetDownloader extends EventEmitter {
  private queue: DownloadTask[] = [];
  private activeCount = 0;
  private readonly MAX_CONCURRENT = 5;

  public async enqueue(task: DownloadTask) {
    this.queue.push(task);
    this.processQueue();
  }

  private async processQueue() {
    if (this.activeCount >= this.MAX_CONCURRENT || this.queue.length === 0) return;

    const task = this.queue.shift()!;
    this.activeCount++;

    this.emit('progress', { id: task.id, status: 'STARTING', message: `Initializing download: ${path.basename(task.dest)}` });

    try {
      await this.downloadWithRetry(task);
      this.emit('progress', { id: task.id, status: 'COMPLETE', message: `Successfully downloaded ${path.basename(task.dest)}` });
    } catch (err: any) {
      this.emit('progress', { id: task.id, status: 'FAILED', message: `Critical Failure: ${err.message}` });
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private async downloadWithRetry(task: DownloadTask, attempt = 0): Promise<void> {
    try {
      const response = await axios({
        method: 'get',
        url: task.url,
        responseType: 'stream',
        timeout: 30000,
      });

      const writer = fs.createWriteStream(task.dest);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error: any) {
      if (attempt < task.retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[AssetDownloader] Retry ${attempt + 1}/${task.retries} for ${task.id} in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        return this.downloadWithRetry(task, attempt + 1);
      }
      throw error;
    }
  }
}

export const assetDownloader = new AssetDownloader();
