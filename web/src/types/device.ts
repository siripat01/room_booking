export interface Device {
  id: string;
  roomId: string | null;
  name: string;
  deviceKey: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  room?: Room | null;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  floor: string;
  isActive: boolean;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
  device?: Device | null;
}

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  unassigned: number;
}

export type DeviceStatus = "online" | "offline" | "unknown";

export interface ConnectionHistoryItem {
  timestamp: string;
  status: "connected" | "disconnected";
}

export interface DeviceDetail extends Device {
  connectionHistory: ConnectionHistoryItem[];
}
