export type CreateDeviceInput = {
    name: string;
    roomId?: string | null;
    isActive?: boolean;
}

export type UpdateDeviceInput = {
    name?: string;
    roomId?: string | null;
}
