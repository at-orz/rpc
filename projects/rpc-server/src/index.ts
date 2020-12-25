import { RpcWire } from '@orz/rpc';
import assert from 'assert';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';

type Mutable<T> = { -readonly [KeyType in keyof T]: T[KeyType]; }
function mutable<T>(obj: T): Mutable<T> { return obj as any }

export class RpcConnection extends RpcWire {
  readonly socket!: WebSocket
  readonly request!: IncomingMessage

  _handle(request: this['request'], socket: this['socket']) {
    assert(!this.request)
    assert(!this.socket)

    const mutableThis = mutable(this)
    mutableThis.socket = socket
    mutableThis.request = request

    this._listenToMessage()
  }

  private _listenToMessage() {
    this.socket.on('message', (message) => {
      if (typeof message !== 'string') {
        assert(Buffer.isBuffer(message));
      }
      void this._handleMessage(message);
    })
  }

  protected _close(message?: string, code?: number): void {
    this.socket.close(code, message);
  }

  protected _send(data: Uint8Array): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.socket.send(data, (err) => {
        if (err) {
          reject()
        } else {
          resolve()
        }
      })
    })
  }
}
