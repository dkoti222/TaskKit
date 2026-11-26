import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationCode(email: string, code: string) {
    this.logger.log(`Verification code for ${email}: ${code}`);
  }

  async sendPasswordReset(email: string, link: string) {
    this.logger.log(`Password reset link for ${email}: ${link}`);
  }
    async sendInvitation(email: string, workspaceName: string, link: string) {
    this.logger.log(`Invite to "${workspaceName}" for ${email}: ${link}`);
  }

  async sendMention(email: string, who: string, cardTitle: string, preview: string) {
    this.logger.log(`Mention email to ${email}: ${who} mentioned you in "${cardTitle}": ${preview}`);
  }
}
