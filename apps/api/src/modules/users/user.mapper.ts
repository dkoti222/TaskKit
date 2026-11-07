   import type { User } from '../../generated/prisma/client';

   export const toPublicUser = (user: User) => ({
     id: user.id,
     name: user.name,
     email: user.email,
     avatarUrl: user.avatarUrl,
     timezone: user.timezone,
     emailVerifiedAt: user.emailVerifiedAt,
   });