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
  rentalStatus?: RentalStatus;
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
    const rentalStatus: RentalStatus = (input.rentalStatus as RentalStatus) || 'Available';
    if (rentalStatus !== 'Rented' && rentalStatus !== 'Available') {
      throw new BadRequestException('rentalStatus 必须是 Rented/Available');
    }

    const base: Prisma.AssetUncheckedCreateInput = {
      type: input.type,
      imageUrls: Array.isArray(input.imageUrls) ? (input.imageUrls as Prisma.InputJsonValue) : [],
      purchaseDate: new Date(input.purchaseDate),
      price: Number(input.price),
      status: input.status,
      damageDesc: input.status === 'Damaged' ? input.damageDesc || null : null,
      rentalStatus,
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
  findAll(
    @Query('brandId') brandIdQ?: string,
    @Query('modelId') modelIdQ?: string,
    @Query('rentalStatus') rentalStatus?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sinCode') sinCode?: string,
  ) {
    const where: Prisma.AssetWhereInput = {};
    const brandId = toPositiveInt(brandIdQ);
    const modelId = toPositiveInt(modelIdQ);
    if (brandId) where.brandId = brandId;
    if (modelId) where.modelId = modelId;
    if (rentalStatus === 'Rented' || rentalStatus === 'Available') {
      where.rentalStatus = rentalStatus;
    }
    if (status === 'Normal' || status === 'Damaged') {
      where.status = status;
    }
    if (type === 'Camera' || type === 'Accessory') {
      where.type = type;
    }
    if (sinCode?.trim()) {
      where.sinCode = { contains: sinCode.trim() };
    }
    return this.prisma.asset.findMany({
      where,
      include: { brand: true, model: true },
      orderBy: { id: 'desc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.asset.findUnique({
      where: { id: Number(id) },
      include: { brand: true, model: true },
    });
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
}
