export interface ConnectionEvent {
          agentId: string;
          event: "AgentConnectedUser" | "AgentDisconnectedUser";
          time: string;
          user: {name: string, publicId: string};
}