export type CreateBookingInput = {
    startTime: string;
    endTime: string;
    attendees: number;
    purpose?: string;
    roomId: string;
    userId: string;
}