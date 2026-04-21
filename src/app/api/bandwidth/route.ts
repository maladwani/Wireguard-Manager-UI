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

    const baseline = await db.bandwidthLog.findFirst({
      where: { createdAt: { lt: since } },
      orderBy: { createdAt: "desc" },
      select: { rx: true, tx: true, createdAt: true },
    });

    const logs = await db.bandwidthLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { rx: true, tx: true, createdAt: true },
    });

    const all = baseline ? [baseline, ...logs] : logs;

    const snapshots = all
      .map((log, i) => {
        if (i === 0) return null;
        const prev = all[i - 1];
        return {
          timestamp: log.createdAt.toISOString(),
          rx: Math.max(0, Number(log.rx) - Number(prev.rx)),
          tx: Math.max(0, Number(log.tx) - Number(prev.tx)),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return NextResponse.json(snapshots);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch bandwidth data", details: String(err) },
      { status: 500 }
    );
  }
}
