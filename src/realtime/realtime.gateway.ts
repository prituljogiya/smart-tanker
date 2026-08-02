import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { RealtimePublisherService } from './realtime-publisher.service';
import { TankersService } from '../tankers/tankers.service';

/**
 * This gateway is deliberately a separate process/service boundary from
 * the REST API (see architecture doc, section 1: "separate real-time
 * traffic from request/response traffic"). It only does two things:
 *   1. Accepts GPS streams from driver apps and republishes them to Redis.
 *   2. Lets resident/admin sockets subscribe to a specific tanker or fleet
 *      channel and forwards Redis pub/sub messages straight through.
 *
 * Scaling note: run multiple instances of this gateway behind a Socket.io
 * Redis adapter so all instances share subscription state.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly subscriber: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly tankersService: TankersService,
  ) {
    this.subscriber = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });

    // Forward every Redis pub/sub message straight to whichever socket.io
    // room shares the same name as the Redis channel.
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      this.server.to(channel).emit('update', JSON.parse(message));
    });
    this.subscriber.psubscribe('tanker:*', 'request:*', 'fleet:*');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
      client.data.tenantId = payload.tenantId;
      client.data.role = payload.role;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // no per-connection cleanup needed; room membership is handled by socket.io
  }

  /** Resident or admin subscribes to a specific tanker's live location. */
  @SubscribeMessage('subscribe:tanker')
  subscribeTanker(@ConnectedSocket() client: Socket, @MessageBody() body: { tankerId: string }) {
    const channel = this.realtimePublisher.channelForTanker(client.data.tenantId, body.tankerId);
    client.join(channel);
    return { subscribed: channel };
  }

  /** Admin dashboard subscribes to the whole fleet's live updates. */
  @SubscribeMessage('subscribe:fleet')
  subscribeFleet(@ConnectedSocket() client: Socket) {
    const channel = this.realtimePublisher.channelForFleet(client.data.tenantId);
    client.join(channel);
    return { subscribed: channel };
  }

  /** Resident subscribes to status changes on their own request. */
  @SubscribeMessage('subscribe:request')
  subscribeRequest(@ConnectedSocket() client: Socket, @MessageBody() body: { requestId: string }) {
    const channel = this.realtimePublisher.channelForRequest(client.data.tenantId, body.requestId);
    client.join(channel);
    return { subscribed: channel };
  }

  /** Driver app streams its GPS location every 5-10 seconds. */
  @SubscribeMessage('driver:location')
  async driverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tankerId: string; lat: number; lng: number },
  ) {
    if (client.data.role !== 'driver') return { error: 'forbidden' };

    const timestamp = new Date().toISOString();
    await this.tankersService.updateLocation(client.data.tenantId, body.tankerId, body.lat, body.lng);
    await this.realtimePublisher.publishTankerLocation(client.data.tenantId, body.tankerId, {
      lat: body.lat,
      lng: body.lng,
      timestamp,
    });
    return { ack: true };
  }
}
