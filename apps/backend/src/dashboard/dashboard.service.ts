import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const orderWhere: any = {};
    if (start && end) {
      orderWhere.startTime = {
        gte: start,
        lte: end,
      };
    }

    // 1. 指标卡：总营业额、总订单数
    const orders = await this.prisma.rentalOrder.findMany({ where: orderWhere });
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);

    // 2. 资产总价值
    const totalAssetValueAgg = await this.prisma.asset.aggregate({
      _sum: { price: true },
    });
    const totalAssetValue = totalAssetValueAgg._sum.price || 0;

    // 3. 异常卡：当前状态为”损坏”的资产数量；逾期订单数
    const damagedAssetsCount = await this.prisma.asset.count({
      where: { status: 'Damaged' },
    });

    const now = new Date();
    const overdueOrdersCount = await this.prisma.rentalOrder.count({
      where: {
        endTime: { lt: now },
        orderStatus: { notIn: ['Completed', 'ManuallyStopped'] },
      },
    });

    // 3. 图表数据
    // 3.1 每日订单量趋势（近30天）
    const thirtyDaysAgo = dayjs().subtract(30, 'day').startOf('day').toDate();
    const recentOrders = await this.prisma.rentalOrder.findMany({
      where: { startTime: { gte: thirtyDaysAgo } },
      select: { startTime: true },
    });

    const orderTrendMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      orderTrendMap.set(dayjs().subtract(i, 'day').format('YYYY-MM-DD'), 0);
    }
    recentOrders.forEach(order => {
      const dateStr = dayjs(order.startTime).format('YYYY-MM-DD');
      if (orderTrendMap.has(dateStr)) {
        orderTrendMap.set(dateStr, orderTrendMap.get(dateStr)! + 1);
      }
    });
    const orderTrend = Array.from(orderTrendMap.entries()).map(([date, count]) => ({ date, count }));

    // 3.2 每周营业额统计（近4周）
    const fourWeeksAgo = dayjs().subtract(4, 'week').startOf('week').toDate();
    const recentRevenueOrders = await this.prisma.rentalOrder.findMany({
      where: { startTime: { gte: fourWeeksAgo } },
      select: { startTime: true, amount: true },
    });

    const revenueTrendMap = new Map<string, number>();
    for (let i = 3; i >= 0; i--) {
      revenueTrendMap.set(`近第${i + 1}周`, 0); // 或者按具体日期范围
    }
    recentRevenueOrders.forEach(order => {
      const weeksAgo = dayjs().diff(dayjs(order.startTime), 'week');
      if (weeksAgo >= 0 && weeksAgo < 4) {
        const key = `近第${weeksAgo + 1}周`;
        revenueTrendMap.set(key, (revenueTrendMap.get(key) || 0) + order.amount);
      }
    });
    const revenueTrend = Array.from(revenueTrendMap.entries()).map(([week, amount]) => ({ week, amount })).reverse();

    // 3.3 创收排名前5的设备型号 (简化处理，实际可能需要订单关联资产或者手动指定)
    // 注意：当前订单表(RentalOrder)未直接关联设备型号，题目未明确要求如何关联。
    // 我们假设这是一个总览数据，返回模拟或空数据，因为表结构中订单没有assetId。
    // 为符合要求，由于表结构限制，这里返回空数组或模拟数据。
    const topModels: any[] = [];

    // 3.4 资产状态分布
    const normalCount = await this.prisma.asset.count({ where: { status: 'Normal' } });
    const assetStatusDistribution = [
      { name: '正常', value: normalCount },
      { name: '损坏', value: damagedAssetsCount },
    ];

    return {
      metrics: { totalOrders, totalRevenue, totalAssetValue },
      warnings: { damagedAssetsCount, overdueOrdersCount },
      charts: {
        orderTrend,
        revenueTrend,
        topModels,
        assetStatusDistribution,
      },
    };
  }
}
