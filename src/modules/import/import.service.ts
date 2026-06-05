import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PRODUCT_IMPORT_QUEUE,
  ProductImportJob,
} from './import.constants';

@Injectable()
export class ImportService {
  constructor(
    @InjectQueue(PRODUCT_IMPORT_QUEUE)
    private readonly queue: Queue<ProductImportJob>,
  ) {}

  /** Queue an async scrape for a freshly-created product placeholder. */
  async enqueue(job: ProductImportJob): Promise<void> {
    await this.queue.add('import', job, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }
}
