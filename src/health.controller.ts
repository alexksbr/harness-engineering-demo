import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

interface HealthResponse {
  status: 'ok';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Application is running' })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
