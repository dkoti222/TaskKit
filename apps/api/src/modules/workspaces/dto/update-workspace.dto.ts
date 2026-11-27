import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkspaceDto } from './create-workspace.dto';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  /** Off: only the Owner and Admins can create boards. */
  @IsOptional()
  @IsBoolean()
  membersCanCreateBoards?: boolean;

  /** Off: no new invitations, and links already sent stop working. */
  @IsOptional()
  @IsBoolean()
  allowInviteLinks?: boolean;
}
