import type { AppDb } from '../db/client.js';
import { listUnclassifiedBank } from '../services/bank-import-service.js';
import { getActiveCompanySlug, getCompany, listCompanies } from '../services/company-service.js';
import { listDeclarations } from '../services/declaration-import-service.js';
import { getTrialBalance } from '../services/journal-service.js';
import { getOnboardingStatus } from '../services/onboarding-service.js';
import { whatDoIOwe } from '../services/tax-due-service.js';

const requireDb = (deps?: { db?: AppDb }) => {
  if (!deps?.db) {
    throw new Error('MCP resources require a database connection (set DATABASE_URL)');
  }
  return deps.db;
};

export const readResource = async (uri: string, deps?: { db?: AppDb }) => {
  const db = requireDb(deps);

  if (uri === 'session://active-company') {
    const slug = await getActiveCompanySlug(db);
    return { activeCompanyId: slug, companies: await listCompanies(db) };
  }

  if (uri === 'onboarding://status') {
    const slug = await getActiveCompanySlug(db);
    if (!slug) return { error: 'no active company' };
    return getOnboardingStatus(db, slug);
  }

  const companyProfile = uri.match(/^company:\/\/([^/]+)\/profile$/);
  if (companyProfile?.[1]) {
    return getCompany(db, companyProfile[1]);
  }

  const companyDeclarations = uri.match(/^company:\/\/([^/]+)\/declarations$/);
  if (companyDeclarations?.[1]) {
    return listDeclarations(db, { companyId: companyDeclarations[1] });
  }

  if (uri.startsWith('accounts://trial-balance')) {
    const parsed = new URL(uri);
    const company = parsed.searchParams.get('company');
    if (!company) throw new Error('accounts://trial-balance requires company');
    return getTrialBalance(db, company);
  }

  if (uri.startsWith('tax://what-do-i-owe')) {
    const parsed = new URL(uri);
    const company = parsed.searchParams.get('company');
    const period = parsed.searchParams.get('period');
    if (!company || !period) throw new Error('tax://what-do-i-owe requires company and period');
    const [year, month] = period.split('-').map(Number);
    return whatDoIOwe(db, { companyId: company, year, month });
  }

  if (uri.startsWith('bank://unclassified')) {
    const parsed = new URL(uri);
    const company = parsed.searchParams.get('company');
    if (!company) throw new Error('bank://unclassified requires company');
    return listUnclassifiedBank(db, company);
  }

  throw new Error(`Unknown resource ${uri}`);
};
