-- DropForeignKey
ALTER TABLE `Asset` DROP FOREIGN KEY `Asset_brandId_fkey`;

-- DropForeignKey
ALTER TABLE `Asset` DROP FOREIGN KEY `Asset_modelId_fkey`;

-- AlterTable
ALTER TABLE `Asset` ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `remark` VARCHAR(191) NULL,
    ADD COLUMN `rentalStatus` ENUM('Rented', 'Available') NOT NULL DEFAULT 'Available',
    ADD COLUMN `snCode` VARCHAR(191) NULL,
    MODIFY `brandId` INTEGER NULL,
    MODIFY `modelId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `DeviceModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
