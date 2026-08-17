import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const journalSourceEnum = pgEnum('journal_source', [
  'manual',
  'bank_import',
  'invoice',
  'payroll',
  'tax',
  'snapshot',
  'one_c_export',
]);

export const entryStatusEnum = pgEnum('entry_status', ['draft', 'posted', 'reversed']);
export const periodStatusEnum = pgEnum('period_status', ['open', 'closed', 'locked']);
export const taxRegimeEnum = pgEnum('tax_regime', ['simm24', 'ven12', 'other']);
export const obligationStatusEnum = pgEnum('obligation_status', [
  'pending',
  'completed',
  'skipped',
]);

export const companies = pgTable('companies', {
  slug: varchar('slug', { length: 64 }).primaryKey(),
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  idno: varchar('idno', { length: 13 }).notNull(),
  cuiio: varchar('cuiio', { length: 20 }),
  cnas: varchar('cnas', { length: 20 }),
  caem: varchar('caem', { length: 16 }),
  address: text('address'),
  administratorName: varchar('administrator_name', { length: 255 }).notNull(),
  administratorIdnp: varchar('administrator_idnp', { length: 13 }),
  documentsRoot: text('documents_root').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxProfiles = pgTable('tax_profiles', {
  companyId: varchar('company_id', { length: 64 })
    .primaryKey()
    .references(() => companies.slug),
  regime: taxRegimeEnum('regime').notNull().default('simm24'),
  simmRate: numeric('simm_rate', { precision: 6, scale: 3 }).notNull().default('4'),
  vatPayer: boolean('vat_payer').notNull().default(true),
  itPark: boolean('it_park').notNull().default(false),
  source: varchar('source', { length: 32 }).notNull().default('declaration'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const onboardingAnswers = pgTable(
  'onboarding_answers',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    questionKey: varchar('question_key', { length: 64 }).notNull(),
    value: text('value').notNull(),
    skipped: boolean('skipped').notNull().default(false),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    onboardingCompanyQuestionUnique: uniqueIndex('uq_onboarding_company_question').on(
      table.companyId,
      table.questionKey,
    ),
  }),
);

export const agentSession = pgTable('agent_session', {
  id: integer('id').primaryKey().default(1),
  activeCompanyId: varchar('active_company_id', { length: 64 }).references(
    () => companies.slug,
  ),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  code: varchar('code', { length: 10 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  isPostable: boolean('is_postable').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
});

export const fiscalPeriods = pgTable(
  'fiscal_periods',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    status: periodStatusEnum('status').notNull().default('open'),
  },
  (table) => ({
    fiscalPeriodsCompanyYearMonthUnique: uniqueIndex('uq_fiscal_periods_company_year_month').on(
      table.companyId,
      table.year,
      table.month,
    ),
  }),
);

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: varchar('company_id', { length: 64 })
    .notNull()
    .references(() => companies.slug),
  date: date('date').notNull(),
  description: text('description').notNull(),
  reference: varchar('reference', { length: 120 }),
  source: journalSourceEnum('source').notNull(),
  status: entryStatusEnum('status').notNull().default('draft'),
  reversalOfId: uuid('reversal_of_id').references((): AnyPgColumn => journalEntries.id),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const journalLines = pgTable(
  'journal_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),
    lineNo: integer('line_no').notNull(),
    accountCode: varchar('account_code', { length: 10 })
      .notNull()
      .references(() => accounts.code),
    debit: numeric('debit', { precision: 15, scale: 2 }).notNull(),
    credit: numeric('credit', { precision: 15, scale: 2 }).notNull(),
  },
  (table) => ({
    journalLinesEntryLineNoUnique: uniqueIndex('uq_journal_lines_entry_line_no').on(
      table.entryId,
      table.lineNo,
    ),
  }),
);

export const bankAccounts = pgTable('bank_accounts', {
  iban: varchar('iban', { length: 34 }).primaryKey(),
  companyId: varchar('company_id', { length: 64 })
    .notNull()
    .references(() => companies.slug),
  currency: varchar('currency', { length: 3 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  accountCode: varchar('account_code', { length: 10 })
    .notNull()
    .references(() => accounts.code),
});

export const bankStatementImports = pgTable(
  'bank_statement_imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    bankAccountIban: varchar('bank_account_iban', { length: 34 })
      .notNull()
      .references(() => bankAccounts.iban),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSha256: text('file_sha256').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bankImportsUnique: uniqueIndex('uq_bank_imports_company_sha').on(
      table.companyId,
      table.fileSha256,
    ),
  }),
);

export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    importId: uuid('import_id')
      .notNull()
      .references(() => bankStatementImports.id, { onDelete: 'cascade' }),
    bookingDate: date('booking_date').notNull(),
    direction: varchar('direction', { length: 16 }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    counterpartyName: text('counterparty_name'),
    description: text('description'),
    fingerprint: text('fingerprint').notNull(),
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
    importRowNumber: integer('import_row_number').notNull(),
  },
  (table) => ({
    bankTxnFingerprintUnique: uniqueIndex('uq_bank_txn_company_fingerprint').on(
      table.companyId,
      table.fingerprint,
    ),
  }),
);

export const declarations = pgTable(
  'declarations',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    sfsId: varchar('sfs_id', { length: 32 }).notNull(),
    formType: varchar('form_type', { length: 32 }).notNull(),
    period: varchar('period', { length: 32 }),
    year: integer('year'),
    month: integer('month'),
    fiscalCode: varchar('fiscal_code', { length: 13 }),
    companyName: varchar('company_name', { length: 255 }),
    extracted: jsonb('extracted').notNull().default({}),
    xmlPath: text('xml_path'),
    pdfPath: text('pdf_path'),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    declarationsCompanySfsUnique: uniqueIndex('uq_declarations_company_sfs').on(
      table.companyId,
      table.sfsId,
    ),
  }),
);

export const employees = pgTable(
  'employees',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    idnp: varchar('idnp', { length: 13 }).notNull(),
    active: boolean('active').notNull().default(true),
    source: varchar('source', { length: 32 }).notNull().default('declaration'),
  },
  (table) => ({
    employeesCompanyIdnpUnique: uniqueIndex('uq_employees_company_idnp').on(
      table.companyId,
      table.idnp,
    ),
  }),
);

export const monthlyObligationTemplates = pgTable('monthly_obligation_templates', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  companyId: varchar('company_id', { length: 64 })
    .notNull()
    .references(() => companies.slug),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  frequency: varchar('frequency', { length: 32 }).notNull(),
  applicableMonths: integer('applicable_months').array(),
  active: boolean('active').notNull().default(true),
});

export const monthlyObligationInstances = pgTable(
  'monthly_obligation_instances',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    templateId: integer('template_id')
      .notNull()
      .references(() => monthlyObligationTemplates.id),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    status: obligationStatusEnum('status').notNull().default('pending'),
    amount: numeric('amount', { precision: 15, scale: 2 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: varchar('completed_by', { length: 100 }),
    evidenceNote: text('evidence_note'),
  },
  (table) => ({
    obligationInstanceUnique: uniqueIndex('uq_obligation_instance').on(
      table.templateId,
      table.year,
      table.month,
    ),
  }),
);

export const oneCExportFiles = pgTable(
  'one_c_export_files',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    companyId: varchar('company_id', { length: 64 })
      .notNull()
      .references(() => companies.slug),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    filePath: text('file_path').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
  },
  (table) => ({
    oneCExportUnique: uniqueIndex('uq_one_c_export_company_file').on(
      table.companyId,
      table.fileName,
    ),
  }),
);
