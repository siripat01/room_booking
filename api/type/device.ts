export type CreateDeviceInput = {
    name: string;
    deviceKey: string;
    roomId: string;
    isActive?: boolean;
}

export type UpdateDeviceInput = {
    name?: string;
    deviceKey?: string;
    roomId?: string;
    isActive?: boolean;
}
