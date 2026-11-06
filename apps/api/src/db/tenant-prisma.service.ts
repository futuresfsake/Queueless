import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type Tx = Prisma.TransactionClient;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The only way to touch tenant data (ADR-001, INV-7).
 *
 * Every call opens ONE transaction and sets transaction-local settings with
 * set_config(name, value, true). "true" = local: the value disappears at COMMIT/ROLLBACK, so a
 * pooled connection can never carry one request's tenant into the next. RLS policies read these
 * settings; with nothing set they match no rows (fail closed).
 */
@Injectable()
export class TenantPrisma {
  constructor(private readonly prisma: PrismaService) {}

  /** Normal tenant-scoped work (staff, clinic admin, public pages once the tenant is known). */
  run<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!UUID_RE.test(tenantId)) throw new Error('TenantPrisma.run: tenantId must be a UUID');
    return this.exec({ 'app.tenant_id': tenantId }, fn);
  }

  /** Super Admin only: tenant management and cross-tenant user administration. Caller must have authorized the role. */
  runAsSuperAdmin<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.exec({ 'app.is_super_admin': 'true' }, fn);
  }

  /** Login: allows reading exactly the user row with this email (policy users_login_lookup). */
  runForLogin<T>(email: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.exec({ 'app.login_email': email.toLowerCase() }, fn);
  }

  /** Guest patient: allows reading exactly the ticket with this token (policy ticket_token_lookup). */
  runForTicketToken<T>(token: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.exec({ 'app.ticket_token': token }, fn);
  }

  private exec<T>(settings: Record<string, string>, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      for (const [name, value] of Object.entries(settings)) {
        // Parameterized: never string-concatenate tenant input into SQL.
        await tx.$executeRaw`SELECT set_config(${name}, ${value}, true)`;
      }
      return fn(tx);
    });
  }
}
