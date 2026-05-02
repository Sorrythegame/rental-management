import { Module } from '@nestjs/common';
import { RentalOrderController } from './rental-order.controller';

@Module({
  controllers: [RentalOrderController],
})
export class RentalOrderModule {}
