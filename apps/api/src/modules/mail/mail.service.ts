import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationCode(email: string, code: string) {
    this.logger.log(`Verification code for ${email}: ${code}`);
  }
}