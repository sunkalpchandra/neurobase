import "dotenv/config";
import { closeDb, getDb } from "../src/db/client";
import { seedReferenceData } from "../src/db/reference/seed";

/** Loads the controlled vocabulary (technology categories, conditions and their synonyms). */
async function main(): Promise<void> {
  const summary = await seedReferenceData(getDb());
  console.log(
    `Reference data: ${summary.categories} technology categories, ${summary.conditions} conditions, ${summary.aliases} new aliases.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
