"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const src = mounted && resolvedTheme === "light"
    ? "/logo-light.svg"
    : "/logo-dark.svg";

  return (
    <Image
      src={src}
      alt="WireGuard"
      width={size}
      height={size}
      className={className}
      priority
      unoptimized
    />
  );
}
