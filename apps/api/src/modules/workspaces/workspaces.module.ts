import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { InvitationsService } from './invitations.service';
import {
  InvitationsController,
  WorkspaceInvitationsController,
} from './invitations.controller';

@Module({
  imports: [MailModule, StorageModule], // StorageModule: workspace logos
  controllers: [
    WorkspacesController,
    MembersController,
    WorkspaceInvitationsController,
    InvitationsController,
    AuditController,
  ],
  providers: [WorkspacesService, MembersService, InvitationsService, AuditService],
})
export class WorkspacesModule {}