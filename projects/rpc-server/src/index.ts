import { RpcWire } from '@orz/rpc';
import assert from 'assert';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';

type Mutable<T> = { -readonly [KeyType in keyof T]: T[KeyType]; }
function mutable<T>(obj: T): Mutable<T> { return obj as any }

export class RpcConnection extends RpcWire {
  readonly rpcSocket!: WebSocket
  readonly rpcRequest!: IncomingMessage

  rpcHandle(request: this['rpcRequest'], socket: this['rpcSocket']) {
    assert(!this.rpcRequest)
    assert(!this.rpcSocket)

    const mutableThis = mutable(this)
    mutableThis.rpcSocket = socket
    mutableThis.rpcRequest = request

    this.rpcListenToMessage()
  }

  private rpcListenToMessage() {
    this.rpcSocket.on('message', (message) => {
      this.rpcRunInContext(() => {
        if (typeof message !== 'string') {
          assert(Buffer.isBuffer(message));
        }
        void this.rpcHandleMessage(message);
      })
    })
  }

  protected rpcSocketClose(message?: string, code?: number): void {
    this.rpcSocket.close(code, message);
  }

  protected rpcSocketSend(data: Uint8Array): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.rpcSocket.send(data, (err) => {
        if (err) {
          reject()
        } else {
          resolve()
        }
      })
    })
  }
}
