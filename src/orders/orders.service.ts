import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE } from 'src/db/db.module';
import { DrizzleDB } from 'src/db/drizzle';
import { Order, orders } from 'src/db/schema';
import { QueriesDto } from 'src/dtos/queries.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(queries: QueriesDto, userId?: string) {
    const whereClause = [];

    if (userId) {
      whereClause.push(
        eq(orders.user_id, userId),
        or(eq(orders.status, 'shipping'), eq(orders.status, 'finished')),
      );
    }

    if (queries.query) {
      whereClause.push(
        or(
          ilike(orders.price, `%${queries.query}%`),
          ilike(orders.created_at, `%${queries.query}%`),
        ),
      );
    }

    const dbOrders = await this.db.query.orders.findMany({
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
            avatar_url: true,
            cover_url: true,
            phone: true,
            role: true,
          },
        },
        order_items: {
          columns: {},
          with: {
            product: true,
          },
        },
      },
      limit: queries.limit,
      offset: queries.limit * (queries.page - 1),
      where: and(...whereClause),
    });

    return {
      success: true,
      message: 'Got the orders successfully',
      data: { orders: dbOrders },
    };
  }

  async findOne(orderId: string, userId?: string) {
    const order = await this.db.query.orders.findFirst({
      where: (category, { eq }) => eq(category.id, orderId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
            avatar_url: true,
            cover_url: true,
            phone: true,
            role: true,
          },
        },
        order_items: {
          columns: {},
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order is not found');
    }

    if (order && order.user_id !== userId) {
      throw new NotFoundException('Order is not found');
    }

    return {
      success: true,
      message: 'Gettint the order successfully',
      data: { order },
    };
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = (
      await this.db
        .update(orders)
        .set({ ...updateOrderDto } as Order)
        .where(eq(orders.id, id))
        .returning()
    )[0];

    if (!order) {
      throw new InternalServerErrorException(
        'Error happened during updating the order',
      );
    }

    return {
      success: true,
      message: 'Order updated successfully',
      data: { order },
    };
  }

  async remove(id: string) {
    const order = await this.db.query.orders.findFirst({
      where: (category, { eq }) => eq(category.id, id),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
            avatar_url: true,
            cover_url: true,
            phone: true,
            role: true,
          },
        },
        order_items: {
          columns: {},
          with: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order is not exist');
    }

    await this.db.delete(orders).where(eq(orders.id, id));

    return {
      success: true,
      message: 'Order deleted successfully',
      data: { order },
    };
  }
}
