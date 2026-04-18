"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { useTranslation } from "@/lib/i18n";
import { Loader2, ShieldCheck, User } from "lucide-react";
import Link from "next/link";

interface SSOStatus {
  enabled: boolean;
  providerName: string | null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [ssoStatus, setSSOStatus] = useState<SSOStatus | null>(null);
  const [ssoError, setSSOError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntilMs, setLockedUntilMs] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch SSO status on mount
  useEffect(() => {
    fetch("/api/auth/sso/status")
      .then((r) => r.json())
      .then((data: SSOStatus) => setSSOStatus(data))
      .catch(() => setSSOStatus({ enabled: false, providerName: null }));

    // Show any SSO error passed back from the IdP callback
    const ssoErr = searchParams.get("sso_error");
    if (ssoErr) setSSOError(ssoErr);
  }, [searchParams]);

  // Countdown timer tick
  useEffect(() => {
    if (lockedUntilMs === null) return;
    const tick = () => {
      const remaining = Math.max(0, lockedUntilMs - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLockedUntilMs(null);
        setError("");
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lockedUntilMs]);

  const isLocked = lockedUntilMs !== null && countdown > 0;

  const checkLockout = async (emailVal: string) => {
    try {
      const res = await fetch("/api/auth/lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVal }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.blocked) {
        setLockedUntilMs(Date.now() + data.retryAfterMs);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isLocked) return;
    setLoading(true);

    const locked = await checkLockout(email);
    if (locked) {
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        const nowLocked = await checkLockout(email);
        if (!nowLocked) setError(t("login.invalidCredentials"));
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      console.error("[login] signIn error:", err);
      const nowLocked = await checkLockout(email);
      if (!nowLocked) setError(t("login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const lockoutMinutes = Math.ceil(countdown / 60);
  const ssoEnabled = ssoStatus?.enabled === true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <Logo size={64} />
          </div>
          <CardTitle className="text-2xl font-bold">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* SSO error returned from IdP */}
          {ssoError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{t("login.ssoError")}</p>
              <p className="text-xs mt-1 opacity-80">{ssoError}</p>
            </div>
          )}

          {/* SSO primary action */}
          {ssoEnabled && (
            <>
              <a href="/api/auth/sso/start">
                <Button className="w-full gap-2" size="lg">
                  <ShieldCheck className="h-4 w-4" />
                  {t("login.signInWithSSO").replace(
                    "{provider}",
                    ssoStatus?.providerName || "SSO"
                  )}
                </Button>
              </a>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("login.orDivider")}
                  </span>
                </div>
              </div>

              {/* Local account fallback - subtle link */}
              <div className="text-center">
                <Link
                  href="/login/local"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  {t("login.useLocalAccount")}
                </Link>
              </div>
            </>
          )}

          {/* Credentials form - shown when SSO is disabled */}
          {!ssoEnabled && ssoStatus !== null && (
            <>
              {isLocked && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                  <p className="font-medium">{t("login.accountLocked")}</p>
                  <p>
                    {t("login.tooManyAttempts").replace(
                      "{minutes}",
                      String(lockoutMinutes)
                    )}
                  </p>
                  <p className="text-xs opacity-75">
                    {Math.floor(countdown / 60)}:
                    {String(countdown % 60).padStart(2, "0")}
                  </p>
                </div>
              )}
              {error && !isLocked && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("login.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("login.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLocked}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || isLocked}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.signingIn")}
                    </>
                  ) : (
                    t("common.signIn")
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Loading skeleton while fetching SSO status */}
          {ssoStatus === null && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
