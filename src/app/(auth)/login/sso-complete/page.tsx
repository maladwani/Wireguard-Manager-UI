"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/shared/logo";

function SSOCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const bridgeToken = searchParams.get("t");

    if (!bridgeToken) {
      setError("Invalid SSO session - missing token.");
      return;
    }

    signIn("sso-internal", {
      bridgeToken,
      redirect: false,
    })
      .then((result) => {
        if (result?.error) {
          setError("SSO sign-in failed. The session may have expired - please try again.");
        } else {
          router.replace("/");
          router.refresh();
        }
      })
      .catch(() => {
        setError("An unexpected error occurred during SSO sign-in.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Logo size={48} />
      {error ? (
        <div className="max-w-sm text-center space-y-3">
          <p className="text-destructive font-medium">{error}</p>
          <a
            href="/login"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to login
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Completing sign-in…</p>
        </div>
      )}
    </div>
  );
}

export default function SSOCompletePage() {
  return (
    <Suspense>
      <SSOCompleteContent />
    </Suspense>
  );
}
