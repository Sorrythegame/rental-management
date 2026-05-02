import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BrandModule } from './brand/brand.module';
import { DeviceModelModule } from './device-model/device-model.module';
import { AssetModule } from './asset/asset.module';
import { RentalOrderModule } from './rental-order/rental-order.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/api/uploads',
    }),
    PrismaModule,
    AuthModule,
    BrandModule,
    DeviceModelModule,
    AssetModule,
    RentalOrderModule,
    DashboardModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
