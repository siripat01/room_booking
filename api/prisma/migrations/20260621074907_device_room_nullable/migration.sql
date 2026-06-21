-- DropForeignKey
ALTER TABLE "devices" DROP CONSTRAINT "devices_room_id_fkey";

-- AlterTable
ALTER TABLE "devices" ALTER COLUMN "room_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
