import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OrgRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from './realtime.service';

type JwtPayload = {
  sub: string;
  email: string;
  fullName: string;
  orgId?: string;
  role?: OrgRole;
};

type SocketUser = {
  id: string;
  email: string;
  fullName: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
  path: '/ws',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    this.logger.log('WebSocket gateway ready at path /ws');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { message: 'Missing access token' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      const user: SocketUser = {
        id: payload.sub,
        email: payload.email,
        fullName: payload.fullName,
      };
      client.data.user = user;
      await client.join(`user:${user.id}`);

      if (payload.orgId) {
        const member = await this.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: payload.orgId,
              userId: user.id,
            },
          },
        });
        if (member) {
          await client.join(`org:${payload.orgId}`);
          client.data.orgId = payload.orgId;
          client.data.role = member.role;
        }
      }

      client.emit('connected', {
        userId: user.id,
        orgId: client.data.orgId ?? null,
      });
      this.logger.debug(`Socket connected ${client.id} user=${user.id}`);
    } catch {
      client.emit('error', { message: 'Invalid or expired access token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected ${client.id}`);
  }

  @SubscribeMessage('join')
  async joinOrg(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orgId?: string; deploymentId?: string },
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user?.id || !body?.orgId) {
      return { ok: false, error: 'orgId required' };
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: body.orgId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      return { ok: false, error: 'Not a member of this organization' };
    }

    // Leave previous org room if switching
    if (client.data.orgId && client.data.orgId !== body.orgId) {
      await client.leave(`org:${client.data.orgId}`);
    }

    await client.join(`org:${body.orgId}`);
    client.data.orgId = body.orgId;
    client.data.role = membership.role;

    if (body.deploymentId) {
      await client.join(`deployment:${body.deploymentId}`);
    }

    return {
      ok: true,
      orgId: body.orgId,
      role: membership.role,
      rooms: [...client.rooms],
    };
  }

  @SubscribeMessage('leave')
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orgId?: string; deploymentId?: string },
  ) {
    if (body?.orgId) {
      await client.leave(`org:${body.orgId}`);
      if (client.data.orgId === body.orgId) {
        client.data.orgId = undefined;
      }
    }
    if (body?.deploymentId) {
      await client.leave(`deployment:${body.deploymentId}`);
    }
    return { ok: true };
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      return auth.token;
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }
    if (Array.isArray(queryToken) && queryToken[0]) {
      return queryToken[0];
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }
}
