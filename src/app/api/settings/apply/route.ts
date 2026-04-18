import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import {
  getSettings,
  rewriteServerConfig,
  restartInterface,
} from "@/lib/wireguard";

export async function POST() {
  const { error } = await requireRole(["super_admin", "admin"]);
  if (error) return error;

  try {
    const settings = await getSettings();
    rewriteServerConfig(settings);
    const result = restartInterface();

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to restart WireGuard", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to apply settings", details: String(err) },
      { status: 500 }
    );
  }
}
