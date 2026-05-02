import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('rental-order')
export class RentalOrderController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create(@Body() data: any) {
    return this.prisma.rentalOrder.create({ data });
  }

  @Get()
  findAll(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const where: any = {};
    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    return this.prisma.rentalOrder.findMany({
      where,
      orderBy: {
        id: 'desc'
      }
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.rentalOrder.findUnique({
      where: { id: Number(id) }
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.prisma.rentalOrder.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.rentalOrder.delete({ where: { id: Number(id) } });
  }
}
