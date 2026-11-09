import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { name: string; email: string; passwordHash: string }) {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: { name?: string; avatarUrl?: string; timezone?: string }) {
    const user = await this.findById(id);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  async deleteAccount(id: string, password: string) {
    const user = await this.findById(id);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new BadRequestException('Password is incorrect');
    }

    const ownedCount = await this.prisma.workspaceMember.count({
      where: { userId: id, role: 'OWNER' },
    });
    if (ownedCount > 0) {
      throw new BadRequestException(
        'You own a workspace. Transfer ownership or delete it before deleting your account.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.workspaceMember.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          name: 'Deleted user',
          email: `deleted-${id}@deleted.taskkit`,
          avatarUrl: null,
        },
      }),
    ]);
  }
}