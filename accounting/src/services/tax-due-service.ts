import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { declarations, employees, taxProfiles } from '../db/schema.js';
import { getOnboardingStatus } from './onboarding-service.js';

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type DueItem = {
  name: string;
  kind: 'vat' | 'simm' | 'payroll' | 'onboarding' | 'info';
  amount: number | null;
  note: string;
  sourcePeriod: string | null;
};

export const whatDoIOwe = async (
  db: AppDb,
  input: { companyId: string; year: number; month: number },
) => {
  const [profile] = await db
    .select()
    .from(taxProfiles)
    .where(eq(taxProfiles.companyId, input.companyId));
  const rows = await db
    .select()
    .from(declarations)
    .where(eq(declarations.companyId, input.companyId));
  const staff = await db.select().from(employees).where(eq(employees.companyId, input.companyId));
  const onboarding = await getOnboardingStatus(db, input.companyId);

  const items: DueItem[] = [];

  if (profile?.vatPayer) {
    const vat = rows
      .filter(
        (row) =>
          row.formType === 'tva12' && row.year === input.year && row.month === input.month,
      )
      .at(-1);
    const deductible = vat ? asNumber((vat.extracted as { deductibleVat?: unknown }).deductibleVat) : 0;
    const output = vat ? asNumber((vat.extracted as { outputVat?: unknown }).outputVat) : 0;
    const payable = Number((output - deductible).toFixed(2));
    items.push({
      name: 'TVA12',
      kind: 'vat',
      amount: vat ? payable : null,
      note: vat
        ? payable < 0
          ? `TVA de recuperat ${Math.abs(payable).toFixed(2)} MDL (din declarația depusă)`
          : `TVA de plată ${payable.toFixed(2)} MDL`
        : 'Nu avem încă TVA12 pentru luna asta. După extras putem estima.',
      sourcePeriod: vat?.period ?? null,
    });
  }

  if (profile?.regime === 'simm24') {
    const simm = rows
      .filter((row) => (row.formType === 'simm24' || row.formType === 'simm20') && row.year === input.year)
      .at(-1);
    const lastYear = rows
      .filter((row) => (row.formType === 'simm24' || row.formType === 'simm20') && row.year === input.year - 1)
      .at(-1);
    const taxDue = simm
      ? asNumber((simm.extracted as { taxDue?: unknown }).taxDue)
      : lastYear
        ? asNumber((lastYear.extracted as { taxDue?: unknown }).taxDue)
        : null;
    items.push({
      name: 'SIMM 4%',
      kind: 'simm',
      amount: taxDue,
      note: simm
        ? `Impozit anual declarat ${taxDue} MDL (${simm.period})`
        : lastYear
          ? `Anul ${input.year} nu e închis. Ultimul SIMM depus: ${lastYear.period}, ${taxDue} MDL. Se depune anual (de obicei până în 25 martie).`
          : 'Nu am găsit SIMM depus. Regimul precompletat e 4%.',
      sourcePeriod: simm?.period ?? lastYear?.period ?? null,
    });
  }

  const ipc = rows
    .filter((row) => row.formType === 'ipc21' && row.year === input.year && row.month === input.month)
    .at(-1);
  if (staff.length > 0 || ipc) {
    const incomeTax = ipc ? asNumber((ipc.extracted as { incomeTax?: unknown }).incomeTax) : null;
    const social = ipc ? asNumber((ipc.extracted as { social?: unknown }).social) : null;
    items.push({
      name: 'IPC21 / salarii',
      kind: 'payroll',
      amount: incomeTax,
      note: ipc
        ? `Bază ${asNumber((ipc.extracted as { payrollBase?: unknown }).payrollBase)} MDL, impozit ${incomeTax} MDL, contribuții ${social} MDL`
        : `${staff.length} salariat(ți) în fișier. Lipsește IPC21 pentru ${input.year}-${String(input.month).padStart(2, '0')}.`,
      sourcePeriod: ipc?.period ?? null,
    });
  }

  if (onboarding.pendingCount > 0) {
    items.push({
      name: 'Onboarding',
      kind: 'onboarding',
      amount: null,
      note: `Mai sunt ${onboarding.pendingCount} întrebări. Poți răspunde sau sari. Următoarea: ${onboarding.nextQuestion?.prompt}`,
      sourcePeriod: null,
    });
  }

  return {
    companyId: input.companyId,
    year: input.year,
    month: input.month,
    regime: profile?.regime ?? 'unknown',
    vatPayer: profile?.vatPayer ?? false,
    itPark: profile?.itPark ?? false,
    items,
  };
};
