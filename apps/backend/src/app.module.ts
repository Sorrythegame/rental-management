import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BrandModule } from './brand/brand.module';
import { DeviceModelModule } from './device-model/device-model.module';
import { AssetModule } from './asset/asset.module';
import { RentalOrderModule } from './rental-order/rental-order.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandModule,
    DeviceModelModule,
    AssetModule,
    RentalOrderModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
