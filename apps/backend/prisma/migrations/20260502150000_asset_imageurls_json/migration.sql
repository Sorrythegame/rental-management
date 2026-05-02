-- AlterTable
ALTER TABLE `Asset` DROP COLUMN `imageUrl`,
    ADD COLUMN `imageUrls` JSON NOT NULL;
