import { RpcWire } from '@orz/rpc';

type Mutable<T> = { -readonly [KeyType in keyof T]: T[KeyType]; }
function mutable<T>(obj: T): Mutable<T> { return obj as any }

export class RpcClient extends RpcWire {
  readonly socket!: WebSocket

  _start(target: string) {
    if (this.socket) throw new Error("Assert failed")

    const mutableThis = mutable(this)
    mutableThis.socket = new WebSocket(target);

    return this._listenToMessage()
  }

  private async _listenToMessage() {
    const promise = new Promise<void>((resolve, reject) => {
      this.socket.onerror = (e) => {
        const err = new Error(JSON.stringify(e)) as any
        err.event = e;
        reject(err);
        this.socket.onerror = null;
      }

      this.socket.onopen = () => {
        resolve()
      }
    })

    this.socket.onmessage = (e) => {
      void this.runInContext(async () => {
        if (e.data instanceof Blob) {
          const buf = await e.data.arrayBuffer()
          await this._handleMessage(new Uint8Array(buf))
        } else {
          console.error(e.data);
          throw new Error("Invalid message type")
        }
      })
    }

    try {
      await promise
    } finally {
      this.socket.onerror = null;
    }
  }

  protected _close(message?: string, code?: number): void {
    this.socket.close(code, message);
  }

  protected async _send(data: Uint8Array): Promise<void> {
    this.socket.send(data)
  }
}
