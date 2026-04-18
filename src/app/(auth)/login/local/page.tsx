"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function LocalLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntilMs, setLockedUntilMs] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      console.error("[local login] signIn error:", err);
      const nowLocked = await checkLockout(email);
      if (!nowLocked) setError(t("login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const lockoutMinutes = Math.ceil(countdown / 60);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <Logo size={64} />
          </div>
          <CardTitle className="text-2xl font-bold">{t("login.title")}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            {t("login.localAccountLogin")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive space-y-1">
              <p className="font-medium">{t("login.accountLocked")}</p>
              <p>
                {t("login.tooManyAttempts").replace("{minutes}", String(lockoutMinutes))}
              </p>
              <p className="text-xs opacity-75">
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
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
            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading ? t("common.signingIn") : t("common.signIn")}
            </Button>
          </form>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("login.backToSSOLogin")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
