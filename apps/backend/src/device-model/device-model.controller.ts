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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('device-model')
export class DeviceModelController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() data: { name: string; brandId: number }) {
    const name = data?.name?.trim();
    const brandId = Number(data?.brandId);
    if (!name) {
      throw new BadRequestException('型号名称不能为空');
    }
    if (!brandId) {
      throw new BadRequestException('请选择品牌');
    }
    try {
      return await this.prisma.deviceModel.create({ data: { name, brandId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该品牌下已存在同名型号');
      }
      throw e;
    }
  }

  @Get()
  findAll(@Query('brandId') brandId?: string) {
    const where = brandId ? { brandId: Number(brandId) } : undefined;
    return this.prisma.deviceModel.findMany({
      where,
      include: { brand: true },
      orderBy: { id: 'asc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.deviceModel.findUnique({ where: { id: Number(id) } });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; brandId?: number },
  ) {
    const update: { name?: string; brandId?: number } = {};
    if (data?.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new BadRequestException('型号名称不能为空');
      update.name = trimmed;
    }
    if (data?.brandId !== undefined) {
      const bid = Number(data.brandId);
      if (!bid) throw new BadRequestException('请选择品牌');
      update.brandId = bid;
    }
    try {
      return await this.prisma.deviceModel.update({
        where: { id: Number(id) },
        data: update,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该品牌下已存在同名型号');
      }
      throw e;
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const modelId = Number(id);
    const assetCount = await this.prisma.asset.count({ where: { modelId } });
    if (assetCount > 0) {
      throw new BadRequestException('该型号下存在关联资产，无法删除');
    }
    return this.prisma.deviceModel.delete({ where: { id: modelId } });
  }
}
