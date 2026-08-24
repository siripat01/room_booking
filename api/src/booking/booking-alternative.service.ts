import type { Prisma } from "../../generated/prisma/client";
import { getBangkokDateTime } from "../lib/bangkok-time";
import { BookingPolicyService, type BookingPolicyInput } from "./booking-policy.service";
import type { BookingAlternative } from "./booking-series.types";

type AlternativeClient = Pick<
  Prisma.TransactionClient,
  "booking" | "room" | "roomClosure" | "timeSlot" | "user"
>;

const NEARBY_OFFSETS_MINUTES = [-30, 30, -60, 60, -90, 90] as const;

export class BookingAlternativeService {
  constructor(private readonly policy = new BookingPolicyService()) {}

  async suggest(
    client: AlternativeClient,
    input: BookingPolicyInput,
    limit = 5,
  ): Promise<BookingAlternative[]> {
    const requestedRoom = await client.room.findUnique({
      where: { id: input.roomId },
      select: { id: true, name: true, amenities: true },
    });
    if (!requestedRoom || limit < 1) return [];

    const otherRooms = await client.room.findMany({
      where: {
        id: { not: input.roomId },
        isActive: true,
        capacity: { gte: input.attendees },
        amenities: { hasEvery: requestedRoom.amenities },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 20,
      select: { id: true, name: true },
    });

    const result: BookingAlternative[] = [];
    const seen = new Set<string>();
    const addIfValid = async (
      rank: 1 | 2 | 3,
      reason: BookingAlternative["reason"],
      room: { id: string; name: string },
      startTime: Date,
      endTime: Date,
    ) => {
      if (result.length >= limit) return;
      if (getBangkokDateTime(startTime).date !== getBangkokDateTime(endTime).date) return;
      const key = `${room.id}:${startTime.toISOString()}:${endTime.toISOString()}`;
      if (seen.has(key)) return;
      seen.add(key);
      try {
        await this.policy.validateCreate(client, {
          ...input,
          roomId: room.id,
          startTime,
          endTime,
        });
        result.push({
          rank,
          reason,
          roomId: room.id,
          roomName: room.name,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });
      } catch {
        // A candidate is only a suggestion when every normal booking policy
        // passes; rejected candidates are intentionally omitted.
      }
    };

    const durationMs = input.endTime.getTime() - input.startTime.getTime();
    for (const offset of NEARBY_OFFSETS_MINUTES) {
      const startTime = new Date(input.startTime.getTime() + offset * 60_000);
      await addIfValid(
        1,
        "SAME_ROOM_NEARBY_TIME",
        requestedRoom,
        startTime,
        new Date(startTime.getTime() + durationMs),
      );
    }
    for (const room of otherRooms) {
      await addIfValid(2, "ANOTHER_ROOM_SAME_TIME", room, input.startTime, input.endTime);
    }
    for (const offset of NEARBY_OFFSETS_MINUTES) {
      for (const room of otherRooms) {
        const startTime = new Date(input.startTime.getTime() + offset * 60_000);
        await addIfValid(
          3,
          "ROOM_AND_TIME_COMBINATION",
          room,
          startTime,
          new Date(startTime.getTime() + durationMs),
        );
      }
    }
    return result;
  }
}
