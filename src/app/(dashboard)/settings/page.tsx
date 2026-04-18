"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Server,
  Mail,
  Send,
  Info,
  Globe,
  Loader2,
  Network,
  AlertTriangle,
  RotateCcw,
  Lock,
  RefreshCw,
  CheckCircle2,
  SkipForward,
  Wrench,
  KeyRound,
  Copy,
  CheckCheck,
  XCircle,
  Users,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

type EndpointMode = "auto" | "domain" | "ip";

interface ServerInfo {
  running: boolean;
  publicKey: string;
  listenPort: number;
}

interface AllSettings {
  endpointHost?: string;
  serverAddress?: string;
  listenPort?: string;
  postUp?: string;
  postDown?: string;
  defaultDns?: string;
  defaultAllowedIPs?: string;
  defaultMtu?: string;
  persistentKeepalive?: string;
  sessionTimeoutDays?: string;
  passwordMinLength?: string;
  bcryptRounds?: string;
  ssoEnabled?: string;
  ssoProviderName?: string;
  ssoIssuerUrl?: string;
  ssoClientId?: string;
  ssoClientSecret?: string;
  ssoScopes?: string;
  ssoAutoCreateUsers?: string;
  ssoDefaultRole?: string;
  ssoRoleAttr?: string;
  ssoAdminRole?: string;
  // Email / SMTP
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  // Telegram
  telegramBotToken?: string;
  telegramChatId?: string;
}

function detectEndpointMode(value: string): EndpointMode {
  if (!value || value === "auto") return "auto";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return "ip";
  return "domain";
}

const DEFAULT_POST_UP =
  "iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE";
