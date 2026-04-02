export interface AuditLog {
  after: {
    server: { type: string };
    user: { name: string; publicId: string };
  }[];
  target: "AgentConnectedUser" | "AgentDisconnectedUser" | "WebAccessOpened";
  time: string;
  topic: { agent: string; company: string };
  actor: { resource: { name: string; publicId: string } };
}
