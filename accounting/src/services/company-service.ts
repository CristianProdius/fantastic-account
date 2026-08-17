import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { agentSession, companies, taxProfiles } from '../db/schema.js';

export const listCompanies = async (db: AppDb) => db.select().from(companies);

export const getCompany = async (db: AppDb, slug: string) => {
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug));
  if (!company) {
    throw new Error(`Unknown company "${slug}"`);
  }

  const [profile] = await db.select().from(taxProfiles).where(eq(taxProfiles.companyId, slug));
  return { company, profile };
};

export const getActiveCompanySlug = async (db: AppDb): Promise<string | null> => {
  const [row] = await db.select().from(agentSession).where(eq(agentSession.id, 1));
  return row?.activeCompanyId ?? null;
};

export const switchCompany = async (db: AppDb, slug: string) => {
  await getCompany(db, slug);
  await db
    .insert(agentSession)
    .values({ id: 1, activeCompanyId: slug, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: agentSession.id,
      set: { activeCompanyId: slug, updatedAt: new Date() },
    });

  return getCompany(db, slug);
};

export const resolveCompanySlug = async (db: AppDb, slug?: string | null) => {
  if (slug) {
    await getCompany(db, slug);
    return slug;
  }

  const active = await getActiveCompanySlug(db);
  if (!active) {
    throw new Error('Nicio firmă activă. Spune „treci pe Fantastic” sau „treci pe Rare People”.');
  }

  return active;
};
