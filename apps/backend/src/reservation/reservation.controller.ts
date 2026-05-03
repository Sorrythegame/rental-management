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
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, OrderStatus } from '@prisma/client';

interface ReservationInput {
  assetId?: number | null;
  sinCode?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  name?: string | null;
  startTime?: string;
  endTime?: string;
  amount?: number;
  deposit?: number | null;
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

const toNumberArray = (v: number[] | string[] | undefined): number[] => {
  if (!Array.isArray(v)) return [];
  return v.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
};

const toPositiveInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

// 检查两个日期区间是否重叠
const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean => {
  return aStart <= bEnd && aEnd >= bStart;
};

// 计算订单状态（按时间）
const computeOrderStatus = (startTime: Date, endTime: Date): OrderStatus => {
  const now = new Date();
  if (now < startTime) return 'NotStarted';
  if (now > endTime) return 'Completed';
  return 'InProgress';
};

@Controller('reservation')
export class ReservationController {
  constructor(private readonly prisma: PrismaService) {}

  private buildData(input: ReservationInput) {
    if (!input.name || !String(input.name).trim()) {
      throw new BadRequestException('预定名称必填');
    }
    if (!input.startTime || !input.endTime) {
      throw new BadRequestException('预定开始时间和结束时间必填');
    }
    if (input.amount === undefined || input.amount === null || Number.isNaN(Number(input.amount))) {
      throw new BadRequestException('预计金额必填');
    }
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    return {
      assetId: input.assetId ? Number(input.assetId) : null,
      sinCode: normalize(input.sinCode) ?? null,
      brandName: normalize(input.brandName) ?? null,
      modelName: normalize(input.modelName) ?? null,
      name: normalize(input.name) ?? null,
      startTime: start,
      endTime: end,
      amount: Number(input.amount),
      deposit: input.deposit !== undefined && input.deposit !== null ? Number(input.deposit) : null,
      customerName: normalize(input.customerName) ?? null,
      customerPhone: normalize(input.customerPhone) ?? null,
      remarks: normalize(input.remarks) ?? null,
    };
  }

