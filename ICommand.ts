export interface ConnectTCPCommand {
    command: string,
    ip: string,
    port: number
}

export interface SendTCPCommand { 
    command: string,
    data: any
}