import { Device, Room } from "../types/device";

const now = new Date();
const oneMinAgo = new Date(now.getTime() - 30 * 1000);
const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

export const mockRooms: Room[] = [
  {
    id: "room-1",
    name: "ห้องประชุม A101",
    description: "ห้องประชุมขนาดเล็ก",
    capacity: 8,
    floor: "ชั้น 1",
    isActive: true,
    amenities: ["projector", "whiteboard", "tv"],
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneDayAgo.toISOString(),
  },
  {
    id: "room-2",
    name: "ห้องประชุม B205",
    description: "ห้องประชุมขนาดกลาง",
    capacity: 16,
    floor: "ชั้น 2",
    isActive: true,
    amenities: ["projector", "tv", "ac", "video-conference"],
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneDayAgo.toISOString(),
  },
  {
    id: "room-3",
    name: "ห้องประชุม C301",
    description: "ห้องประชุมขนาดใหญ่",
    capacity: 30,
    floor: "ชั้น 3",
    isActive: true,
    amenities: ["projector", "whiteboard", "tv", "ac", "video-conference", "speaker"],
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneDayAgo.toISOString(),
  },
  {
    id: "room-4",
    name: "ห้องประชุม D102",
    description: "ห้องประชุมระดับบริหาร",
    capacity: 12,
    floor: "ชั้น 1",
    isActive: false,
    amenities: ["tv", "video-conference", "speaker"],
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneDayAgo.toISOString(),
  },
  {
    id: "room-5",
    name: "ห้องประชุม E201",
    description: "ห้องอบรม",
    capacity: 20,
    floor: "ชั้น 2",
    isActive: true,
    amenities: ["projector", "whiteboard", "ac"],
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneDayAgo.toISOString(),
  },
];

export const mockDevices: Device[] = [
  {
    id: "device-1",
    roomId: "room-1",
    name: "Kiosk ห้อง A101",
    deviceKeyPrefix: "dk_a3f8b2c1",
    credentialVersion: 1,
    credentialRotatedAt: oneDayAgo.toISOString(),
    revokedAt: null,
    onlineStatus: "online",
    isActive: true,
    lastSeenAt: oneMinAgo.toISOString(),
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneMinAgo.toISOString(),
    room: mockRooms[0],
  },
  {
    id: "device-2",
    roomId: "room-2",
    name: "Kiosk ห้อง B205",
    deviceKeyPrefix: "dk_b4c5d6e7",
    credentialVersion: 1,
    credentialRotatedAt: oneDayAgo.toISOString(),
    revokedAt: null,
    onlineStatus: "offline",
    isActive: true,
    lastSeenAt: fiveMinAgo.toISOString(),
    createdAt: oneDayAgo.toISOString(),
    updatedAt: fiveMinAgo.toISOString(),
    room: mockRooms[1],
  },
  {
    id: "device-3",
    roomId: "room-3",
    name: "Kiosk ห้อง C301",
    deviceKeyPrefix: "dk_c5d6e7f8",
    credentialVersion: 1,
    credentialRotatedAt: oneDayAgo.toISOString(),
    revokedAt: null,
    onlineStatus: "offline",
    isActive: true,
    lastSeenAt: oneHourAgo.toISOString(),
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneHourAgo.toISOString(),
    room: mockRooms[2],
  },
  {
    id: "device-4",
    roomId: null,
    name: "Kiosk สำรอง 1",
    deviceKeyPrefix: "dk_d6e7f8a9",
    credentialVersion: 1,
    credentialRotatedAt: oneDayAgo.toISOString(),
    revokedAt: null,
    onlineStatus: "offline",
    isActive: true,
    lastSeenAt: threeHoursAgo.toISOString(),
    createdAt: oneDayAgo.toISOString(),
    updatedAt: threeHoursAgo.toISOString(),
    room: null,
  },
  {
    id: "device-5",
    roomId: null,
    name: "Kiosk สำรอง 2",
    deviceKeyPrefix: "dk_e7f8a9b0",
    credentialVersion: 1,
    credentialRotatedAt: oneDayAgo.toISOString(),
    revokedAt: oneDayAgo.toISOString(),
    onlineStatus: "unknown",
    isActive: false,
    lastSeenAt: null,
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneDayAgo.toISOString(),
    room: null,
  },
];

export function getMockDevices(): Device[] {
  return mockDevices;
}

export function getMockRooms(): Room[] {
  return mockRooms;
}

export function getMockDeviceStats(devices: Device[] = mockDevices) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  let online = 0;
  let offline = 0;
  let unknown = 0;
  let unassigned = 0;

  devices.forEach((device) => {
    if (!device.roomId) {
      unassigned++;
    }

    if (!device.lastSeenAt) {
      unknown++;
    } else {
      const lastSeen = new Date(device.lastSeenAt);
      if (lastSeen > oneMinuteAgo) {
        online++;
      } else {
        offline++;
      }
    }
  });

  return {
    total: devices.length,
    online,
    offline,
    unknown,
    unassigned,
  };
}
