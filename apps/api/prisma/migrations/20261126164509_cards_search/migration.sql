-- Edited by hand (created with `prisma migrate dev --create-only`).
--
-- Prisma can't describe a GENERATED column, so it only wrote `ADD COLUMN "search" tsvector`.
-- We make Postgres compute it from title and description on every insert/update, so the app
-- never has to remember to keep it in sync:
--   - 'english' turns words into stems ("logins", "logging" → "login") and drops stop words
--   - setweight: a match in the title (A) ranks higher than one in the description (B)
--   - STORED: computed on write and saved, so searching doesn't recompute it for every row

-- AlterTable
ALTER TABLE "cards" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- CreateIndex: a GIN index lists, for every word stem, the cards containing it, which makes
-- `search @@ query` fast without reading every card.
CREATE INDEX "cards_search_idx" ON "cards" USING GIN ("search");
