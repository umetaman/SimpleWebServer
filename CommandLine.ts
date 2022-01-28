import { parse } from 'ts-command-line-args'

export interface IConfig {
    webServerPortNumber: number
    webSocketPortNumber: number
    htdocsDirectory?: string
}

export class CommandLine {
    static getArgs(): IConfig {
        const args = parse<IConfig>({
            webServerPortNumber: { type: Number },
            webSocketPortNumber: { type: Number },
            htdocsDirectory: { type: String, alias: 'd', optional: true },
        })
        if (args.htdocsDirectory === undefined) {
            args.htdocsDirectory = './htdocs'
        }

        return args
    }
}
