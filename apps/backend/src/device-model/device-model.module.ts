import { Module } from '@nestjs/common';
import { DeviceModelController } from './device-model.controller';

@Module({
  controllers: [DeviceModelController],
})
export class DeviceModelModule {}
