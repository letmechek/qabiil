import { Collection } from "mongodb";

import { getDb } from "@/lib/db/mongo";
import type { CounterDoc, EditDoc, PersonDoc, UserDoc } from "@/lib/types";

export async function usersCollection(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}

export async function editsCollection(): Promise<Collection<EditDoc>> {
  return (await getDb()).collection<EditDoc>("edits");
}

export async function peopleCollection(): Promise<Collection<PersonDoc>> {
  return (await getDb()).collection<PersonDoc>("people");
}

export async function countersCollection(): Promise<Collection<CounterDoc>> {
  return (await getDb()).collection<CounterDoc>("counters");
}
