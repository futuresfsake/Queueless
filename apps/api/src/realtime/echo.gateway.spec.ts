import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { EchoGateway } from './echo.gateway';

describe('F6 WebSocket echo', () => {
  let app: INestApplication;
  let client: Socket;

  afterEach(async () => {
    client?.close();
    await app?.close();
  });

  it('a client connects over a real WebSocket and gets its message back with an ack', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [EchoGateway] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;

    client = io(`http://localhost:${port}`, { transports: ['websocket'] });
    const reply = await new Promise<{ ok: boolean; echo: unknown; serverTime: string }>((resolve, reject) => {
      client.on('connect_error', reject);
      client.on('connect', () => client.emit('echo', { hello: 'queueless' }, resolve));
    });

    expect(reply.ok).toBe(true);
    expect(reply.echo).toEqual({ hello: 'queueless' });
    expect(new Date(reply.serverTime).getTime()).not.toBeNaN();
    expect(client.io.engine.transport.name).toBe('websocket');
  });
});