  // 校验日期冲突：相机和配件在目标日期内是否已被其他 Confirmed 预定或活跃订单占用
  private async validateConflicts(
    start: Date,
    end: Date,
    assetId: number | null,
    accessoryIds: number[],
    excludeReservationId?: number,
  ) {
    // 校验相机设备冲突
    if (assetId) {
      const assetConflicts = await this.prisma.reservation.findMany({
        where: {
          assetId,
          status: 'Confirmed',
          ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
        },
      });
      for (const r of assetConflicts) {
        if (rangesOverlap(start, end, r.startTime, r.endTime)) {
          throw new ConflictException('该设备在选定日期内已被其他预定占用');
        }
      }

      const orderConflicts = await this.prisma.rentalOrder.findMany({
        where: {
          assetId,
          orderStatus: { notIn: ['Completed', 'ManuallyStopped'] },
        },
      });
      for (const o of orderConflicts) {
        if (rangesOverlap(start, end, o.startTime, o.endTime)) {
          throw new ConflictException('该设备在选定日期内已被正式订单占用');
        }
      }
    }

    // 校验配件冲突
    if (accessoryIds.length) {
      const accReservationConflicts = await this.prisma.reservationAccessory.findMany({
        where: {
          assetId: { in: accessoryIds },
          reservation: {
            status: 'Confirmed',
            ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
          },
        },
        include: { reservation: true, asset: true },
      });
      for (const ra of accReservationConflicts) {
        if (rangesOverlap(start, end, ra.reservation.startTime, ra.reservation.endTime)) {
          throw new ConflictException(
            `配件 ${ra.asset.name || `ID:${ra.assetId}`} 在选定日期内已被其他预定占用`,
          );
        }
      }

      const accOrderConflicts = await this.prisma.rentalOrderAccessory.findMany({
        where: {
          assetId: { in: accessoryIds },
          rentalOrder: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } },
        },
        include: { asset: true },
      });
      if (accOrderConflicts.length) {
        const names = accOrderConflicts.map((o) => o.asset.name || `ID:${o.assetId}`).join('，');
        throw new ConflictException(`配件已被正式订单占用：${names}`);
      }
    }
  }

  @Post()
  async create(@Body() data: ReservationInput) {
    const accessoryIds = toNumberArray(data.accessoryIds);
    const persistData = this.buildData(data);
    await this.validateConflicts(persistData.startTime, persistData.endTime, persistData.assetId, accessoryIds);

    const reservation = await this.prisma.reservation.create({
      data: { ...persistData, status: 'Pending' },
    });

    if (accessoryIds.length) {
      await this.prisma.reservationAccessory.createMany({
        data: accessoryIds.map((assetId) => ({ reservationId: reservation.id, assetId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { asset: true, accessories: { include: { asset: true } }, rentalOrder: true },
    });
  }

  @Get()
  async findAll(
    @Query('brandName') brandName?: string,
    @Query('modelName') modelName?: string,
    @Query('status') status?: string,
    @Query('sinCode') sinCode?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const where: any = {};
    if (brandName) where.brandName = brandName;
    if (modelName) where.modelName = modelName;
    if (status === 'Pending' || status === 'Confirmed' || status === 'Cancelled' || status === 'Converted') {
      where.status = status;
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
        rentalOrder: true,
      },
      orderBy: { id: 'desc' },
    };
    if (page !== undefined && pageSize !== undefined) {
      const skip = (page - 1) * pageSize;
      const [list, total] = await Promise.all([
        this.prisma.reservation.findMany({ ...listQuery, skip, take: pageSize }),
        this.prisma.reservation.count({ where }),
      ]);
      return { list, total };
    }
    return this.prisma.reservation.findMany(listQuery);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.reservation.findUnique({
      where: { id: Number(id) },
      include: {
        asset: true,
        accessories: { include: { asset: true } },
        rentalOrder: true,
      },
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: ReservationInput) {
    const reservationId = Number(id);
    const existing = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!existing) {
      throw new BadRequestException('预定不存在');
    }
    if (existing.status === 'Converted' || existing.status === 'Cancelled') {
      throw new BadRequestException('已转单或已取消的预定不可编辑');
    }

    const accessoryIds = toNumberArray(data.accessoryIds);
    const persistData = this.buildData(data);
    await this.validateConflicts(
      persistData.startTime,
      persistData.endTime,
      persistData.assetId,
      accessoryIds,
      reservationId,
    );

    const reservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: persistData,
    });

    await this.prisma.reservationAccessory.deleteMany({ where: { reservationId } });
    if (accessoryIds.length) {
      await this.prisma.reservationAccessory.createMany({
        data: accessoryIds.map((assetId) => ({ reservationId: reservation.id, assetId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { asset: true, accessories: { include: { asset: true } }, rentalOrder: true },
    });
  }

  @Put(':id/confirm')
  async confirm(@Param('id') id: string) {
    const reservationId = Number(id);
    const existing = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!existing) {
      throw new BadRequestException('预定不存在');
    }
    if (existing.status !== 'Pending') {
      throw new BadRequestException('仅待确认状态的预定可确认');
    }
    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'Confirmed' },
      include: { asset: true, accessories: { include: { asset: true } }, rentalOrder: true },
    });
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string) {
    const reservationId = Number(id);
    const existing = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!existing) {
      throw new BadRequestException('预定不存在');
    }
    if (existing.status === 'Converted') {
      throw new BadRequestException('已转单的预定不可取消');
    }
    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'Cancelled' },
      include: { asset: true, accessories: { include: { asset: true } }, rentalOrder: true },
    });
  }

  @Put(':id/convert')
  async convert(@Param('id') id: string, @Body() body: { accessoryIds?: number[] | string[] }) {
    const reservationId = Number(id);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { accessories: true },
    });
    if (!reservation) {
      throw new BadRequestException('预定不存在');
    }
    if (reservation.status !== 'Pending' && reservation.status !== 'Confirmed') {
      throw new BadRequestException('仅待确认或已确认状态的预定可转单');
    }

    const accessoryIds = toNumberArray(body.accessoryIds);

    // 校验配件（如果传入）
    if (accessoryIds.length) {
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
        },
        include: { asset: true },
      });
      if (occupied.length) {
        const names = occupied.map((o) => o.asset.name || `ID:${o.assetId}`).join('，');
        throw new BadRequestException(`配件已被其他订单关联：${names}`);
      }
    }

    const order = await this.prisma.rentalOrder.create({
      data: {
        assetId: reservation.assetId,
        sinCode: reservation.sinCode,
        brandName: reservation.brandName,
        modelName: reservation.modelName,
        name: reservation.name,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        orderStatus: computeOrderStatus(reservation.startTime, reservation.endTime),
        amount: reservation.amount,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        remarks: reservation.remarks,
      },
    });

    if (accessoryIds.length) {
      await this.prisma.rentalOrderAccessory.createMany({
        data: accessoryIds.map((assetId) => ({ rentalOrderId: order.id, assetId })),
        skipDuplicates: true,
      });
    }

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'Converted', rentalOrderId: order.id },
    });

    return this.prisma.rentalOrder.findUnique({
      where: { id: order.id },
      include: { asset: true, accessories: { include: { asset: true } } },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const reservationId = Number(id);
    const existing = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!existing) {
      throw new BadRequestException('预定不存在');
    }
    if (existing.status === 'Converted') {
      throw new BadRequestException('已转单的预定不可删除');
    }
    return this.prisma.reservation.delete({ where: { id: reservationId } });
  }
}
