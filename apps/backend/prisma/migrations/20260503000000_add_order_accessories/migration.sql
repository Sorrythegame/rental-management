-- CreateTable
CREATE TABLE `RentalOrderAccessory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rentalOrderId` INTEGER NOT NULL,
    `assetId` INTEGER NOT NULL,

    UNIQUE INDEX `RentalOrderAccessory_rentalOrderId_assetId_key`(`rentalOrderId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RentalOrderAccessory` ADD CONSTRAINT `RentalOrderAccessory_rentalOrderId_fkey` FOREIGN KEY (`rentalOrderId`) REFERENCES `RentalOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalOrderAccessory` ADD CONSTRAINT `RentalOrderAccessory_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
