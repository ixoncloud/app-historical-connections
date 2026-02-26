export interface AuditLog {
    after: {user: {name: string, publicId: string}}[];
    target: "AgentConnectedUser" | "AgentDisconnectedUser";
    time: string;
    topic: {agent: string, company: string};
}