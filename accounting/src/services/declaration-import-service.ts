import { readdir, readFile, access } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { declarations, employees } from '../db/schema.js';
import { parseDeclarationXml } from '../importers/declarations/parse-xml.js';
import { declarationsDir } from '../paths.js';
import { getCompany } from './company-service.js';

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const listXmlFiles = async (directory: string) => {
  if (!(await exists(directory))) return [];
  const names = await readdir(directory);
  return names.filter((name) => extname(name).toLowerCase() === '.xml').sort();
};

export const importDeclarations = async (db: AppDb, companySlug: string) => {
  const { company } = await getCompany(db, companySlug);
  const root = declarationsDir(company.slug);
  const xmlDir = join(root, 'xml');
  const pdfDir = join(root, 'pdf');
  const files = await listXmlFiles(xmlDir);

  let upserted = 0;
  const employeesSeen = new Map<string, string>();

  for (const fileName of files) {
    const sfsId = fileName.replace(/\.xml$/i, '');
    const xmlPath = join(xmlDir, fileName);
    const pdfPath = join(pdfDir, `${sfsId}.pdf`);
    const xml = await readFile(xmlPath, 'utf8');
    const parsed = parseDeclarationXml(xml);

    await db
      .insert(declarations)
      .values({
        companyId: company.slug,
        sfsId,
        formType: parsed.formType,
        period: parsed.period,
        year: parsed.year,
        month: parsed.month,
        fiscalCode: parsed.fiscalCode,
        companyName: parsed.companyName,
        extracted: parsed.extracted,
        xmlPath,
        pdfPath: (await exists(pdfPath)) ? pdfPath : null,
      })
      .onConflictDoUpdate({
        target: [declarations.companyId, declarations.sfsId],
        set: {
          formType: parsed.formType,
          period: parsed.period,
          year: parsed.year,
          month: parsed.month,
          fiscalCode: parsed.fiscalCode,
          companyName: parsed.companyName,
          extracted: parsed.extracted,
          xmlPath,
          pdfPath: (await exists(pdfPath)) ? pdfPath : null,
        },
      });

    upserted += 1;

    const extractedEmployees = parsed.extracted.employees;
    if (Array.isArray(extractedEmployees)) {
      for (const person of extractedEmployees as { name?: string; idnp?: string }[]) {
        if (person.idnp && person.name) {
          employeesSeen.set(person.idnp, person.name);
        }
      }
    }

    if (parsed.formType === 'ials21') {
      const idnp = parsed.extracted.employeeIdnp;
      const name = parsed.extracted.employeeName;
      if (typeof idnp === 'string' && typeof name === 'string') {
        employeesSeen.set(idnp, name);
      }
    }
  }

  for (const [idnp, fullName] of employeesSeen) {
    await db
      .insert(employees)
      .values({
        companyId: company.slug,
        fullName,
        idnp,
        active: true,
        source: 'declaration',
      })
      .onConflictDoUpdate({
        target: [employees.companyId, employees.idnp],
        set: { fullName, active: true },
      });
  }

  const rows = await db.select().from(declarations).where(eq(declarations.companyId, company.slug));

  return {
    companyId: company.slug,
    files: files.length,
    upserted,
    stored: rows.length,
    employees: employeesSeen.size,
  };
};

export const listDeclarations = async (
  db: AppDb,
  filters: { companyId: string; formType?: string; year?: number },
) => {
  const rows = await db
    .select()
    .from(declarations)
    .where(eq(declarations.companyId, filters.companyId));

  return rows.filter((row) => {
    if (filters.formType && row.formType !== filters.formType.toLowerCase()) return false;
    if (filters.year && row.year !== filters.year) return false;
    return true;
  });
};
