import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('brand')
export class BrandController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create(@Body() data: { name: string }) {
    return this.prisma.brand.create({ data });
  }

  @Get()
  findAll() {
    return this.prisma.brand.findMany();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.brand.findUnique({ where: { id: Number(id) } });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: { name: string }) {
    return this.prisma.brand.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.brand.delete({ where: { id: Number(id) } });
  }
}
