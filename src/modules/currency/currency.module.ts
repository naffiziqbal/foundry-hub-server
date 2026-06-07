import { Global, Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';

/**
 * Global so any price-bearing module (products, projects, schedules, …) can
 * inject CurrencyService without wiring an import each time.
 */
@Global()
@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
