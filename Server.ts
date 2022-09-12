import { CommandLine, IConfig } from './CommandLine'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import * as ws from 'ws'
import { WatchDirectoryFlags } from 'typescript'
import { ConnectTCPCommand, SendTCPCommand } from './ICommand'

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
    const exts = Object.keys(headers)

    // resolve as relative path
    const url = req.url?.startsWith('/') ? '.' + req.url : req.url
    logServer('Request: ' + url)

    const responseIndex = () => {
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
    }

    switch (url) {
        case './':
        case './index.html':
            responseIndex()
            break

        case undefined:
            res.writeHead(404)
            res.end()
            break

        default:
            if(exts.filter(e => url.endsWith(e)).length < 1){
                responseIndex()
                break
            }

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

// ==============================
// TCP Client
// ==============================

import * as net from "net"

let client: net.Socket | null = null

function createTcpClient(ip: string, port: number) {
    closeTcpClient()
    
    return net.connect(port, ip, () => {
        console.log("[TCP] Connect to server.")
    })
}

function closeTcpClient() {
    if(client !== null){
        client.destroy()
    }
}


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
        if(json.command) {
            logWs(`Received Command => ${json.command}`)
            onReceiveCommand(json)
        }
    
    } catch (e) {
        console.error(e)
    }
}

function onReceiveCommand(commandObj: any){
    if(!commandObj.command) {
        throw new Error("Command key not found.")
    }

    switch(commandObj.command){
        case "ConnectTCP":
            const connectCommand = commandObj as ConnectTCPCommand
            client = createTcpClient(connectCommand.ip, connectCommand.port)
            break
        case "SendTCP":
            const sendCommand = commandObj as SendTCPCommand
            try {
                const jsonStr = JSON.stringify(sendCommand.data)
                
                const packetHeader = new Uint8Array(4)
                const dataView = new DataView(packetHeader.buffer)
                dataView.setUint32(0, jsonStr.length, true)
                
                client?.write(packetHeader, (error) => {
                    if(error){
                        console.error(`[TCP] Send::Header: ${error}`)
                    }
                })
                client?.write(jsonStr, (error) => {
                    if(error){
                        console.error(`[TCP] Send::Body: ${error}`)
                    }
                })
                console.log(jsonStr)
            }
            catch(e){
                console.error(e)
            }
            break
        case "DestroyTCP":
            closeTcpClient()
            break
    }
}

wsServer.on('connection', (ws) => {
    ws.on('message', onMessage)
})
