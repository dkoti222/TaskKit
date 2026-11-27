-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "declined_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "allow_invite_links" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "logo_key" TEXT,
ADD COLUMN     "members_can_create_boards" BOOLEAN NOT NULL DEFAULT true;
