import type { PrismaClient } from "../../generated/prisma/client";
import type { CreateBookingInput } from "../../type/booking";

class BookingService {
    constructor(private prisma: PrismaClient) { }

    async createBooking(data: CreateBookingInput) {
        try {
            return await this.prisma.booking.create({
                data,
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to create booking");
        }
    }
}

export default BookingService