import bcrypt from "bcrypt";

import { usersCollection } from "../src/lib/db/collections";

function getArg(name: string) {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return raw?.split("=")[1];
}

async function main() {
  const email = (getArg("email") ?? process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (getArg("name") ?? process.env.SEED_ADMIN_NAME ?? "").trim();
  const password = getArg("password") ?? process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email || !name || !password) {
    throw new Error("Provide --email, --name, --password or SEED_ADMIN_* env vars");
  }

  const users = await usersCollection();

  const existing = await users.findOne({ email });
  if (existing) {
    console.log(`Admin user already exists for ${email}`);
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);

  await users.insertOne({
    email,
    name,
    password_hash,
    roles: ["ADMIN"],
    lineage_permissions: "ALL",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  } as never);

  console.log(`Admin user created for ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
