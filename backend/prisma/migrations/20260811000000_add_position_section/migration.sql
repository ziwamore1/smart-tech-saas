-- Add section (Primary/Secondary) to acting positions so leadership
-- positions (Director, Deputy Director, Head Teacher, Deputy) can be
-- scoped to a school section independently of department membership.

CREATE TYPE "PositionSection" AS ENUM ('PRIMARY', 'SECONDARY');

ALTER TABLE "ActingPosition" ADD COLUMN "section" "PositionSection";

CREATE INDEX "ActingPosition_section_idx" ON "ActingPosition"("section");
