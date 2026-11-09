import { IsIn } from 'class-validator';

export class SetBoardRoleDto {
  @IsIn(['ADMIN', 'MEMBER', 'VIEWER'])
  role!: 'ADMIN' | 'MEMBER' | 'VIEWER';
}