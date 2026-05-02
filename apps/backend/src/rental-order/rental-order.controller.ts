import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

interface OrderInput {
  assetId?: number | null;
  sinCode?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  startTime?: string;
  endTime?: string;
  amount?: number;
  customerName?: string | null;
  customerPhone?: string | null;
  remarks?: string | null;
}

const normalize = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
};

const computeOrderStatus = (startTime: Date, endTime: Date): OrderStatus => {
  const now = new Date();
  if (now < startTime) return 'NotStarted';
  if (now > endTime) return 'Completed';
  return 'InProgress';
};

@Controller('rental-order')
export class RentalOrderController {
  constructor(private readonly prisma: PrismaService) {}

  private buildData(input: OrderInput) {
    if (!input.startTime || !input.endTime) {
      throw new BadRequestException('租赁开始时间和结束时间必填');
    }
    if (input.amount === undefined || input.amount === null || Number.isNaN(Number(input.amount))) {
      throw new BadRequestException('订单金额必填');
    }
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    return {
      assetId: input.assetId ? Number(input.assetId) : null,
      sinCode: normalize(input.sinCode) ?? null,
      brandName: normalize(input.brandName) ?? null,
      modelName: normalize(input.modelName) ?? null,
      startTime: start,
      endTime: end,
      orderStatus: computeOrderStatus(start, end),
      amount: Number(input.amount),
      customerName: normalize(input.customerName) ?? null,
      customerPhone: normalize(input.customerPhone) ?? null,
      remarks: normalize(input.remarks) ?? null,
    };
  }

  @Post()
  create(@Body() data: OrderInput) {
    return this.prisma.rentalOrder.create({ data: this.buildData(data) });
  }

  @Get()
  findAll(
    @Query('brandName') brandName?: string,
    @Query('modelName') modelName?: string,
    @Query('orderStatus') orderStatus?: string,
    @Query('sinCode') sinCode?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = {};
    if (brandName) where.brandName = brandName;
    if (modelName) where.modelName = modelName;
    if (orderStatus === 'NotStarted' || orderStatus === 'InProgress' || orderStatus === 'Completed') {
      where.orderStatus = orderStatus;
    }
    if (sinCode) where.sinCode = { contains: sinCode };
    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    return this.prisma.rentalOrder.findMany({
      where,
      include: { asset: true },
      orderBy: { id: 'desc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.rentalOrder.findUnique({
      where: { id: Number(id) },
      include: { asset: true },
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: OrderInput) {
    return this.prisma.rentalOrder.update({
      where: { id: Number(id) },
      data: this.buildData(data),
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.rentalOrder.delete({ where: { id: Number(id) } });
  }
}
