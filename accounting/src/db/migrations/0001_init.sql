CREATE TYPE journal_source AS ENUM (
  'manual',
  'bank_import',
  'invoice',
  'payroll',
  'tax',
  'snapshot',
  'one_c_export'
);

CREATE TYPE entry_status AS ENUM ('draft', 'posted', 'reversed');
CREATE TYPE period_status AS ENUM ('open', 'closed', 'locked');
CREATE TYPE tax_regime AS ENUM ('simm24', 'ven12', 'other');
CREATE TYPE obligation_status AS ENUM ('pending', 'completed', 'skipped');

CREATE TABLE companies (
  slug varchar(64) PRIMARY KEY,
  legal_name varchar(255) NOT NULL,
  idno varchar(13) NOT NULL,
  cuiio varchar(20),
  cnas varchar(20),
  caem varchar(16),
  address text,
  administrator_name varchar(255) NOT NULL,
  administrator_idnp varchar(13),
  documents_root text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tax_profiles (
  company_id varchar(64) PRIMARY KEY REFERENCES companies(slug),
  regime tax_regime NOT NULL DEFAULT 'simm24',
  simm_rate numeric(6, 3) NOT NULL DEFAULT 4,
  vat_payer boolean NOT NULL DEFAULT true,
  it_park boolean NOT NULL DEFAULT false,
  source varchar(32) NOT NULL DEFAULT 'declaration',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_answers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  question_key varchar(64) NOT NULL,
  value text NOT NULL,
  skipped boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_onboarding_company_question
  ON onboarding_answers (company_id, question_key);

CREATE TABLE agent_session (
  id integer PRIMARY KEY DEFAULT 1,
  active_company_id varchar(64) REFERENCES companies(slug),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_session_singleton CHECK (id = 1)
);

CREATE TABLE accounts (
  code varchar(10) PRIMARY KEY,
  name varchar(255) NOT NULL,
  is_postable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE fiscal_periods (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  year integer NOT NULL,
  month integer NOT NULL,
  status period_status NOT NULL DEFAULT 'open'
);

CREATE UNIQUE INDEX uq_fiscal_periods_company_year_month
  ON fiscal_periods (company_id, year, month);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  date date NOT NULL,
  description text NOT NULL,
  reference varchar(120),
  source journal_source NOT NULL,
  status entry_status NOT NULL DEFAULT 'draft',
  reversal_of_id uuid REFERENCES journal_entries(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  account_code varchar(10) NOT NULL REFERENCES accounts(code),
  debit numeric(15, 2) NOT NULL,
  credit numeric(15, 2) NOT NULL,
  CONSTRAINT journal_lines_debit_xor_credit CHECK (
    (debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0)
  )
);

CREATE UNIQUE INDEX uq_journal_lines_entry_line_no
  ON journal_lines (entry_id, line_no);

CREATE TABLE bank_accounts (
  iban varchar(34) PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  currency varchar(3) NOT NULL,
  name varchar(100) NOT NULL,
  bank_name varchar(100) NOT NULL,
  account_code varchar(10) NOT NULL REFERENCES accounts(code)
);

CREATE TABLE bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  bank_account_iban varchar(34) NOT NULL REFERENCES bank_accounts(iban),
  file_name varchar(255) NOT NULL,
  file_sha256 text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_bank_imports_company_sha
  ON bank_statement_imports (company_id, file_sha256);

CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  import_id uuid NOT NULL REFERENCES bank_statement_imports(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  direction varchar(16) NOT NULL,
  amount numeric(15, 2) NOT NULL,
  currency varchar(3) NOT NULL,
  counterparty_name text,
  description text,
  fingerprint text NOT NULL,
  journal_entry_id uuid REFERENCES journal_entries(id),
  import_row_number integer NOT NULL
);

CREATE UNIQUE INDEX uq_bank_txn_company_fingerprint
  ON bank_transactions (company_id, fingerprint);

CREATE TABLE declarations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  sfs_id varchar(32) NOT NULL,
  form_type varchar(32) NOT NULL,
  period varchar(32),
  year integer,
  month integer,
  fiscal_code varchar(13),
  company_name varchar(255),
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  xml_path text,
  pdf_path text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_declarations_company_sfs
  ON declarations (company_id, sfs_id);

CREATE TABLE employees (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  full_name varchar(255) NOT NULL,
  idnp varchar(13) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source varchar(32) NOT NULL DEFAULT 'declaration'
);

CREATE UNIQUE INDEX uq_employees_company_idnp
  ON employees (company_id, idnp);

CREATE TABLE monthly_obligation_templates (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  name varchar(255) NOT NULL,
  category varchar(64) NOT NULL,
  frequency varchar(32) NOT NULL,
  applicable_months integer[],
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE monthly_obligation_instances (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id integer NOT NULL REFERENCES monthly_obligation_templates(id),
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  year integer NOT NULL,
  month integer NOT NULL,
  status obligation_status NOT NULL DEFAULT 'pending',
  amount numeric(15, 2),
  completed_at timestamptz,
  completed_by varchar(100),
  evidence_note text
);

CREATE UNIQUE INDEX uq_obligation_instance
  ON monthly_obligation_instances (template_id, year, month);

CREATE TABLE one_c_export_files (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id varchar(64) NOT NULL REFERENCES companies(slug),
  file_name varchar(255) NOT NULL,
  kind varchar(32) NOT NULL,
  file_path text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE UNIQUE INDEX uq_one_c_export_company_file
  ON one_c_export_files (company_id, file_name);
