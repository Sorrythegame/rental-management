-- AlterEnum
ALTER TABLE `RentalOrder` MODIFY COLUMN `orderStatus` ENUM('NotStarted', 'InProgress', 'Completed', 'ManuallyStopped') NOT NULL DEFAULT 'NotStarted';
