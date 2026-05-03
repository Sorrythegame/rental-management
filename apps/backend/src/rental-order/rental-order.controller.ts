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
  name?: string | null;
  startTime?: string;
  endTime?: string;
  amount?: number;
  customerName?: string | null;
  customerPhone?: string | null;
  remarks?: string | null;
  accessoryIds?: number[] | string[];
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

const toNumberArray = (v: number[] | string[] | undefined): number[] => {
  if (!Array.isArray(v)) return [];
  return v.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
};

const toPositiveInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

@Controller('rental-order')
export class RentalOrderController {
  constructor(private readonly prisma: PrismaService) {}

  private buildData(input: OrderInput, preserveStatus?: OrderStatus) {
    if (!input.name || !String(input.name).trim()) {
      throw new BadRequestException('订单名称必填');
    }
    if (!input.startTime || !input.endTime) {
      throw new BadRequestException('租赁开始时间和结束时间必填');
    }
    if (input.amount === undefined || input.amount === null || Number.isNaN(Number(input.amount))) {
      throw new BadRequestException('订单金额必填');
    }
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    const computedStatus = computeOrderStatus(start, end);
    return {
      assetId: input.assetId ? Number(input.assetId) : null,
      sinCode: normalize(input.sinCode) ?? null,
      brandName: normalize(input.brandName) ?? null,
      modelName: normalize(input.modelName) ?? null,
      name: normalize(input.name) ?? null,
      startTime: start,
      endTime: end,
      orderStatus: preserveStatus === 'ManuallyStopped' ? 'ManuallyStopped' : computedStatus,
      amount: Number(input.amount),
      customerName: normalize(input.customerName) ?? null,
      customerPhone: normalize(input.customerPhone) ?? null,
      remarks: normalize(input.remarks) ?? null,
    };
  }

  private async validateAccessories(accessoryIds: number[] | undefined, excludeOrderId?: number) {
    if (!accessoryIds?.length) return;
    const accessories = await this.prisma.asset.findMany({
      where: { id: { in: accessoryIds }, type: 'Accessory' },
    });
    if (accessories.length !== accessoryIds.length) {
      throw new BadRequestException('部分配件不存在或类型不正确');
    }
    const occupied = await this.prisma.rentalOrderAccessory.findMany({
      where: {
        assetId: { in: accessoryIds },
        rentalOrder: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } },
        ...(excludeOrderId ? { rentalOrderId: { not: excludeOrderId } } : {}),
      },
      include: { asset: true },
    });
    if (occupied.length) {
      const names = occupied.map((o) => o.asset.name || `ID:${o.assetId}`).join('，');
      throw new BadRequestException(`配件已被其他订单关联：${names}`);
    }
  }

  @Post()
  async create(@Body() data: OrderInput) {
    const accessoryIds = toNumberArray(data.accessoryIds);
    await this.validateAccessories(accessoryIds);
    const order = await this.prisma.rentalOrder.create({ data: this.buildData(data) });
    if (accessoryIds.length) {
      await this.prisma.rentalOrderAccessory.createMany({
        data: accessoryIds.map((assetId) => ({ rentalOrderId: order.id, assetId })),
        skipDuplicates: true,
      });
    }
    return this.prisma.rentalOrder.findUnique({
      where: { id: order.id },
      include: { asset: true, accessories: { include: { asset: true } } },
    });
  }

  @Get()
  async findAll(
    @Query('brandName') brandName?: string,
    @Query('modelName') modelName?: string,
    @Query('orderStatus') orderStatus?: string,
    @Query('sinCode') sinCode?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const where: any = {};
    if (brandName) where.brandName = brandName;
    if (modelName) where.modelName = modelName;
    if (
      orderStatus === 'NotStarted' ||
      orderStatus === 'InProgress' ||
      orderStatus === 'Completed' ||
      orderStatus === 'ManuallyStopped'
    ) {
      where.orderStatus = orderStatus;
    }
    if (sinCode) where.sinCode = { contains: sinCode };
    if (startDate && endDate) {
      const filterStart = new Date(startDate + 'T00:00:00.000Z');
      const filterEnd = new Date(endDate + 'T23:59:59.999Z');
      where.AND = [
        { startTime: { lte: filterEnd } },
        { endTime: { gte: filterStart } },
      ];
    }
    const page = toPositiveInt(pageQ);
    const pageSize = toPositiveInt(pageSizeQ);
    const listQuery: any = {
      where,
      include: {
        asset: true,
        accessories: { include: { asset: true } },
      },
      orderBy: { id: 'desc' },
    };
    if (page !== undefined && pageSize !== undefined) {
      const skip = (page - 1) * pageSize;
      const [list, total] = await Promise.all([
        this.prisma.rentalOrder.findMany({ ...listQuery, skip, take: pageSize }),
        this.prisma.rentalOrder.count({ where }),
      ]);
      return { list, total };
    }
    return this.prisma.rentalOrder.findMany(listQuery);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.rentalOrder.findUnique({
      where: { id: Number(id) },
      include: {
        asset: true,
        accessories: { include: { asset: true } },
      },
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: OrderInput) {
    const orderId = Number(id);
    const existing = await this.prisma.rentalOrder.findUnique({ where: { id: orderId } });
    const accessoryIds = toNumberArray(data.accessoryIds);
    await this.validateAccessories(accessoryIds, orderId);
    const order = await this.prisma.rentalOrder.update({
      where: { id: orderId },
      data: this.buildData(data, existing?.orderStatus),
    });
    await this.prisma.rentalOrderAccessory.deleteMany({ where: { rentalOrderId: orderId } });
    if (accessoryIds.length) {
      await this.prisma.rentalOrderAccessory.createMany({
        data: accessoryIds.map((assetId) => ({ rentalOrderId: order.id, assetId })),
        skipDuplicates: true,
      });
    }
    return this.prisma.rentalOrder.findUnique({
      where: { id: order.id },
      include: { asset: true, accessories: { include: { asset: true } } },
    });
  }

  @Put(':id/stop')
  async stop(@Param('id') id: string) {
    const orderId = Number(id);
    return this.prisma.rentalOrder.update({
      where: { id: orderId },
      data: { orderStatus: 'ManuallyStopped', endTime: new Date() },
      include: { asset: true, accessories: { include: { asset: true } } },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.rentalOrder.delete({ where: { id: Number(id) } });
  }
}
