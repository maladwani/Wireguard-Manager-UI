import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const hours = Math.min(parseInt(searchParams.get("hours") || "24", 10), 48);
    const since = new Date(Date.now() - hours * 3600_000);

    const logs = await db.bandwidthLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { rx: true, tx: true, createdAt: true },
    });

    const snapshots = logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      rx: Number(log.rx),
      tx: Number(log.tx),
    }));

    return NextResponse.json(snapshots);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch bandwidth data", details: String(err) },
      { status: 500 }
    );
  }
}
