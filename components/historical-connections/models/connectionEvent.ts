export interface ConnectionEvent {
  agentId: string;
  event:
    | "AgentConnectedUser"
    | "AgentDisconnectedUser"
    | "WebaccessConnectedUser"
    | "WebaccessDisconnectedUser";
  time: string;
  user: { name: string; publicId: string };
}
