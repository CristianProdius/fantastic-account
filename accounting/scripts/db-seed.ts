import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  seedAccounts,
  seedCompanies,
  seedFiscalYears,
  seedObligationTemplates,
  seedTaxProfiles,
} from '../src/db/seed.js';

const { Pool } = pg;
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting';

if (databaseUrl.includes(':54329') || databaseUrl.includes('prodius_accounting')) {
  throw new Error('Refusing to seed a Prodius DSN. Fantastic Account uses port 54339.');
}

const seedHere = dirname(fileURLToPath(import.meta.url));
const repoRootCandidates = [resolve(seedHere, '../..'), resolve(seedHere, '../../..')];
const repoRoot =
  repoRootCandidates.find((candidate) => existsSync(resolve(candidate, 'companies'))) ??
  repoRootCandidates[0]!;
const pool = new Pool({ connectionString: databaseUrl });

const main = async () => {
  const client = await pool.connect();
  try {
    await client.query('begin');

    for (const account of seedAccounts) {
      await client.query(
        `
          insert into accounts (code, name, is_postable, is_active)
          values ($1, $2, true, true)
          on conflict (code) do update set name = excluded.name
        `,
        [account.code, account.name],
      );
    }

    for (const company of seedCompanies) {
      const documentsRoot = resolve(repoRoot, 'companies', company.slug);
      await client.query(
        `
          insert into companies (
            slug, legal_name, idno, cuiio, cnas, caem, address,
            administrator_name, administrator_idnp, documents_root
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          on conflict (slug) do update set
            legal_name = excluded.legal_name,
            idno = excluded.idno,
            cuiio = excluded.cuiio,
            cnas = excluded.cnas,
            caem = excluded.caem,
            address = excluded.address,
            administrator_name = excluded.administrator_name,
            administrator_idnp = excluded.administrator_idnp,
            documents_root = excluded.documents_root
        `,
        [
          company.slug,
          company.legalName,
          company.idno,
          company.cuiio,
          company.cnas,
          company.caem,
          company.address,
          company.administratorName,
          company.administratorIdnp,
          documentsRoot,
        ],
      );
    }

    for (const profile of seedTaxProfiles) {
      await client.query(
        `
          insert into tax_profiles (company_id, regime, simm_rate, vat_payer, it_park, source, notes)
          values ($1, $2, $3, $4, false, 'declaration', $5)
          on conflict (company_id) do update set
            regime = excluded.regime,
            simm_rate = excluded.simm_rate,
            vat_payer = excluded.vat_payer,
            notes = excluded.notes
        `,
        [profile.companyId, profile.regime, profile.simmRate, profile.vatPayer, profile.notes],
      );
    }

    for (const company of seedCompanies) {
      for (const year of seedFiscalYears) {
        for (let month = 1; month <= 12; month += 1) {
          const status = year < 2026 ? 'locked' : 'open';
          await client.query(
            `
              insert into fiscal_periods (company_id, year, month, status)
              values ($1::varchar, $2::integer, $3::integer, $4::period_status)
              on conflict (company_id, year, month) do nothing
            `,
            [company.slug, year, month, status],
          );
        }
      }
    }

    for (const template of seedObligationTemplates) {
      await client.query(
        `
          insert into monthly_obligation_templates
            (company_id, name, category, frequency, applicable_months, active)
          select $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::integer[], true
          where not exists (
            select 1 from monthly_obligation_templates
            where company_id = $1::varchar and name = $2::varchar
          )
        `,
        [
          template.companyId,
          template.name,
          template.category,
          template.frequency,
          template.applicableMonths,
        ],
      );
    }

    await client.query(
      `insert into agent_session (id, active_company_id) values (1, null) on conflict (id) do nothing`,
    );

    await client.query('commit');
    console.log(
      `seeded ${seedCompanies.length} companies, ${seedAccounts.length} accounts, ${seedFiscalYears.length} years`,
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
