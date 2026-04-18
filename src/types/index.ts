export type UserRole = "super_admin" | "admin" | "auditor";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface WgPeer {
  publicKey: string;
  endpoint: string;
  allowedIPs: string;
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
  clientName?: string | null;
  clientAddress?: string | null;
}

export interface WgServerStatus {
  running: boolean;
  publicKey: string;
  listenPort: number;
  peers: WgPeer[];
  totalTransferRx: number;
  totalTransferTx: number;
}

export interface BandwidthSnapshot {
  timestamp: string;
  rx: number;
  tx: number;
}
