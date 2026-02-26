export interface Agent {
    publicId: string;
    name: string;
    connectedUsers: { publicId: string; name?: string }[];
}