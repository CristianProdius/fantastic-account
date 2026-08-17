import { createDb } from '../src/db/client.js';
import { seedCompanies } from '../src/db/seed.js';
import { importDeclarations } from '../src/services/declaration-import-service.js';
import { reconstructFromDeclarations } from '../src/services/snapshot-journal-service.js';

const main = async () => {
  const db = createDb();
  for (const company of seedCompanies) {
    const imported = await importDeclarations(db, company.slug);
    const reconstructed = await reconstructFromDeclarations(db, company.slug);
    console.log(JSON.stringify({ imported, reconstructed }, null, 2));
  }
  await db.$client.end();
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
