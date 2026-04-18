import { db } from "@/lib/db";

export interface SecuritySettings {
  sessionTimeoutDays: number;
  passwordMinLength: number;
  bcryptRounds: number;
}

const DEFAULTS: SecuritySettings = {
  sessionTimeoutDays: 30,
  passwordMinLength: 6,
  bcryptRounds: 12,
};

export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const rows = await db.setting.findMany({
      where: {
        key: { in: ["sessionTimeoutDays", "passwordMinLength", "bcryptRounds"] },
      },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      sessionTimeoutDays: parseInt(map.sessionTimeoutDays, 10) || DEFAULTS.sessionTimeoutDays,
      passwordMinLength: parseInt(map.passwordMinLength, 10) || DEFAULTS.passwordMinLength,
      bcryptRounds: parseInt(map.bcryptRounds, 10) || DEFAULTS.bcryptRounds,
    };
  } catch {
    return DEFAULTS;
  }
}
