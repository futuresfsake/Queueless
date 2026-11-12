import 'reflect-metadata';
import { PasswordService } from '../auth/password.service';
import { SystemClock } from '../clock/clock';
import { PrismaService } from '../db/prisma.service';
import { TenantPrisma } from '../db/tenant-prisma.service';

/**
 * Demo data for the live demo and local development: one clinic, a Clinic Admin, one Staff user,
 * two service points and today's booking slots. Nothing here is real patient data (no tickets are made).
 *
 *   DEMO_PASSWORD=<12+ chars> pnpm --filter @queueless/api seed:demo
 *
 * The password comes from the environment so it is never in code or history; the demo account
 * credentials are shared with reviewers out of band (README). Idempotent: running it again resets
 * the two passwords, re-activates the users and adds only the slots that are missing.
 * Slot times are 09:00-11:30 clinic time (Asia/Manila is UTC+8 with no daylight saving).
 */
const SLUG = process.env.DEMO_SLUG ?? 'demo-clinic';
const ADMIN_EMAIL = `admin@${SLUG}.example`;
const STAFF_EMAIL = `staff@${SLUG}.example`;
const POINTS = [
  { name: 'General Consult', code: 'general', prefix: 'G', icon: 'stethoscope', description: 'Check-ups, coughs and fevers, prescriptions.' },
  { name: 'Laboratory', code: 'lab', prefix: 'L', icon: 'lab', description: 'Blood tests and lab results.' },
];
const SLOT_HOURS_LOCAL = [9, 9.5, 10, 10.5, 11, 11.5];
const SLOT_CAPACITY = 3;

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error('Set DEMO_PASSWORD (at least 12 characters)');

  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrisma(prisma);
  try {
    const passwordHash = await new PasswordService().hash(password);

    const tenant = await tenantPrisma.runAsSuperAdmin((tx) =>
      tx.tenant.upsert({
        where: { slug: SLUG },
        create: { slug: SLUG, name: 'Demo Health Center' },
        update: { isActive: true },
      }),
    );

    await tenantPrisma.run(tenant.id, async (tx) => {
      for (const [email, role] of [
        [ADMIN_EMAIL, 'CLINIC_ADMIN'],
        [STAFF_EMAIL, 'STAFF'],
      ] as const) {
        await tx.user.upsert({
          where: { email },
          create: { email, passwordHash, role, tenantId: tenant.id },
          update: { passwordHash, isActive: true },
        });
      }

      const day = new SystemClock().localDate('Asia/Manila');
      for (const p of POINTS) {
        const point =
          (await tx.servicePoint.findFirst({ where: { tenantId: tenant.id, code: p.code } })) ??
          (await tx.servicePoint.create({ data: { tenantId: tenant.id, ...p } }));
        // Re-running the seed also refreshes the hint and icon of an existing service point.
        await tx.servicePoint.update({ where: { id: point.id }, data: { description: p.description, icon: p.icon } });
        for (const h of SLOT_HOURS_LOCAL) {
          const hh = String(Math.floor(h)).padStart(2, '0');
          const mm = h % 1 ? '30' : '00';
          const startsAt = new Date(`${day}T${hh}:${mm}:00+08:00`);
          const exists = await tx.slot.findFirst({
            where: { tenantId: tenant.id, servicePointId: point.id, startsAt },
          });
          if (!exists) {
            await tx.slot.create({
              data: { tenantId: tenant.id, servicePointId: point.id, startsAt, capacity: SLOT_CAPACITY },
            });
          }
        }
      }
    });

    console.log(`Demo clinic ready: /c/${SLUG}  staff: ${STAFF_EMAIL}  admin: ${ADMIN_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
