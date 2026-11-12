import { Module } from '@nestjs/common';
import { GmailApiService } from './gmail-api.service';
import { MailService } from './mail.service';

@Module({
  providers: [GmailApiService, MailService],
  exports: [MailService],
})
export class MailModule {}
