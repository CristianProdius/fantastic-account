export type ParsedDeclaration = {
  formType: string;
  fiscalCode: string | null;
  companyName: string | null;
  period: string | null;
  year: number | null;
  month: number | null;
  extracted: Record<string, unknown>;
};

const tag = (xml: string, name: string): string | null => {
  const match = xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'));
  const value = match?.[1]?.trim();
  return value ? value.replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
};

const numberTag = (xml: string, name: string): number | null => {
  const raw = tag(xml, name);
  if (!raw) return null;
  const parsed = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parsePeriod = (
  datefisc: string | null,
): { period: string | null; year: number | null; month: number | null } => {
  if (!datefisc) {
    return { period: null, year: null, month: null };
  }

  const annual = datefisc.match(/^A\/(\d{4})$/i);
  if (annual) {
    return { period: datefisc, year: Number(annual[1]), month: null };
  }

  const monthly = datefisc.match(/^L\/(\d{1,2})\/(\d{4})$/i);
  if (monthly) {
    return { period: datefisc, year: Number(monthly[2]), month: Number(monthly[1]) };
  }

  const quarter = datefisc.match(/^T\/(\d)\/(\d{4})$/i);
  if (quarter) {
    return { period: datefisc, year: Number(quarter[2]), month: Number(quarter[1]) * 3 };
  }

  const semester = datefisc.match(/^S\/(\d)\/(\d{4})$/i);
  if (semester) {
    return { period: datefisc, year: Number(semester[2]), month: Number(semester[1]) * 6 };
  }

  return { period: datefisc, year: null, month: null };
};

const extractSimm = (xml: string) => ({
  taxableBase: numberTag(xml, 'r6c2') ?? numberTag(xml, 'r1c2'),
  rate: numberTag(xml, 'r7c2'),
  taxDue: numberTag(xml, 'r9c2'),
  revenue: numberTag(xml, 'r1c2'),
});

const extractTva = (xml: string) => ({
  deductibleBase: numberTag(xml, 'ndsSum7t'),
  deductibleVat: numberTag(xml, 'sum7t'),
  outputBase: numberTag(xml, 'ndsSum2t'),
  outputVat: numberTag(xml, 'sum2t'),
});

const extractRsf1 = (xml: string) => ({
  asOf: tag(xml, 'date'),
  from: tag(xml, 'from'),
  to: tag(xml, 'to'),
  totalAssets: numberTag(xml, 'r110c5') ?? numberTag(xml, 'r110c4'),
  totalEquityAndLiabilities: numberTag(xml, 'r230c5') ?? numberTag(xml, 'r230c4'),
  cash: numberTag(xml, 'r090c5'),
  currentAssets: numberTag(xml, 'r100c5'),
  revenueCurrent: numberTag(xml, 'r010c4'),
  revenuePrior: numberTag(xml, 'r010c3'),
  responsible: tag(xml, 'respons'),
  employees: numberTag(xml, 'nrEmployees'),
  employeesAbsent: numberTag(xml, 'employeesAbs'),
});

const extractIpc21Employees = (xml: string) => {
  const rows = [...xml.matchAll(/<row[^>]*line="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)];
  return rows
    .map((row) => {
      const body = row[2] ?? '';
      const name = tag(body, 'c2');
      const idnp = tag(body, 'c3');
      if (!name || !idnp) return null;
      return { name, idnp, cnass: tag(body, 'c4') };
    })
    .filter((row): row is { name: string; idnp: string; cnass: string | null } => row !== null);
};

const extractIpc21 = (xml: string) => ({
  // Later filings leave table1 empty; employee-register totals live in dinamicTable2.
  payrollBase: numberTag(xml, 'r61c4') ?? numberTag(xml, 'r11c4') ?? numberTag(xml, 'tot2c9'),
  incomeTax: numberTag(xml, 'r61c5') ?? numberTag(xml, 'r11c5') ?? numberTag(xml, 'tot2c11'),
  social: numberTag(xml, 'r61c6') ?? numberTag(xml, 'r11c6') ?? numberTag(xml, 'tot2c10'),
  employees: extractIpc21Employees(xml),
});

export const parseDeclarationXml = (xml: string): ParsedDeclaration => {
  const typeMatch = xml.match(/TypeName="([^"]+)"/i);
  const formType = (typeMatch?.[1] ?? 'unknown').toLowerCase();
  const datefisc = tag(xml, 'datefisc');
  const { period, year, month } = parsePeriod(datefisc);

  let extracted: Record<string, unknown> = {};
  if (formType === 'simm24' || formType === 'simm20') {
    extracted = extractSimm(xml);
  } else if (formType === 'tva12') {
    extracted = extractTva(xml);
  } else if (formType === 'rsf1-presc') {
    extracted = extractRsf1(xml);
  } else if (formType === 'ipc21') {
    extracted = extractIpc21(xml);
  } else if (formType === 'ials21') {
    extracted = {
      employeeName: tag(xml, 'namettl'),
      employeeIdnp: tag(xml, 'tinsalcds'),
      annualGross: numberTag(xml, 'sumvencur'),
      incomeTax: numberTag(xml, 'sumimpcur'),
    };
  }

  return {
    formType,
    fiscalCode: tag(xml, 'fiscal'),
    companyName: tag(xml, 'name'),
    period,
    year,
    month,
    extracted,
  };
};
