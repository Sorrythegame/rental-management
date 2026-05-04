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
import { Prisma, AssetType, AssetStatus, RentalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AssetInput {
  type?: AssetType;
  name?: string | null;
  sinCode?: string | null;
  brandId?: number | null;
  modelId?: number | null;
  imageUrls?: string[];
  purchaseDate?: string;
  price?: number;
  status?: AssetStatus;
  damageDesc?: string | null;
  remark?: string | null;
}

const toPositiveInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

@Controller('asset')
export class AssetController {
  constructor(private readonly prisma: PrismaService) {}

  private buildPersistData(input: AssetInput): Prisma.AssetUncheckedCreateInput {
    if (!input.type) {
      throw new BadRequestException('type 必填');
    }
    if (input.type !== 'Camera' && input.type !== 'Accessory') {
      throw new BadRequestException('type 非法');
    }
    if (!input.purchaseDate) {
      throw new BadRequestException('purchaseDate 必填');
    }
    if (input.price === undefined || input.price === null || Number.isNaN(Number(input.price))) {
      throw new BadRequestException('price 必填');
    }
    if (!input.status || (input.status !== 'Normal' && input.status !== 'Damaged')) {
      throw new BadRequestException('status 必填且必须是 Normal/Damaged');
    }

    const base: Prisma.AssetUncheckedCreateInput = {
      type: input.type,
      imageUrls: Array.isArray(input.imageUrls) ? (input.imageUrls as Prisma.InputJsonValue) : [],
      purchaseDate: new Date(input.purchaseDate),
      price: Number(input.price),
      status: input.status,
      damageDesc: input.status === 'Damaged' ? input.damageDesc || null : null,
      remark: input.remark ?? null,
      // 默认置空，下方按 type 覆盖
      brandId: null,
      modelId: null,
      name: null,
      sinCode: null,
    };

    if (input.type === 'Camera') {
      const brandId = toPositiveInt(input.brandId);
      const modelId = toPositiveInt(input.modelId);
      if (!brandId) throw new BadRequestException('相机必须选择品牌');
      if (!modelId) throw new BadRequestException('相机必须选择型号');
      const sin = (input.sinCode || '').trim();
      if (!sin) throw new BadRequestException('相机必须填写 SIN 码');
      base.brandId = brandId;
      base.modelId = modelId;
      base.sinCode = sin;
    } else {
      const name = (input.name || '').trim();
      if (!name) throw new BadRequestException('配件必须填写名称');
      base.name = name;
    }

    return base;
  }

  @Post()
  create(@Body() data: AssetInput) {
    return this.prisma.asset.create({ data: this.buildPersistData(data) });
  }

  @Get()
  async findAll(
    @Query('brandId') brandIdQ?: string,
    @Query('modelId') modelIdQ?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sinCode') sinCode?: string,
    @Query('page') pageQ?: string,
    @Query('pageSize') pageSizeQ?: string,
  ) {
    const where: Prisma.AssetWhereInput = {};
    const brandId = toPositiveInt(brandIdQ);
    const modelId = toPositiveInt(modelIdQ);
    if (brandId) where.brandId = brandId;
    if (modelId) where.modelId = modelId;
    if (status === 'Normal' || status === 'Damaged') {
      where.status = status;
    }
    if (type === 'Camera' || type === 'Accessory') {
      where.type = type;
    }
    if (sinCode?.trim()) {
      where.sinCode = { contains: sinCode.trim() };
    }
    const page = toPositiveInt(pageQ);
    const pageSize = toPositiveInt(pageSizeQ);
    const listQuery: any = {
      where,
      include: {
        brand: true,
        model: true,
        orders: { where: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } }, take: 1 },
        orderAccessories: { where: { rentalOrder: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } } }, take: 1 },
      },
      orderBy: { id: 'desc' },
    };
    if (page !== undefined && pageSize !== undefined) {
      const skip = (page - 1) * pageSize;
      const [assets, total] = await Promise.all([
        this.prisma.asset.findMany({ ...listQuery, skip, take: pageSize }),
        this.prisma.asset.count({ where }),
      ]);
      const list = (assets as any[]).map(({ orders, orderAccessories, ...asset }) => ({
        ...asset,
        rentalStatus:
          orders.length > 0 || orderAccessories.length > 0
            ? ('Rented' as RentalStatus)
            : ('Available' as RentalStatus),
      }));
      return { list, total };
    }
    const assets = (await this.prisma.asset.findMany(listQuery)) as any[];
    return assets.map(({ orders, orderAccessories, ...asset }) => ({
      ...asset,
      rentalStatus:
        orders.length > 0 || orderAccessories.length > 0
          ? ('Rented' as RentalStatus)
          : ('Available' as RentalStatus),
    }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: Number(id) },
      include: {
        brand: true,
        model: true,
        orders: { where: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } }, take: 1 },
        orderAccessories: { where: { rentalOrder: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } } }, take: 1 },
      },
    });
    if (!asset) return null;
    const { orders, orderAccessories, ...rest } = asset;
    return {
      ...rest,
      rentalStatus:
        orders.length > 0 || orderAccessories.length > 0
          ? ('Rented' as RentalStatus)
          : ('Available' as RentalStatus),
    };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: AssetInput) {
    return this.prisma.asset.update({
      where: { id: Number(id) },
      data: this.buildPersistData(data),
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.asset.delete({ where: { id: Number(id) } });
  }

  @Get('stats/by-brand-model')
  async statsByBrandModel() {
    const stats = await this.prisma.asset.groupBy({
      by: ['brandId', 'modelId'],
      where: { type: 'Camera', brandId: { not: null }, modelId: { not: null } },
      _count: { id: true },
      _sum: { price: true },
    });

    const brandIds = [...new Set(stats.map((s) => s.brandId).filter((id): id is number => id !== null))];
    const modelIds = [...new Set(stats.map((s) => s.modelId).filter((id): id is number => id !== null))];

    const [brandsData, modelsData] = await Promise.all([
      this.prisma.brand.findMany({ where: { id: { in: brandIds } } }),
      this.prisma.deviceModel.findMany({ where: { id: { in: modelIds } } }),
    ]);

    const brandMap = new Map(brandsData.map((b) => [b.id, b.name]));
    const modelMap = new Map(modelsData.map((m) => [m.id, m.name]));

    return stats.map((s) => ({
      brandName: brandMap.get(s.brandId!) || '-',
      modelName: modelMap.get(s.modelId!) || '-',
      count: s._count.id,
      totalPrice: s._sum.price || 0,
    }));
  }

  @Get(':id/occupancy')
  async occupancy(
    @Param('id') id: string,
    @Query('excludeOrderId') excludeOrderId?: string,
    @Query('excludeReservationId') excludeReservationId?: string,
  ) {
    const assetId = Number(id);

    const orderWhere: any = {
      assetId,
      orderStatus: { notIn: ['Completed', 'ManuallyStopped'] },
    };
    if (excludeOrderId) {
      orderWhere.id = { not: Number(excludeOrderId) };
    }
    const orders = await this.prisma.rentalOrder.findMany({
      where: orderWhere,
      select: { id: true, name: true, startTime: true, endTime: true, customerName: true },
    });

    const orderAccessoryWhere: any = {
      assetId,
      rentalOrder: { orderStatus: { notIn: ['Completed', 'ManuallyStopped'] } },
    };
    if (excludeOrderId) {
      orderAccessoryWhere.rentalOrderId = { not: Number(excludeOrderId) };
    }
    const orderAccessories = await this.prisma.rentalOrderAccessory.findMany({
      where: orderAccessoryWhere,
      include: { rentalOrder: { select: { id: true, name: true, startTime: true, endTime: true, customerName: true } } },
    });

    const reservationWhere: any = {
      assetId,
      status: 'Confirmed',
    };
    if (excludeReservationId) {
      reservationWhere.id = { not: Number(excludeReservationId) };
    }
    const reservations = await this.prisma.reservation.findMany({
      where: reservationWhere,
      select: { id: true, name: true, startTime: true, endTime: true, customerName: true },
    });

    const reservationAccessoryWhere: any = {
      assetId,
      reservation: { status: 'Confirmed' },
    };
    if (excludeReservationId) {
      reservationAccessoryWhere.reservationId = { not: Number(excludeReservationId) };
    }
    const reservationAccessories = await this.prisma.reservationAccessory.findMany({
      where: reservationAccessoryWhere,
      include: { reservation: { select: { id: true, name: true, startTime: true, endTime: true, customerName: true } } },
    });

    return [
      ...orders.map((o) => ({ startTime: o.startTime, endTime: o.endTime, type: 'order' as const, id: o.id, name: o.name || `订单 #${o.id}`, customerName: o.customerName })),
      ...orderAccessories.map((oa) => ({ startTime: oa.rentalOrder.startTime, endTime: oa.rentalOrder.endTime, type: 'order' as const, id: oa.rentalOrder.id, name: oa.rentalOrder.name || `订单 #${oa.rentalOrder.id}`, customerName: oa.rentalOrder.customerName })),
      ...reservations.map((r) => ({ startTime: r.startTime, endTime: r.endTime, type: 'reservation' as const, id: r.id, name: r.name || `预定 #${r.id}`, customerName: r.customerName })),
      ...reservationAccessories.map((ra) => ({ startTime: ra.reservation.startTime, endTime: ra.reservation.endTime, type: 'reservation' as const, id: ra.reservation.id, name: ra.reservation.name || `预定 #${ra.reservation.id}`, customerName: ra.reservation.customerName })),
    ];
  }
}
