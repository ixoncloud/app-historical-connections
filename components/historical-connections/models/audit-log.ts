export interface AuditLog {
  after: {
    agent?: { publicId: string };
    agentServer?: { publicId: string };
    server: { type: string };
    user: { name: string; publicId: string };
  }[];
  target:
    | "AgentConnectedUser"
    | "AgentDisconnectedUser"
    | "WebAccessOpened"
    | "WebaccessConnectedUser"
    | "WebaccessDisconnectedUser";
  time: string;
  topic: { agent: string; company: string };
  actor: { resource: { name: string; publicId: string } };
}
