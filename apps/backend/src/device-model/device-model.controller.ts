import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('device-model')
export class DeviceModelController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create(@Body() data: { name: string; brandId: number }) {
    return this.prisma.deviceModel.create({ data });
  }

  @Get()
  findAll(@Query('brandId') brandId?: string) {
    if (brandId) {
      return this.prisma.deviceModel.findMany({
        where: { brandId: Number(brandId) },
        include: { brand: true },
      });
    }
    return this.prisma.deviceModel.findMany({
      include: { brand: true },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.deviceModel.findUnique({ where: { id: Number(id) } });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; brandId?: number }) {
    return this.prisma.deviceModel.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.deviceModel.delete({ where: { id: Number(id) } });
  }
}
