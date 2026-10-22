import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Prisma connects lazily on first query. Try an eager connect for fast
    // feedback, but never crash boot when the DB is temporarily unreachable —
    // the health endpoint must still answer while the DB comes back.
    try {
      await this.$connect();
    } catch {
      this.logger.warn('Database not reachable at startup; will retry lazily on first query.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
