export type TrialBalanceRow = {
  accountCode: string;
  debit: number;
  credit: number;
};

const delimiterOf = (text: string) => (text.includes(';') ? ';' : ',');

const splitCsvLine = (line: string, delimiter: string) =>
  line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ''));

const toNumber = (value: string | undefined) => {
  if (!value) return 0;
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeAccountCode = (raw: string): string | null => {
  const compact = raw.replace(/\s/g, '').replace(/\./g, '');
  if (!/^\d{3,5}$/.test(compact)) return null;
  return compact;
};

export const dateFromOneCFileName = (fileName: string): string | null => {
  const iso = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = fileName.match(/(\d{2})[.](\d{2})[.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const year = fileName.match(/(20\d{2})/);
  if (year) return `${year[1]}-12-31`;
  return null;
};

const headerIndex = (header: string[], patterns: RegExp[]) =>
  header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));

const looksLikeHeader = (cells: string[]) => {
  const joined = cells.join(' ').toLowerCase();
  return (
    /(cont|cod|account)/i.test(joined) && /(debit|credit|sold|rulaj)/i.test(joined)
  );
};

export const parseCsvTrialBalance = (text: string): TrialBalanceRow[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let accountIdx = 0;
  let debitIdx = 1;
  let creditIdx = 2;
  let start = 0;
  const delimiter = delimiterOf(text);

  const headerLine = lines.findIndex((line) => looksLikeHeader(splitCsvLine(line, delimiter)));
  if (headerLine >= 0) {
    const header = splitCsvLine(lines[headerLine] ?? '', delimiter).map((cell) => cell.toLowerCase());
    const foundAccount = headerIndex(header, [/^cont/, /cod/, /account/]);
    const soldFinalDebit = headerIndex(header, [/sold.*final.*d/, /sold\s*sf/, /sf[aă]r[sș]it.*d/]);
    const soldFinalCredit = headerIndex(header, [/sold.*final.*c/, /sold\s*sf.*c/, /sf[aă]r[sș]it.*c/]);
    const debit = headerIndex(header, [/^debit$/, /sold.*debit/, /\bdt\b/]);
    const credit = headerIndex(header, [/^credit$/, /sold.*credit/, /\bct\b/]);

    accountIdx = foundAccount >= 0 ? foundAccount : 0;
    if (soldFinalDebit >= 0 && soldFinalCredit >= 0) {
      debitIdx = soldFinalDebit;
      creditIdx = soldFinalCredit;
    } else if (debit >= 0 && credit >= 0) {
      debitIdx = debit;
      creditIdx = credit;
    }
    start = headerLine + 1;
  }

  const rows: TrialBalanceRow[] = [];
  for (const line of lines.slice(start)) {
    const parts = splitCsvLine(line, delimiter);
    const accountCode =
      normalizeAccountCode(parts[accountIdx] ?? '') ??
      normalizeAccountCode(parts.find((part) => normalizeAccountCode(part) !== null) ?? '');
    if (!accountCode) continue;
    const debit = toNumber(parts[debitIdx]);
    const credit = toNumber(parts[creditIdx]);
    if (debit === null || credit === null) continue;
    if (debit === 0 && credit === 0) continue;
    rows.push({ accountCode, debit, credit });
  }

  return rows;
};
