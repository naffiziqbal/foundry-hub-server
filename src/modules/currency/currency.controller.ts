import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { CurrencyService, SUPPORTED_CURRENCIES } from './currency.service';

@ApiTags('currencies')
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currency: CurrencyService) {}

  /**
   * Currency picker payload: curated navbar list + the full USD-based rate
   * table so clients can convert any stored price locally. Public — rates
   * aren't sensitive and the picker may render before login resolves.
   */
  @Public()
  @Get()
  async list() {
    const { base, rates, fetchedAt, stale } = await this.currency.getRates();
    return {
      base,
      rates,
      fetchedAt,
      stale,
      // Only offer currencies the rate table can actually convert
      currencies: SUPPORTED_CURRENCIES.filter((c) => rates[c.code] != null),
    };
  }
}
