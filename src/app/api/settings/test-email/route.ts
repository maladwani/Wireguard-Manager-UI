import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { testSmtp } from "@/lib/email";

export async function POST() {
  const { error } = await requireRole(["super_admin"]);
  if (error) return error;

  const result = await testSmtp();
  return NextResponse.json(result);
}
