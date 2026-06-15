export type CreateRoomInput = {
    name: string;
    description?: string;
    capacity: number;
    floor: string;
    amenities: string[];
}