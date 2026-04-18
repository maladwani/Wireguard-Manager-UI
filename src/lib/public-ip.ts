const IP_PROVIDERS = [
  "https://api.ipify.org",
  "https://ifconfig.me/ip",
  "https://icanhazip.com",
  "https://checkip.amazonaws.com",
];

const TIMEOUT_MS = 5000;

let cachedIP: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

function isValidIP(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[0-9a-fA-F:]+$/.test(ip);
}

export async function resolvePublicIP(): Promise<string> {
  if (cachedIP && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedIP;
  }

  for (const provider of IP_PROVIDERS) {
    try {
      const ip = await fetchWithTimeout(provider, TIMEOUT_MS);
      if (isValidIP(ip)) {
        cachedIP = ip;
        cacheTimestamp = Date.now();
        return ip;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Failed to resolve public IP from all providers");
}
