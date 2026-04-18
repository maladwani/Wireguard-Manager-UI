// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { WgPeer, WgServerStatus } from "@/types";
import { db } from "@/lib/db";
import { resolvePublicIP } from "@/lib/public-ip";

const WG_CONFIG_PATH =
  process.env.WG_CONFIG_PATH || "/etc/wireguard/wg0.conf";
const WG_INTERFACE = "wg0";
const EXEC_TIMEOUT = 10000;

const DEFAULT_POST_UP =
  "iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE";
const DEFAULT_POST_DOWN =
  "iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE";

export interface WgSettings {
  serverAddress: string;
  listenPort: string;
  postUp: string;
  postDown: string;
  defaultDns: string;
  defaultAllowedIPs: string;
  defaultMtu: string;
  persistentKeepalive: string;
  endpointHost: string;
}

export async function getSettings(): Promise<WgSettings> {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    serverAddress: map.serverAddress || "10.0.0.1/24",
    listenPort: map.listenPort || "51820",
    postUp: map.postUp ?? DEFAULT_POST_UP,
    postDown: map.postDown ?? DEFAULT_POST_DOWN,
    defaultDns: map.defaultDns || "1.1.1.1, 8.8.8.8",
    defaultAllowedIPs: map.defaultAllowedIPs || "0.0.0.0/0, ::/0",
    defaultMtu: map.defaultMtu || "",
    persistentKeepalive: map.persistentKeepalive || "25",
    endpointHost: map.endpointHost || "auto",
  };
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: EXEC_TIMEOUT, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function interfaceExists(): boolean {
  try {
    execSync(`ip link show ${WG_INTERFACE}`, {
      timeout: EXEC_TIMEOUT,
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

function ensureInterface(): void {
  if (interfaceExists()) return;

  if (!fs.existsSync(WG_CONFIG_PATH)) {
    initServerConfig();
  }

  exec(`wg-quick up ${WG_CONFIG_PATH}`);
}

function initServerConfig(): void {
  const dir = path.dirname(WG_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { privateKey } = generateKeyPair();
  const config = [
    "[Interface]",
    `Address = 10.0.0.1/24`,
    `ListenPort = 51820`,
    `PrivateKey = ${privateKey}`,
    `PostUp = ${DEFAULT_POST_UP}`,
    `PostDown = ${DEFAULT_POST_DOWN}`,
    "",
  ].join("\n");

  fs.writeFileSync(WG_CONFIG_PATH, config, "utf-8");
}

export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = exec("wg genkey");
  const publicKey = exec(`echo "${privateKey}" | wg pubkey`);
  return { privateKey, publicKey };
}

export function generatePresharedKey(): string {
  return exec("wg genpsk");
}

export function getServerStatus(): WgServerStatus {
  ensureInterface();
  const dumpOutput = exec(`wg show ${WG_INTERFACE} dump`);

  if (!dumpOutput) {
    return {
      running: false,
      publicKey: "",
      listenPort: 0,
      peers: [],
      totalTransferRx: 0,
      totalTransferTx: 0,
    };
  }

  const lines = dumpOutput.split("\n");
  const [serverLine, ...peerLines] = lines;
  const [, publicKey, listenPort] = serverLine.split("\t");

  let totalRx = 0;
  let totalTx = 0;

  const peers: WgPeer[] = peerLines
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split("\t");
      const rx = parseInt(parts[5] || "0", 10);
      const tx = parseInt(parts[6] || "0", 10);
      totalRx += rx;
      totalTx += tx;
      return {
        publicKey: parts[0],
        endpoint: parts[2] || "",
        allowedIPs: parts[3] || "",
        latestHandshake: parseInt(parts[4] || "0", 10),
        transferRx: rx,
        transferTx: tx,
      };
    });

  return {
    running: true,
    publicKey,
    listenPort: parseInt(listenPort, 10),
    peers,
    totalTransferRx: totalRx,
    totalTransferTx: totalTx,
  };
}

export function getServerPublicKey(): string {
  ensureInterface();
  return exec(`wg show ${WG_INTERFACE} public-key`);
}

export async function getServerEndpoint(): Promise<string> {
  ensureInterface();
  const port = exec(`wg show ${WG_INTERFACE} listen-port`) || "51820";

  const settings = await getSettings();
  const hostValue = settings.endpointHost || process.env.WG_SERVER_HOST || "auto";

  let host: string;
  if (!hostValue || hostValue === "auto") {
    try {
      host = await resolvePublicIP();
    } catch {
      host = process.env.WG_SERVER_HOST || "YOUR_SERVER_IP";
    }
  } else {
    host = hostValue;
  }

  return `${host}:${port}`;
}

function readConfig(): string {
  try {
    return fs.readFileSync(WG_CONFIG_PATH, "utf-8");
  } catch {
    return "";
  }
}

function writeConfig(content: string): void {
  const dir = path.dirname(WG_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(WG_CONFIG_PATH, content, "utf-8");
}

export function addPeer(
  publicKey: string,
  allowedIPs: string,
  presharedKey?: string
): void {
  ensureInterface();
  let config = readConfig();

  const peerBlock = [
    "",
    "[Peer]",
    `PublicKey = ${publicKey}`,
    `AllowedIPs = ${allowedIPs}`,
    ...(presharedKey ? [`PresharedKey = ${presharedKey}`] : []),
    "",
  ].join("\n");

  config += peerBlock;
  writeConfig(config);
  syncConfig();
}

export function removePeer(publicKey: string): void {
  ensureInterface();
  const config = readConfig();
  const lines = config.split("\n");
  const newLines: string[] = [];
  let skipPeer = false;

  for (const line of lines) {
    if (line.trim() === "[Peer]") {
      const nextLines = lines.slice(lines.indexOf(line));
      const pubKeyLine = nextLines.find((l) =>
        l.trim().startsWith("PublicKey")
      );
      if (pubKeyLine && pubKeyLine.includes(publicKey)) {
        skipPeer = true;
        continue;
      }
    }

    if (skipPeer) {
      if (
        line.trim() === "[Peer]" ||
        line.trim() === "[Interface]" ||
        (line.trim() === "" &&
          !lines[lines.indexOf(line) + 1]?.trim().startsWith("PublicKey") &&
          !lines[lines.indexOf(line) + 1]?.trim().startsWith("AllowedIPs") &&
          !lines[lines.indexOf(line) + 1]?.trim().startsWith("PresharedKey") &&
          !lines[lines.indexOf(line) + 1]?.trim().startsWith("Endpoint"))
      ) {
        skipPeer = false;
        if (line.trim() !== "") {
          newLines.push(line);
        }
      }
      continue;
    }

    newLines.push(line);
  }

  writeConfig(newLines.join("\n"));
  syncConfig();
}

function syncConfig(): void {
  try {
    const stripped = exec(`wg-quick strip ${WG_CONFIG_PATH}`);
    if (stripped) {
      const tmpFile = `/tmp/wg_sync_${Date.now()}.conf`;
      fs.writeFileSync(tmpFile, stripped);
      exec(`wg syncconf ${WG_INTERFACE} ${tmpFile}`);
      fs.unlinkSync(tmpFile);
    }
  } catch {
    exec(`wg syncconf ${WG_INTERFACE} ${WG_CONFIG_PATH}`);
  }
}

export function generateClientConfig(params: {
  privateKey: string;
  address: string;
  dns: string;
  serverPublicKey: string;
  serverEndpoint: string;
  presharedKey?: string;
  allowedIPs?: string;
  mtu?: string;
  persistentKeepalive?: string;
}): string {
  const lines = [
    "[Interface]",
    `PrivateKey = ${params.privateKey}`,
    `Address = ${params.address}`,
    `DNS = ${params.dns}`,
  ];
  if (params.mtu) lines.push(`MTU = ${params.mtu}`);
  lines.push(
    "",
    "[Peer]",
    `PublicKey = ${params.serverPublicKey}`,
  );
  if (params.presharedKey) lines.push(`PresharedKey = ${params.presharedKey}`);
  lines.push(
    `Endpoint = ${params.serverEndpoint}`,
    `AllowedIPs = ${params.allowedIPs || "0.0.0.0/0, ::/0"}`,
    `PersistentKeepalive = ${params.persistentKeepalive || "25"}`,
    "",
  );
  return lines.join("\n");
}

function parseSubnet(serverAddress: string): { prefix: string; mask: number } {
  const [ip, cidrStr] = serverAddress.split("/");
  const mask = parseInt(cidrStr || "24", 10);
  const octets = ip.split(".").map(Number);
  const prefix = octets.slice(0, 3).join(".");
  return { prefix, mask };
}

export async function getNextAvailableIP(): Promise<string> {
  const config = readConfig();
  const settings = await getSettings();
  const { prefix } = parseSubnet(settings.serverAddress);

  const usedIPs = new Set<number>();
  const escaped = prefix.replace(/\./g, "\\.");
  const regex = new RegExp(`AllowedIPs\\s*=\\s*${escaped}\\.(\\d+)`, "g");
  const addressMatches = config.matchAll(regex);
  for (const match of addressMatches) {
    usedIPs.add(parseInt(match[1], 10));
  }

  for (let i = 2; i < 255; i++) {
    if (!usedIPs.has(i)) {
      return `${prefix}.${i}/32`;
    }
  }

  throw new Error("No available IP addresses in the subnet");
}

export interface ConfigPeer {
  publicKey: string;
  allowedIPs: string;
  presharedKey?: string;
}

export function parseConfigPeers(): ConfigPeer[] {
  const config = readConfig();
  const peers: ConfigPeer[] = [];
  const lines = config.split("\n");
  let current: Partial<ConfigPeer> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "[Peer]") {
      if (current?.publicKey) {
        peers.push(current as ConfigPeer);
      }
      current = {};
      continue;
    }

    if (trimmed === "[Interface]") {
      if (current?.publicKey) {
        peers.push(current as ConfigPeer);
      }
      current = null;
      continue;
    }

    if (current !== null && trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();

      if (key === "PublicKey") current.publicKey = value;
      else if (key === "AllowedIPs") {
        // Use the first IP only (strip /32 suffix for the address)
        current.allowedIPs = value.split(",")[0].trim();
      } else if (key === "PresharedKey") current.presharedKey = value;
    }
  }

  if (current?.publicKey) {
    peers.push(current as ConfigPeer);
  }

  return peers;
}

export function rewriteServerConfig(settings: WgSettings): void {
  const config = readConfig();
  const lines = config.split("\n");

  const peerBlocks: string[] = [];
  let inPeer = false;
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.trim() === "[Peer]") {
      if (inPeer && currentBlock.length > 0) {
        peerBlocks.push(currentBlock.join("\n"));
      }
      inPeer = true;
      currentBlock = [line];
      continue;
    }
    if (inPeer) {
      currentBlock.push(line);
    }
  }
  if (inPeer && currentBlock.length > 0) {
    peerBlocks.push(currentBlock.join("\n"));
  }

  const existingPrivateKey = config.match(/PrivateKey\s*=\s*(.+)/)?.[1]?.trim();
  const privateKey = existingPrivateKey || generateKeyPair().privateKey;

  const newInterface = [
    "[Interface]",
    `Address = ${settings.serverAddress}`,
    `ListenPort = ${settings.listenPort}`,
    `PrivateKey = ${privateKey}`,
  ];
  if (settings.postUp) newInterface.push(`PostUp = ${settings.postUp}`);
  if (settings.postDown) newInterface.push(`PostDown = ${settings.postDown}`);

  const parts = [newInterface.join("\n")];
  for (const block of peerBlocks) {
    parts.push("\n" + block);
  }
  parts.push("");

  writeConfig(parts.join("\n"));
}

export function restartInterface(): { success: boolean; error?: string } {
  try {
    exec(`wg-quick down ${WG_CONFIG_PATH}`);
  } catch {
    // interface might not be up
  }
  const result = exec(`wg-quick up ${WG_CONFIG_PATH}`);
  if (interfaceExists()) {
    return { success: true };
  }
  return { success: false, error: result || "Failed to bring up interface" };
}
