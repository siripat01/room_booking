import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "web";
import { Button } from "web";

export function UserMenu() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Account</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent style={{ width: "200px" }}>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          My Bookings <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoomActions() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">···</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent style={{ width: "180px" }}>
        <DropdownMenuItem>View Details</DropdownMenuItem>
        <DropdownMenuItem>Book Room</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Report Issue</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
