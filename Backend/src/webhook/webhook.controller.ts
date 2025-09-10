import { Controller, Post, Body } from '@nestjs/common';

@Controller('webhook')
export class WebhookController {
  @Post('delivery-report')
  async handleDeliveryReport(@Body() report: any) {
    console.log('Infobip delivery report:', JSON.stringify(report, null, 2));
    return { status: 'received' };
  }
}
