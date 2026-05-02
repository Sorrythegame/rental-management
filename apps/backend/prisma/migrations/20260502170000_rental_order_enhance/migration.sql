-- AlterTable
ALTER TABLE `RentalOrder`
    ADD COLUMN `assetId` INTEGER NULL,
    ADD COLUMN `brandName` VARCHAR(191) NULL,
    ADD COLUMN `customerPhone` VARCHAR(191) NULL,
    ADD COLUMN `modelName` VARCHAR(191) NULL,
    ADD COLUMN `orderStatus` ENUM('NotStarted', 'InProgress', 'Completed') NOT NULL DEFAULT 'NotStarted',
    ADD COLUMN `snCode` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `RentalOrder` ADD CONSTRAINT `RentalOrder_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
