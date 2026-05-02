import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('asset')
export class AssetController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create(@Body() data: any) {
    return this.prisma.asset.create({ data });
  }

  @Get()
  findAll() {
    return this.prisma.asset.findMany({
      include: {
        brand: true,
        model: true,
      },
      orderBy: {
        id: 'desc'
      }
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.asset.findUnique({
      where: { id: Number(id) },
      include: {
        brand: true,
        model: true,
      },
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.prisma.asset.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.asset.delete({ where: { id: Number(id) } });
  }
}
