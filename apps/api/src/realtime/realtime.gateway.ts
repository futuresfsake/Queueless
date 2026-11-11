import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import type { JwtPayload, RequestUser } from "../auth/auth.types";
import { Public } from "../auth/decorators";
import { TenantPrisma } from "../db/tenant-prisma.service";

const SubscribeBody = z.object({ servicePointId: z.string().uuid() });

export const QUEUE_CHANGED = "queue.changed";
export const roomFor = (tenantId: string, servicePointId: string) =>
  `sp:${tenantId}:${servicePointId}`;

/**
 * Staff real-time channel (M2). The socket carries NO queue data, only a "something changed"
 * signal; clients refetch the snapshot over HTTP. That keeps authorization in one place (the
 * HTTP guards) and avoids a missed-event cursor (TRD section 11).
 *
 * Auth: the JWT is sent in the handshake (`auth.token`) and verified the same way AuthGuard does,
 * including the live-user re-check. HTTP guards do not run on socket connections, so @Public()
 * here only opts out of the global guards; connection auth is done in handleConnection.
 */
@Public()
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(","),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit {
  private readonly log = new Logger(RealtimeGateway.name);
  @WebSocketServer() private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly tenantPrisma: TenantPrisma,
  ) {}

  /**
   * Socket.IO middleware, not handleConnection: the handshake only completes once next() is called,
   * so a client can never emit before it is authenticated (handleConnection runs after "connect").
   */
  afterInit(server: Server): void {
    server.use(async (client, next) => {
      try {
        const token = client.handshake.auth?.token;
        if (typeof token !== 'string' || !token) throw new Error('no token');
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, { algorithms: ['HS256'] });
        const user = await this.auth.resolveUser(payload);
        if (!user) throw new Error('inactive user');
        client.data.user = user;
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });
  }

  /** Join the room for one service point of the caller's own tenant. Ack: `{ ok }` or `{ ok:false, code }`. */
  @SubscribeMessage("subscribe")
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const user = client.data.user as RequestUser | undefined;
    const parsed = SubscribeBody.safeParse(body);
    if (!user?.tenantId) return { ok: false, code: "FORBIDDEN" };
    if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };
    const { servicePointId } = parsed.data;
    const tenantId = user.tenantId;
    // RLS plus the explicit tenant filter: a staff user cannot join another tenant's room.
    const point = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.servicePoint.findFirst({
        where: { id: servicePointId, tenantId },
        select: { id: true },
      }),
    );
    if (!point) return { ok: false, code: "NOT_FOUND" };
    await client.join(roomFor(tenantId, servicePointId));
    return { ok: true };
  }

  /** Called by RealtimeService AFTER the database transaction committed. */
  emitQueueChanged(tenantId: string, servicePointId: string): void {
    try {
      this.server
        ?.to(roomFor(tenantId, servicePointId))
        .emit(QUEUE_CHANGED, { servicePointId });
    } catch (err) {
      // A failed push must never fail a request whose data is already committed.
      this.log.warn(`emit failed: ${(err as Error).message}`);
    }
  }
}
