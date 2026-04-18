import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { updateUserSchema } from "@/lib/validations";
import { getSecuritySettings } from "@/lib/security-settings";
import bcrypt from "bcryptjs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["super_admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { passwordMinLength, bcryptRounds } = await getSecuritySettings();

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.email) updateData.email = parsed.data.email;
    if (parsed.data.role) updateData.role = parsed.data.role;
    if (parsed.data.password) {
      if (parsed.data.password.length < passwordMinLength) {
        return NextResponse.json(
          { error: `Password must be at least ${passwordMinLength} characters` },
          { status: 400 }
        );
      }
      updateData.hashedPassword = await bcrypt.hash(parsed.data.password, bcryptRounds);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update user", details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(["super_admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete user", details: String(err) },
      { status: 500 }
    );
  }
}
