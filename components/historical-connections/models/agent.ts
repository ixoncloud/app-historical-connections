export interface Agent {
  publicId: string;
  name: string;
  servers: { publicId: string; type: string }[];
  connectedUsers: { publicId: string; name?: string }[];
}
