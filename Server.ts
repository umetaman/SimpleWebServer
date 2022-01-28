import { CommandLine, IConfig } from './CommandLine'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import * as ws from 'ws'
import { WatchDirectoryFlags } from 'typescript'

const headers: any = {
    '.js': { 'Content-Type': 'text/javascript' },
    '.css': { 'Content-Type': 'text/css' },
    '.html': { 'Content-Type': 'text/html' },
    '.jpg': { 'Content-Type': 'image/jpeg' },
    '.jpeg': { 'Content-Type': 'image/jpeg' },
    '.png': { 'Content-Type': 'image/png' },
}
Object.freeze(headers)

const config: IConfig = CommandLine.getArgs()
const server: http.Server = http.createServer()

function logServer(msg: string): void {
    console.log(`[Server] ${msg}`)
}

function logWs(msg: string): void {
    console.log(`[Ws] ${msg}`)
}

// ==================
// WebServer
// ==================

const onRequestListener: http.RequestListener = (
    req: http.IncomingMessage,
    res: http.ServerResponse
) => {
    // resolve as relative path
    const url = req.url?.startsWith('/') ? '.' + req.url : req.url
    logServer('Request: ' + url)

    switch (url) {
        case './':
        case './index.html':
            try {
                const rootHtml = fs.readFileSync(
                    path.resolve(
                        __dirname,
                        config.htdocsDirectory as string,
                        'index.html'
                    )
                )
                // :(
                res.writeHead(200, headers['.html'])
                res.write(rootHtml)
            } catch (e) {
                console.error(e)
                res.writeHead(404)
            } finally {
                res.end()
            }
            break

        case undefined:
            res.writeHead(404)
            res.end()
            break

        default:
            try {
                const assetPath = path.resolve(
                    __dirname,
                    config.htdocsDirectory as string,
                    url
                )
                const assetContent = fs.readFileSync(assetPath)
                const ext = path.extname(assetPath)
                res.writeHead(200, headers[ext])
                res.write(assetContent)
            } catch (e) {
                console.error(e)
                res.writeHead(404)
            } finally {
                res.end()
            }
            break
    }
}

server.on('request', onRequestListener)
server.listen(config.webServerPortNumber)
logServer(
    `Port: ${config.webServerPortNumber}, Directory: ${config.htdocsDirectory}`
)

// ==================
// WebSocket
// ==================

const wsServer = new ws.Server({ port: config.webSocketPortNumber })
logWs('Port: ' + config.webSocketPortNumber)

function broadcastMessageToClients(messageObj: any) {
    wsServer.clients.forEach((client) => {
        client.send(JSON.stringify(messageObj))
    })
}

function onMessage(data: ws.RawData, isBinary: boolean): void {
    if (isBinary) {
        logWs('Ignore binary message.')
        return
    }

    try {
        const json = JSON.parse(data.toString())
        logWs(json)
        broadcastMessageToClients(json)
    } catch (e) {
        console.error(e)
    }
}

wsServer.on('connection', (ws) => {
    ws.on('message', onMessage)
})
