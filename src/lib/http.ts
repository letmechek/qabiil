import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>) {
  const json = await req.json();
  return schema.parse(json);
}
