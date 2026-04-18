"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import type { WgPeer } from "@/types";

interface RecentPeersProps {
  peers: WgPeer[];
}

export function RecentPeers({ peers }: RecentPeersProps) {
  const { t } = useTranslation();

  const recentPeers = peers
    .sort((a, b) => b.latestHandshake - a.latestHandshake)
    .slice(0, 5);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.recentPeers")}</CardTitle>
      </CardHeader>
      <CardContent>
        {recentPeers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("dashboard.noActivePeers")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.client")}</TableHead>
                  <TableHead>{t("dashboard.address")}</TableHead>
                  <TableHead>{t("dashboard.endpoint")}</TableHead>
                  <TableHead>{t("dashboard.lastHandshake")}</TableHead>
                  <TableHead>{t("dashboard.transfer")}</TableHead>
                  <TableHead>{t("dashboard.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPeers.map((peer) => {
                  const isActive =
                    peer.latestHandshake > 0 &&
                    Date.now() / 1000 - peer.latestHandshake < 210;
                  return (
                    <TableRow key={peer.publicKey}>
                      <TableCell className="font-medium">
                        {peer.clientName || (
                          <span className="font-mono text-xs text-muted-foreground">
                            {peer.publicKey.slice(0, 16)}...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {peer.clientAddress || peer.allowedIPs || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {peer.endpoint || t("common.na")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatRelativeTime(peer.latestHandshake)}
                      </TableCell>
                      <TableCell className="text-sm">
                        ↓{formatBytes(peer.transferRx)} ↑{formatBytes(peer.transferTx)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