const DEFAULT_POST_DOWN =
  "iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const [endpointMode, setEndpointMode] = useState<EndpointMode>("auto");
  const [endpointValue, setEndpointValue] = useState("");
  const [resolvedIP, setResolvedIP] = useState<string | null>(null);

  const [serverAddress, setServerAddress] = useState("10.0.0.1/24");
  const [listenPort, setListenPort] = useState("51820");
  const [postUp, setPostUp] = useState(DEFAULT_POST_UP);
  const [postDown, setPostDown] = useState(DEFAULT_POST_DOWN);

  const [defaultDns, setDefaultDns] = useState("1.1.1.1, 8.8.8.8");
  const [defaultAllowedIPs, setDefaultAllowedIPs] = useState("0.0.0.0/0, ::/0");
  const [defaultMtu, setDefaultMtu] = useState("");
  const [persistentKeepalive, setPersistentKeepalive] = useState("25");

  const [sessionTimeoutDays, setSessionTimeoutDays] = useState("30");
  const [passwordMinLength, setPasswordMinLength] = useState("6");
  const [bcryptRounds, setBcryptRounds] = useState("12");
  const [savingSecurity, setSavingSecurity] = useState(false);

  const [syncing, setSyncing] = useState(false);
  type SyncPeer = { publicKey: string; address: string; name: string; status: "imported" | "skipped" };
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number; peers: SyncPeer[] } | null>(null);

  // SSO / OIDC state
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoProviderName, setSsoProviderName] = useState("");
  const [ssoIssuerUrl, setSsoIssuerUrl] = useState("");
  const [ssoClientId, setSsoClientId] = useState("");
  const [ssoClientSecret, setSsoClientSecret] = useState("");
  const [ssoScopes, setSsoScopes] = useState("openid email profile");
  const [ssoAutoCreateUsers, setSsoAutoCreateUsers] = useState(true);
  const [ssoDefaultRole, setSsoDefaultRole] = useState("admin");
  const [ssoRoleAttr, setSsoRoleAttr] = useState("");
  const [ssoAdminRole, setSsoAdminRole] = useState("");
  const [savingSSO, setSavingSSO] = useState(false);
  const [ssoTesting, setSsoTesting] = useState(false);
  type TestResult = { success: boolean; issuer?: string; authorizationEndpoint?: string; error?: string };
  const [ssoTestResult, setSsoTestResult] = useState<TestResult | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Email / SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  type IntegrationTestResult = { success: boolean; username?: string; error?: string };
  const [emailTestResult, setEmailTestResult] = useState<IntegrationTestResult | null>(null);

  // Telegram state
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<IntegrationTestResult | null>(null);

  async function saveSSO() {
    setSavingSSO(true);
    try {
      const body: Record<string, string | boolean> = {
        ssoEnabled,
        ssoProviderName,
        ssoIssuerUrl,
        ssoClientId,
        ssoScopes,
        ssoAutoCreateUsers,
        ssoDefaultRole,
        ssoRoleAttr,
        ssoAdminRole,
      };
      // Only send secret if it was changed (not the masked placeholder)
      if (ssoClientSecret && ssoClientSecret !== "••••••••") {
        body.ssoClientSecret = ssoClientSecret;
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("settings.ssoSaved"));
    } catch {
      toast.error(t("settings.ssoSaveError"));
    } finally {
      setSavingSSO(false);
    }
  }

  async function testSSOConnection() {
    if (!ssoIssuerUrl) {
      toast.error("Please enter an Issuer URL first");
      return;
    }
    setSsoTesting(true);
    setSsoTestResult(null);
    try {
      const res = await fetch("/api/auth/sso/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerUrl: ssoIssuerUrl }),
      });
      const data = await res.json();
      setSsoTestResult(data);
    } catch {
      setSsoTestResult({ success: false, error: "Network error" });
    } finally {
      setSsoTesting(false);
    }
  }

  function copyCallbackUri() {
    const uri = `${window.location.origin}/api/auth/sso/callback`;
    navigator.clipboard.writeText(uri).then(() => {
      setCopiedCallback(true);
      setTimeout(() => setCopiedCallback(false), 2000);
    });
  }

  async function saveEmail() {
    setSavingEmail(true);
    try {
      const body: Record<string, string | boolean> = {
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpFrom,
      };
      if (smtpPassword && smtpPassword !== "••••••••") {
        body.smtpPassword = smtpPassword;
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("settings.saveEmailSuccess"));
    } catch {
      toast.error(t("settings.saveEmailError"));
    } finally {
      setSavingEmail(false);
    }
  }

  async function testEmail() {
    setTestingEmail(true);
    setEmailTestResult(null);
    await saveEmail();
    try {
      const res = await fetch("/api/settings/test-email", { method: "POST" });
      const data = await res.json();
      setEmailTestResult(data);
    } catch {
      setEmailTestResult({ success: false, error: "Network error" });
    } finally {
      setTestingEmail(false);
    }
  }

  async function saveTelegram() {
    setSavingTelegram(true);
    try {
      const body: Record<string, string> = { telegramChatId };
      if (telegramBotToken && telegramBotToken !== "••••••••") {
        body.telegramBotToken = telegramBotToken;
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("settings.saveTelegramSuccess"));
    } catch {
      toast.error(t("settings.saveTelegramError"));
    } finally {
      setSavingTelegram(false);
    }
  }

  async function testTelegram() {
    setTestingTelegram(true);
    setTelegramTestResult(null);
    await saveTelegram();
    try {
      const res = await fetch("/api/settings/test-telegram", { method: "POST" });
      const data = await res.json();
      setTelegramTestResult(data);
    } catch {
      setTelegramTestResult({ success: false, error: "Network error" });
    } finally {
      setTestingTelegram(false);
    }
  }

  async function syncFromConfig() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/clients/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      setSyncResult(data);
      if (data.imported === 0 && data.skipped === 0) {
        toast.info(t("settings.syncNoPeers"));
      } else {
        toast.success(
          t("settings.syncSuccess")
            .replace("{imported}", String(data.imported))
            .replace("{skipped}", String(data.skipped))
        );
      }
    } catch {
      toast.error(t("settings.syncError"));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetch("/api/wireguard/status")
      .then((res) => res.json())
      .then((data) => setServerInfo(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const s: AllSettings = data.settings || {};

        const host = s.endpointHost || "auto";
        const mode = detectEndpointMode(host);
        setEndpointMode(mode);
        if (mode !== "auto") setEndpointValue(host);
        if (data.resolvedEndpoint) setResolvedIP(data.resolvedEndpoint);

        if (s.serverAddress) setServerAddress(s.serverAddress);
        if (s.listenPort) setListenPort(s.listenPort);
        if (s.postUp !== undefined) setPostUp(s.postUp);
        if (s.postDown !== undefined) setPostDown(s.postDown);
        if (s.defaultDns) setDefaultDns(s.defaultDns);
        if (s.defaultAllowedIPs) setDefaultAllowedIPs(s.defaultAllowedIPs);
        if (s.defaultMtu !== undefined) setDefaultMtu(s.defaultMtu);
        if (s.persistentKeepalive) setPersistentKeepalive(s.persistentKeepalive);
        if (s.sessionTimeoutDays) setSessionTimeoutDays(s.sessionTimeoutDays);
        if (s.passwordMinLength) setPasswordMinLength(s.passwordMinLength);
        if (s.bcryptRounds) setBcryptRounds(s.bcryptRounds);
        // SSO settings
        setSsoEnabled(s.ssoEnabled === "true");
        if (s.ssoProviderName) setSsoProviderName(s.ssoProviderName);
        if (s.ssoIssuerUrl) setSsoIssuerUrl(s.ssoIssuerUrl);
        if (s.ssoClientId) setSsoClientId(s.ssoClientId);
        if (s.ssoClientSecret) setSsoClientSecret(s.ssoClientSecret); // masked value
        if (s.ssoScopes) setSsoScopes(s.ssoScopes);
        setSsoAutoCreateUsers(s.ssoAutoCreateUsers !== "false");
        if (s.ssoDefaultRole) setSsoDefaultRole(s.ssoDefaultRole);
        if (s.ssoRoleAttr) setSsoRoleAttr(s.ssoRoleAttr);
        if (s.ssoAdminRole) setSsoAdminRole(s.ssoAdminRole);
        // Email settings
        if (s.smtpHost) setSmtpHost(s.smtpHost);
        if (s.smtpPort) setSmtpPort(s.smtpPort);
        setSmtpSecure(s.smtpSecure === "true");
        if (s.smtpUser) setSmtpUser(s.smtpUser);
        if (s.smtpPassword) setSmtpPassword(s.smtpPassword); // masked
        if (s.smtpFrom) setSmtpFrom(s.smtpFrom);
        // Telegram settings
        if (s.telegramBotToken) setTelegramBotToken(s.telegramBotToken); // masked
        if (s.telegramChatId) setTelegramChatId(s.telegramChatId);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      const endpointHost = endpointMode === "auto" ? "auto" : endpointValue.trim();
      if (endpointMode !== "auto" && !endpointHost) {
        toast.error(t("settings.invalidEndpoint"));
        setSaving(false);
        return;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointHost,
          serverAddress,
          listenPort,
          postUp,
          postDown,
          defaultDns,
          defaultAllowedIPs,
          defaultMtu,
          persistentKeepalive,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("settings.settingsSaved"));

      if (endpointMode === "auto") {
        const settingsRes = await fetch("/api/settings");
        const data = await settingsRes.json();
        if (data.resolvedEndpoint) setResolvedIP(data.resolvedEndpoint);
      }
    } catch {
      toast.error(t("settings.settingsSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function saveSecurity() {
    setSavingSecurity(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionTimeoutDays,
          passwordMinLength,
          bcryptRounds,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t("settings.securitySaved"));
    } catch {
      toast.error(t("settings.securitySaveError"));
    } finally {
      setSavingSecurity(false);
    }
  }

  async function applyServerChanges() {
    setApplying(true);
    try {
      await saveAll();
      const res = await fetch("/api/settings/apply", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to apply");
      }
      toast.success(t("settings.applySuccess"));

      const statusRes = await fetch("/api/wireguard/status");
      if (statusRes.ok) setServerInfo(await statusRes.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.applyError"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Server className="mr-2 h-4 w-4" />
            {t("settings.general")}
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            {t("settings.security")}
          </TabsTrigger>
          <TabsTrigger value="sso">
            <KeyRound className="mr-2 h-4 w-4" />
            {t("settings.sso")}
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            {t("settings.tools")}
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="mr-2 h-4 w-4" />
            {t("settings.about")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("settings.wgStatus")}</CardTitle>
              <CardDescription>{t("settings.wgStatusDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-60" />
                </div>
              ) : (
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("settings.statusLabel")}</span>
                    <Badge variant={serverInfo?.running ? "default" : "destructive"}>
                      {serverInfo?.running ? t("common.online") : t("common.offline")}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("settings.activeListenPort")}</span>
                    <span className="font-mono">{serverInfo?.listenPort || "-"}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("settings.publicKey")}</span>
                    <span className="font-mono text-xs max-w-[200px] truncate">
                      {serverInfo?.publicKey || t("common.na")}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4" />
                {t("settings.serverInterface")}
              </CardTitle>
              <CardDescription>{t("settings.serverInterfaceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="server-address">{t("settings.serverAddress")}</Label>
                      <Input
                        id="server-address"
                        value={serverAddress}
                        onChange={(e) => setServerAddress(e.target.value)}
                        placeholder="10.0.0.1/24"
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.serverAddressHelp")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="listen-port">{t("settings.listenPort")}</Label>
                      <Input
                        id="listen-port"
                        value={listenPort}
                        onChange={(e) => setListenPort(e.target.value)}
                        placeholder="51820"
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.listenPortHelp")}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-up">{t("settings.postUp")}</Label>
                    <Textarea
                      id="post-up"
                      value={postUp}
                      onChange={(e) => setPostUp(e.target.value)}
                      placeholder="iptables rules..."
                      rows={2}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-down">{t("settings.postDown")}</Label>
                    <Textarea
                      id="post-down"
                      value={postDown}
                      onChange={(e) => setPostDown(e.target.value)}
                      placeholder="iptables rules..."
                      rows={2}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={applyServerChanges}
                      disabled={applying || saving}
                      variant="destructive"
                      size="sm"
                    >
                      {applying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      {t("settings.saveAndApply")}
                    </Button>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      {t("settings.restartWarning")}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("settings.endpointHost")}
              </CardTitle>
              <CardDescription>{t("settings.endpointHostDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>{t("settings.mode")}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { value: "auto", label: t("settings.autoDetect") },
                          { value: "domain", label: t("settings.domain") },
                          { value: "ip", label: t("settings.staticIP") },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setEndpointMode(opt.value);
                            if (opt.value === "auto") setEndpointValue("");
                          }}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            endpointMode === opt.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {endpointMode === "auto" ? (
                    <div className="rounded-md border border-dashed p-3 text-sm">
                      <p className="text-muted-foreground">{t("settings.autoDetectDesc")}</p>
                      {resolvedIP && (
                        <p className="mt-2 font-mono text-xs">
                          {t("settings.currentIP")}{" "}
                          <span className="font-semibold text-foreground">{resolvedIP}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>
                        {endpointMode === "domain" ? t("settings.domainName") : t("settings.ipAddressLabel")}
                      </Label>
                      <Input
                        placeholder={
                          endpointMode === "domain"
                            ? "vpn.example.com"
                            : "203.0.113.1"
                        }
                        value={endpointValue}
                        onChange={(e) => setEndpointValue(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" />
                {t("settings.clientDefaults")}
              </CardTitle>
              <CardDescription>{t("settings.clientDefaultsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="default-dns">{t("settings.dnsServers")}</Label>
                      <Input
                        id="default-dns"
                        value={defaultDns}
                        onChange={(e) => setDefaultDns(e.target.value)}
                        placeholder="1.1.1.1, 8.8.8.8"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default-allowed-ips">{t("settings.allowedIPs")}</Label>
                      <Input
                        id="default-allowed-ips"
                        value={defaultAllowedIPs}
                        onChange={(e) => setDefaultAllowedIPs(e.target.value)}
                        placeholder="0.0.0.0/0, ::/0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default-mtu">{t("settings.mtuOptional")}</Label>
                      <Input
                        id="default-mtu"
                        value={defaultMtu}
                        onChange={(e) => setDefaultMtu(e.target.value)}
                        placeholder="e.g. 1420"
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.mtuHelp")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="persistent-keepalive">{t("settings.persistentKeepalive")}</Label>
                      <Input
                        id="persistent-keepalive"
                        value={persistentKeepalive}
                        onChange={(e) => setPersistentKeepalive(e.target.value)}
                        placeholder="25"
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.keepaliveHelp")}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {!settingsLoading && (
            <div className="flex justify-end">
              <Button onClick={saveAll} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("settings.saveAllSettings")}
              </Button>
            </div>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t("settings.emailIntegration")}
              </CardTitle>
              <CardDescription>{t("settings.emailIntegrationDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("settings.smtpHost")}</Label>
                      <Input
                        placeholder="smtp.example.com"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.smtpPort")}</Label>
                      <Input
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.username")}</Label>
                      <Input
                        placeholder="user@example.com"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        autoComplete="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.passwordLabel")}</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.smtpFrom")}</Label>
                      <Input
                        placeholder={t("settings.smtpFromPlaceholder")}
                        value={smtpFrom}
                        onChange={(e) => setSmtpFrom(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.smtpFromHelp")}</p>
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Switch
                        id="smtp-secure"
                        checked={smtpSecure}
                        onCheckedChange={(v) => {
                          setSmtpSecure(v);
                          if (v) setSmtpPort("465");
                          else setSmtpPort("587");
                        }}
                      />
                      <div>
                        <Label htmlFor="smtp-secure">{t("settings.smtpSecureLabel")}</Label>
                        <p className="text-xs text-muted-foreground">{t("settings.smtpSecureHelp")}</p>
                      </div>
                    </div>
                  </div>

                  {emailTestResult && (
                    <div
                      className={`rounded-md border p-3 text-sm ${
                        emailTestResult.success
                          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                          : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                      }`}
                    >
                      {emailTestResult.success ? (
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("settings.testSuccess")}
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
                          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{t("settings.testFailed")}</p>
                            <p className="text-xs opacity-80 mt-0.5">{emailTestResult.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testEmail}
                      disabled={testingEmail || savingEmail || !smtpHost}
                    >
                      {testingEmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      {testingEmail ? t("settings.testing") : t("settings.testConnection")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEmail}
                      disabled={savingEmail || testingEmail}
                    >
                      {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("settings.saveEmailSettings")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t("settings.telegramIntegration")}
              </CardTitle>
              <CardDescription>{t("settings.telegramIntegrationDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("settings.botToken")}</Label>
                      <Input
                        type="password"
                        placeholder="123456:ABC-DEF..."
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.chatId")}</Label>
                      <Input
                        placeholder="123456789"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{t("settings.telegramChatIdHelp")}</p>
                    </div>
                  </div>

                  {telegramTestResult && (
                    <div
                      className={`rounded-md border p-3 text-sm ${
                        telegramTestResult.success
                          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                          : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                      }`}
                    >
                      {telegramTestResult.success ? (
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("settings.telegramTestSuccess").replace("{username}", telegramTestResult.username || "")}
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
                          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{t("settings.telegramTestFailed")}</p>
                            <p className="text-xs opacity-80 mt-0.5">{telegramTestResult.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testTelegram}
                      disabled={testingTelegram || savingTelegram || !telegramBotToken || telegramBotToken === "••••••••"}
                    >
                      {testingTelegram ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      {testingTelegram ? t("settings.testing") : t("settings.testConnection")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveTelegram}
                      disabled={savingTelegram || testingTelegram}
                    >
                      {savingTelegram && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("settings.saveTelegramSettings")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t("settings.sessionAuth")}
              </CardTitle>
              <CardDescription>{t("settings.sessionAuthDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">{t("settings.sessionTimeout")}</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      min="1"
                      max="365"
                      value={sessionTimeoutDays}
                      onChange={(e) => setSessionTimeoutDays(e.target.value)}
                      placeholder="30"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.sessionTimeoutHelp")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t("settings.passwordPolicy")}
              </CardTitle>
              <CardDescription>{t("settings.passwordPolicyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password-min">{t("settings.minPasswordLength")}</Label>
                    <Input
                      id="password-min"
                      type="number"
                      min="4"
                      max="128"
                      value={passwordMinLength}
                      onChange={(e) => setPasswordMinLength(e.target.value)}
                      placeholder="6"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.minPasswordHelp")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bcrypt-rounds">{t("settings.bcryptRounds")}</Label>
                    <Input
                      id="bcrypt-rounds"
                      type="number"
                      min="4"
                      max="16"
                      value={bcryptRounds}
                      onChange={(e) => setBcryptRounds(e.target.value)}
                      placeholder="12"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.bcryptRoundsHelp")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("settings.encryption")}</CardTitle>
              <CardDescription>{t("settings.encryptionDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t("settings.clientPrivateKeys")}</p>
                    <p className="text-muted-foreground text-xs">{t("settings.clientPrivateKeysDesc")}</p>
                  </div>
                  <Badge>AES-256-GCM</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t("settings.passwordHashing")}</p>
                    <p className="text-muted-foreground text-xs">{t("settings.passwordHashingDesc")}</p>
                  </div>
                  <Badge variant="secondary">{t("settings.bcryptRoundsLabel", { rounds: bcryptRounds })}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {!settingsLoading && (
            <div className="flex justify-end">
              <Button onClick={saveSecurity} disabled={savingSecurity}>
                {savingSecurity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("settings.saveSecuritySettings")}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sso" className="space-y-4">
          {/* Enable / disable toggle */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {t("settings.ssoTitle")}
              </CardTitle>
              <CardDescription>{t("settings.ssoDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t("settings.ssoEnabled")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ssoEnabledDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={ssoEnabled}
                    onCheckedChange={setSsoEnabled}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Identity provider credentials */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t("settings.ssoCredentialSection")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>{t("settings.ssoProviderName")}</Label>
                    <Input
                      placeholder={t("settings.ssoProviderNamePlaceholder")}
                      value={ssoProviderName}
                      onChange={(e) => setSsoProviderName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ssoProviderNameHelp")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.ssoIssuerUrl")}</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("settings.ssoIssuerUrlPlaceholder")}
                        value={ssoIssuerUrl}
                        onChange={(e) => {
                          setSsoIssuerUrl(e.target.value);
                          setSsoTestResult(null);
                        }}
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={testSSOConnection}
                        disabled={ssoTesting || !ssoIssuerUrl}
                        className="shrink-0"
                      >
                        {ssoTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t("settings.ssoTestConnection")
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ssoIssuerUrlHelp")}
                    </p>

                    {/* Test result */}
                    {ssoTestResult && (
                      <div
                        className={`rounded-md border p-3 text-sm ${
                          ssoTestResult.success
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                        }`}
                      >
                        {ssoTestResult.success ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                              <CheckCircle2 className="h-4 w-4" />
                              {t("settings.ssoTestSuccess")}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {ssoTestResult.issuer}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium">{t("settings.ssoTestFailed")}</p>
                              <p className="text-xs opacity-80 mt-0.5">{ssoTestResult.error}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("settings.ssoClientId")}</Label>
                      <Input
                        placeholder={t("settings.ssoClientIdPlaceholder")}
                        value={ssoClientId}
                        onChange={(e) => setSsoClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.ssoClientSecret")}</Label>
                      <Input
                        type="password"
                        placeholder={t("settings.ssoClientSecretPlaceholder")}
                        value={ssoClientSecret}
                        onChange={(e) => setSsoClientSecret(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.ssoScopes")}</Label>
                    <Input
                      placeholder={t("settings.ssoScopesPlaceholder")}
                      value={ssoScopes}
                      onChange={(e) => setSsoScopes(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ssoScopesHelp")}
                    </p>
                  </div>

                  {/* Callback URI */}
                  <div className="space-y-2">
                    <Label>{t("settings.ssoCallbackUri")}</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={
                          typeof window !== "undefined"
                            ? `${window.location.origin}/api/auth/sso/callback`
                            : "/api/auth/sso/callback"
                        }
                        className="font-mono text-sm bg-muted/50 text-muted-foreground"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyCallbackUri}
                        title="Copy"
                      >
                        {copiedCallback ? (
                          <CheckCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ssoCallbackUriHelp")}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* User provisioning */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("settings.ssoRoleMappingSection")}
              </CardTitle>
              <CardDescription>{t("settings.ssoRoleMappingSectionDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("settings.ssoAutoCreateUsers")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.ssoAutoCreateUsersDesc")}
                      </p>
                    </div>
                    <Switch
                      checked={ssoAutoCreateUsers}
                      onCheckedChange={setSsoAutoCreateUsers}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("settings.ssoDefaultRole")}</Label>
                      <select
                        value={ssoDefaultRole}
                        onChange={(e) => setSsoDefaultRole(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="admin">{t("roles.admin")}</option>
                        <option value="auditor">{t("roles.auditor")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settings.ssoRoleAttr")}</Label>
                      <Input
                        placeholder={t("settings.ssoRoleAttrPlaceholder")}
                        value={ssoRoleAttr}
                        onChange={(e) => setSsoRoleAttr(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("settings.ssoRoleAttrHelp")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("settings.ssoAdminRole")}</Label>
                    <Input
                      placeholder={t("settings.ssoAdminRolePlaceholder")}
                      value={ssoAdminRole}
                      onChange={(e) => setSsoAdminRole(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ssoAdminRoleHelp")}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Local fallback note */}
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {t("settings.ssoLocalFallbackNote")}{" "}
              <a
                href="/login/local"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 font-mono"
              >
                /login/local
              </a>
            </span>
          </div>

          {!settingsLoading && (
            <div className="flex justify-end">
              <Button onClick={saveSSO} disabled={savingSSO}>
                {savingSSO ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                {savingSSO ? t("settings.ssoSaving") : t("settings.ssoSaveSettings")}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {t("settings.syncTitle")}
              </CardTitle>
              <CardDescription>{t("settings.syncDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t("settings.syncNoPrivateKey")}</span>
              </div>

              <Button onClick={syncFromConfig} disabled={syncing} variant="outline">
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {syncing ? t("settings.syncing") : t("settings.syncButton")}
              </Button>

              {syncResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("settings.syncImported")}: <strong>{syncResult.imported}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <SkipForward className="h-4 w-4" />
                      {t("settings.syncSkipped")}: <strong>{syncResult.skipped}</strong>
                    </span>
                  </div>

                  {syncResult.peers.length > 0 && (
                    <div className="rounded-md border text-sm overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                        <span>Public Key</span>
                        <span>Address</span>
                        <span>Status</span>
                      </div>
                      {syncResult.peers.map((peer) => (
                        <div
                          key={peer.publicKey}
                          className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 border-t items-center"
                        >
                          <span className="font-mono text-xs truncate text-muted-foreground">
                            {peer.publicKey.slice(0, 24)}…
                          </span>
                          <span className="font-mono text-xs">{peer.address}</span>
                          <span>
                            {peer.status === "imported" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <SkipForward className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("settings.aboutTitle")}</CardTitle>
              <CardDescription>{t("settings.aboutDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("settings.version")}</span>
                  <span>1.0.0</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("settings.framework")}</span>
                  <span>Next.js 16</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("settings.uiLibrary")}</span>
                  <span>Shadcn UI</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("settings.database")}</span>
                  <span>SQLite (Prisma)</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("settings.license")}</span>
                  <span>MIT</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
