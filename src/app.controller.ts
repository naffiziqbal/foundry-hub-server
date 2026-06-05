import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';

@ApiTags('health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'foundry-hub-api', time: new Date().toISOString() };
  }

  @Public()
  @Get()
  root() {
    return { name: 'Foundry-Hub API', docs: '/api/docs' };
  }
}
