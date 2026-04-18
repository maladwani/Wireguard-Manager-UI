import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { testBot } from "@/lib/telegram";

export async function POST() {
  const { error } = await requireRole(["super_admin"]);
  if (error) return error;

  const result = await testBot();
  return NextResponse.json(result);
}
