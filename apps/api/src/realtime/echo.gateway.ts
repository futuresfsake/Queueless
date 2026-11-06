import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Public } from '../auth/decorators';

/**
 * F6 hello-world only: proves WebSockets work end to end on the host (Railway) from the web origin (Vercel).
 * It carries no data and no auth. M2 replaces it with the real queue gateway (rooms, JWT / ticket-token auth).
 */
@Public()
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','), credentials: true },
})
export class EchoGateway {
  /** Client emits `echo` with any payload and an ack callback; the ack receives `{ ok, echo, serverTime }`. */
  @SubscribeMessage('echo')
  echo(@MessageBody() body: unknown) {
    return { ok: true, echo: body, serverTime: new Date().toISOString() }; // hello-world: not business logic
  }
}
