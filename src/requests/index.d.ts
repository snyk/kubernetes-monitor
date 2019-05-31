export interface ApiOptions {
    body?: any;
    query?: any;
}

export interface DepGraphPayload {
    userId: string;
    imageLocator: string;
    agentId: string;
    dependencies?: any; // TODO(ivan): correct type
}