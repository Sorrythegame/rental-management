import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('brand')
export class BrandController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() data: { name: string }) {
    if (!data?.name?.trim()) {
      throw new BadRequestException('品牌名称不能为空');
    }
    try {
      return await this.prisma.brand.create({ data: { name: data.name.trim() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('品牌名称已存在');
      }
      throw e;
    }
  }

  @Get()
  findAll() {
    return this.prisma.brand.findMany({ orderBy: { id: 'asc' } });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.brand.findUnique({ where: { id: Number(id) } });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: { name: string }) {
    if (!data?.name?.trim()) {
      throw new BadRequestException('品牌名称不能为空');
    }
    try {
      return await this.prisma.brand.update({
        where: { id: Number(id) },
        data: { name: data.name.trim() },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('品牌名称已存在');
      }
      throw e;
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const brandId = Number(id);
    const modelCount = await this.prisma.deviceModel.count({ where: { brandId } });
    if (modelCount > 0) {
      throw new BadRequestException('请先清空该品牌下的所有型号');
    }
    return this.prisma.brand.delete({ where: { id: brandId } });
  }
}
