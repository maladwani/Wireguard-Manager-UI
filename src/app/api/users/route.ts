import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createUserSchema } from "@/lib/validations";
import { getSecuritySettings } from "@/lib/security-settings";
import bcrypt from "bcryptjs";

export async function GET() {
  const { error } = await requireRole(["super_admin"]);
  if (error) return error;

  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch users", details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { error } = await requireRole(["super_admin"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { passwordMinLength, bcryptRounds } = await getSecuritySettings();

    if (parsed.data.password.length < passwordMinLength) {
      return NextResponse.json(
        { error: `Password must be at least ${passwordMinLength} characters` },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, bcryptRounds);

    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        hashedPassword,
        role: parsed.data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create user", details: String(err) },
      { status: 500 }
    );
  }
}
