import { getDb } from "../src/lib/db/mongo";

async function main() {
  const db = await getDb();

  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "users_email_unique" },
    { key: { roles: 1 }, name: "users_roles_idx" },
  ]);

  await db.collection("edits").createIndexes([
    { key: { status: 1, created_at: -1 }, name: "edits_status_created_idx" },
    { key: { target_source_person_id: 1 }, name: "edits_target_idx" },
  ]);

  await db.collection("people").createIndex(
    { source: 1, source_person_id: 1 },
    { unique: true, name: "people_source_source_person_id_unique" },
  );

  await db.collection("people").createIndex(
    { name: "text", names: "text", notes_text: "text" },
    { name: "people_text_search_idx" },
  );

  console.log("Indexes created/verified.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
