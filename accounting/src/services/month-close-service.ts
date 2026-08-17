import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import {
  monthlyObligationInstances,
  monthlyObligationTemplates,
} from '../db/schema.js';
import { listUnclassifiedBank } from './bank-import-service.js';

export const ensureObligationInstances = async (
  db: AppDb,
  input: { companyId: string; year: number; month: number },
) => {
  const templates = await db
    .select()
    .from(monthlyObligationTemplates)
    .where(
      and(
        eq(monthlyObligationTemplates.companyId, input.companyId),
        eq(monthlyObligationTemplates.active, true),
      ),
    );

  const applicable = templates.filter((template) => {
    if (template.frequency === 'monthly') return true;
    if (!template.applicableMonths || template.applicableMonths.length === 0) return true;
    return template.applicableMonths.includes(input.month);
  });

  let created = 0;
  for (const template of applicable) {
    const inserted = await db
      .insert(monthlyObligationInstances)
      .values({
        templateId: template.id,
        companyId: input.companyId,
        year: input.year,
        month: input.month,
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning();
    created += inserted.length;
  }

  return { created, applicable: applicable.length };
};

export const checkCloseReadiness = async (
  db: AppDb,
  input: { companyId: string; year: number; month: number },
) => {
  await ensureObligationInstances(db, input);
  const pending = await db
    .select()
    .from(monthlyObligationInstances)
    .where(
      and(
        eq(monthlyObligationInstances.companyId, input.companyId),
        eq(monthlyObligationInstances.year, input.year),
        eq(monthlyObligationInstances.month, input.month),
        eq(monthlyObligationInstances.status, 'pending'),
      ),
    );
  const unclassified = await listUnclassifiedBank(db, input.companyId);
  const blockingBank = unclassified.filter((row) => {
    const date = String(row.bookingDate);
    return date.startsWith(`${input.year}-${String(input.month).padStart(2, '0')}`);
  });

  return {
    ready: pending.length === 0 && blockingBank.length === 0,
    pendingObligations: pending,
    unclassifiedBank: blockingBank.length,
  };
};
