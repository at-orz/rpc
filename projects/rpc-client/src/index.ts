import { RpcWire } from '@orz/rpc';

type Mutable<T> = { -readonly [KeyType in keyof T]: T[KeyType]; }
function mutable<T>(obj: T): Mutable<T> { return obj as any }

export class RpcClient extends RpcWire {
  readonly rpcSocket!: WebSocket

  rpcStart(target: string) {
    if (this.rpcSocket) throw new Error("Assert failed")

    const mutableThis = mutable(this)
    mutableThis.rpcSocket = new WebSocket(target);

    return this.rpcListenToMessage()
  }

  private async rpcListenToMessage() {
    const promise = new Promise<void>((resolve, reject) => {
      this.rpcSocket.onerror = (e) => {
        const err = new Error(JSON.stringify(e)) as any
        err.event = e;
        reject(err);
        this.rpcSocket.onerror = null;
      }

      this.rpcSocket.onopen = () => {
        resolve()
      }
    })

    this.rpcSocket.onmessage = (e) => {
      void this.rpcRunInContext(async () => {
        if (e.data instanceof Blob) {
          const buf = await e.data.arrayBuffer()
          await this.rpcHandleMessage(new Uint8Array(buf))
        } else {
          console.error(e.data);
          throw new Error("Invalid message type")
        }
      })
    }

    try {
      await promise
    } finally {
      this.rpcSocket.onerror = null;
    }
  }

  protected rpcSocketClose(message?: string, code?: number): void {
    this.rpcSocket.close(code, message);
  }

  protected async rpcSocketSend(data: Uint8Array): Promise<void> {
    this.rpcSocket.send(data)
  }
}
