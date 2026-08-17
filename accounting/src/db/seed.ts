export const seedAccounts = [
  { code: '111', name: 'Intangible assets' },
  { code: '123', name: 'Tangible assets' },
  { code: '211', name: 'Inventories' },
  { code: '221', name: 'Trade receivables' },
  { code: '225', name: 'Tax receivables' },
  { code: '241', name: 'Cash on hand' },
  { code: '2421', name: 'Current account MDL' },
  { code: '2422', name: 'Card account MDL' },
  { code: '2431', name: 'Current account FX' },
  { code: '311', name: 'Share capital' },
  { code: '332', name: 'Retained earnings' },
  { code: '411', name: 'Long-term loans' },
  { code: '521', name: 'Trade payables' },
  { code: '523', name: 'Other current payables' },
  { code: '531', name: 'Salary liabilities' },
  { code: '533', name: 'Social and medical liabilities' },
  { code: '5341', name: 'VAT payable' },
  { code: '5342', name: 'SIMM tax payable' },
  { code: '5343', name: 'Income tax payable' },
  { code: '536', name: 'Liabilities to founders' },
  { code: '611', name: 'Sales revenue' },
  { code: '612', name: 'Other operating income' },
  { code: '711', name: 'Cost of sales' },
  { code: '713', name: 'Administrative expenses' },
  { code: '714', name: 'Other operating expenses' },
  { code: '731', name: 'Tax expense' },
  { code: '999', name: 'Opening-balance clearing' },
];

export const seedCompanies = [
  {
    slug: 'global-fantastic',
    legalName: 'GLOBAL FANTASTIC S.R.L.',
    idno: '1022600056950',
    cuiio: '41594419',
    cnas: '9230672',
    caem: '7022',
    address: 'Miron Costin nr.12 of.7, sec. Rîșcani',
    administratorName: 'Popescu Mihail',
    administratorIdnp: '2002002121680',
    documentsRoot: '../companies/global-fantastic',
  },
  {
    slug: 'rare-people',
    legalName: 'RARE PEOPLE S.R.L.',
    idno: '1024600014967',
    cuiio: '41714792',
    cnas: null,
    caem: '8230',
    address: 'Miron Costin nr.12 of.7, sec. Rîșcani',
    administratorName: 'Popescu Mihail',
    administratorIdnp: '2002002121680',
    documentsRoot: '../companies/rare-people',
  },
];

export const seedTaxProfiles = [
  {
    companyId: 'global-fantastic',
    regime: 'simm24' as const,
    simmRate: '4',
    vatPayer: true,
    notes: 'Prefill from SFS SIMM24 + TVA12 filings through 2026-06.',
  },
  {
    companyId: 'rare-people',
    regime: 'simm24' as const,
    simmRate: '4',
    vatPayer: true,
    notes: 'Prefill from SFS SIMM24 + TVA12 filings. No employees in the pack.',
  },
];

export const seedObligationTemplates = [
  { companyId: 'global-fantastic', name: 'TVA12', category: 'vat', frequency: 'monthly', applicableMonths: null },
  { companyId: 'global-fantastic', name: 'IPC21', category: 'payroll', frequency: 'monthly', applicableMonths: null },
  { companyId: 'global-fantastic', name: 'SIMM24', category: 'simm', frequency: 'annual', applicableMonths: [3] },
  { companyId: 'global-fantastic', name: 'RSF1', category: 'annual', frequency: 'annual', applicableMonths: [3] },
  { companyId: 'rare-people', name: 'TVA12', category: 'vat', frequency: 'monthly', applicableMonths: null },
  { companyId: 'rare-people', name: 'SIMM24', category: 'simm', frequency: 'annual', applicableMonths: [3] },
  { companyId: 'rare-people', name: 'RSF1', category: 'annual', frequency: 'annual', applicableMonths: [3] },
];

export const seedFiscalYears = [2022, 2023, 2024, 2025, 2026];
