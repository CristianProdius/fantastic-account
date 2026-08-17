import type { AppDb } from '../db/client.js';
import { importBankFolder } from '../services/bank-import-service.js';
import { getCompany, resolveCompanySlug, switchCompany } from '../services/company-service.js';
import {
  importDeclarations,
  listDeclarations,
} from '../services/declaration-import-service.js';
import { setPeriodStatus } from '../services/journal-service.js';
import { checkCloseReadiness } from '../services/month-close-service.js';
import {
  completeOnboarding,
  getOnboardingStatus,
  saveOnboardingAnswer,
} from '../services/onboarding-service.js';
import { importOneCExports } from '../services/one-c-export-service.js';
import { reconstructFromDeclarations } from '../services/snapshot-journal-service.js';
import { whatDoIOwe } from '../services/tax-due-service.js';
import { getTeacher } from '../services/teacher.js';

const resolveDb = (deps?: { db?: AppDb }) => {
  if (!deps?.db) {
    throw new Error('MCP tools require a database connection (set DATABASE_URL)');
  }
  return deps.db;
};

type ToolArgs = Record<string, unknown>;

export const callTool = async (name: string, args: ToolArgs, deps?: { db?: AppDb }) => {
  const db = resolveDb(deps);

  switch (name) {
    case 'get_teacher':
      return getTeacher();
    case 'switch_company':
      return switchCompany(db, String(args.slug));
    case 'get_onboarding_status': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return getOnboardingStatus(db, slug);
    }
    case 'save_onboarding_answer': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return saveOnboardingAnswer(db, {
        companyId: slug,
        questionKey: String(args.questionKey),
        value: args.value ? String(args.value) : undefined,
        skip: Boolean(args.skip),
      });
    }
    case 'complete_onboarding': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return completeOnboarding(db, slug);
    }
    case 'import_declarations': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      const imported = await importDeclarations(db, slug);
      const reconstructed = await reconstructFromDeclarations(db, slug);
      return { imported, reconstructed };
    }
    case 'import_one_c_exports': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return importOneCExports(db, slug);
    }
    case 'import_bank_folder': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return importBankFolder(db, { companyId: slug, iban: args.iban ? String(args.iban) : undefined });
    }
    case 'what_do_i_owe': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      const now = new Date();
      return whatDoIOwe(db, {
        companyId: slug,
        year: Number(args.year ?? now.getFullYear()),
        month: Number(args.month ?? now.getMonth() + 1),
      });
    }
    case 'list_declarations': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return listDeclarations(db, {
        companyId: slug,
        formType: args.formType ? String(args.formType) : undefined,
        year: args.year ? Number(args.year) : undefined,
      });
    }
    case 'set_period_status': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return setPeriodStatus(db, {
        companyId: slug,
        year: Number(args.year),
        month: Number(args.month),
        status: args.status as 'open' | 'closed' | 'locked',
      });
    }
    case 'check_close_readiness': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return checkCloseReadiness(db, {
        companyId: slug,
        year: Number(args.year),
        month: Number(args.month),
      });
    }
    case 'get_company_profile': {
      const slug = await resolveCompanySlug(db, args.companySlug ? String(args.companySlug) : null);
      return getCompany(db, slug);
    }
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
};
