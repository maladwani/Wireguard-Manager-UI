"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import type { BandwidthSnapshot } from "@/types";

interface BandwidthChartProps {
  data: BandwidthSnapshot[];
  selectedRangeHours: number;
  onRangeChange: (hours: number) => void;
}

function CustomTooltip({ active, payload, label, downloadLabel, uploadLabel }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  downloadLabel?: string;
  uploadLabel?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.dataKey === "tx" ? downloadLabel : uploadLabel}: {formatBytes(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function BandwidthChart({
  data,
  selectedRangeHours,
  onRangeChange,
}: BandwidthChartProps) {
  const { t } = useTranslation();
  const rangeLabels: Record<number, string> = {
    1: t("dashboard.last1Hour"),
    3: t("dashboard.last3Hours"),
    6: t("dashboard.last6Hours"),
    12: t("dashboard.last12Hours"),
    24: t("dashboard.last24Hours"),
    48: t("dashboard.last48Hours"),
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">
          {t("dashboard.bandwidthUsage")} ({rangeLabels[selectedRangeHours] ?? rangeLabels[24]})
        </CardTitle>
        <Select
          value={String(selectedRangeHours)}
          onValueChange={(value) => onRangeChange(Number(value))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t("dashboard.timeRange")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t("dashboard.last1Hour")}</SelectItem>
            <SelectItem value="3">{t("dashboard.last3Hours")}</SelectItem>
            <SelectItem value="6">{t("dashboard.last6Hours")}</SelectItem>
            <SelectItem value="12">{t("dashboard.last12Hours")}</SelectItem>
            <SelectItem value="24">{t("dashboard.last24Hours")}</SelectItem>
            <SelectItem value="48">{t("dashboard.last48Hours")}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {t("dashboard.noBandwidthData")}
          </p>
        ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.18 260)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.55 0.18 260)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.15 160)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.15 160)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                className="text-xs"
                tick={{ fill: "currentColor" }}
              />
              <YAxis
                className="text-xs"
                tickFormatter={(v) => formatBytes(v)}
                tick={{ fill: "currentColor" }}
              />
              <Tooltip content={<CustomTooltip downloadLabel={t("dashboard.download")} uploadLabel={t("dashboard.upload")} />} />
              <Area
                type="monotone"
                dataKey="tx"
                stroke="oklch(0.55 0.18 260)"
                fill="url(#rxGradient)"
                strokeWidth={2}
                name={t("dashboard.download")}
              />
              <Area
                type="monotone"
                dataKey="rx"
                stroke="oklch(0.65 0.15 160)"
                fill="url(#txGradient)"
                strokeWidth={2}
                name={t("dashboard.upload")}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
