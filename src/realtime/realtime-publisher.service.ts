import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Publishes events onto per-tanker and per-request Redis channels. The
 * WebSocket gateway (realtime.gateway.ts) subscribes to these same
 * channels and fans messages out only to the sockets currently watching
 * that specific tanker/request - never a global broadcast.
 */
@Injectable()
export class RealtimePublisherService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });
  }

  channelForTanker(tenantId: string, tankerId: string): string {
    return `tanker:${tenantId}:${tankerId}:location`;
  }

  channelForRequest(tenantId: string, requestId: string): string {
    return `request:${tenantId}:${requestId}:status`;
  }

  channelForFleet(tenantId: string): string {
    return `fleet:${tenantId}:updates`;
  }

  async publishTankerLocation(
    tenantId: string,
    tankerId: string,
    payload: { lat: number; lng: number; timestamp: string },
  ): Promise<void> {
    await this.redis.publish(this.channelForTanker(tenantId, tankerId), JSON.stringify(payload));
    await this.redis.publish(this.channelForFleet(tenantId), JSON.stringify({ tankerId, ...payload }));
  }

  async publishRequestUpdate(tenantId: string, requestId: string, payload: Record<string, any>): Promise<void> {
    await this.redis.publish(this.channelForRequest(tenantId, requestId), JSON.stringify(payload));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
