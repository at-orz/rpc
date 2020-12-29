import { RpcWire } from '@orz/rpc';

type Mutable<T> = { -readonly [KeyType in keyof T]: T[KeyType]; }
function mutable<T>(obj: T): Mutable<T> { return obj as any }

export class RpcClient extends RpcWire {
  readonly rpcSocket!: WebSocket

  rpcStart(target: string) {
    if (this.rpcSocket) throw new Error("Assert failed")

    const ws = new WebSocket(target);
    ws.binaryType = "arraybuffer";

    const mutableThis = mutable(this)
    mutableThis.rpcSocket = ws;

    return this.rpcListenToMessage()
  }

  private async rpcListenToMessage() {
    const promise = new Promise<void>((resolve, reject) => {
      this.rpcSocket.onclose = (e) => {
        this.rpcSocket.onclose = null;
        const err = new Error(`Connection failed to open ${e.code}${e.reason ? `: ${e.reason}` : ""}`) as any
        err.event = e;
        err.reason = e.reason;
        err.code = e.code;
        reject(err);
        this.logger.error("Connection failed to open {Code}: {Reason}", e.code, e.reason);
      }

      this.rpcSocket.onopen = () => {
        resolve()
      }
    })

    this.rpcSocket.onmessage = (e) => {
      void this.rpcRunInContext(async () => {
        if (e.data instanceof ArrayBuffer) {
          await this.rpcHandleMessage(new Uint8Array(e.data))
        } else if (e.data instanceof Blob) {
          const buf = await e.data.arrayBuffer()
          await this.rpcHandleMessage(new Uint8Array(buf))
        } else {
          this.logger.error('Invalid message type {Message}', e.data);
          this.rpcSocket.close(4033, "Invalid message type received");
        }
      })
    }

    try {
      await promise
    } finally {
      this.rpcSocket.onclose = (e) => {
        this.logger.error("Connection closed {Code}: {Reason}", e.code, e.reason);
      }
    }
  }

  protected rpcSocketClose(message?: string, code?: number): void {
    this.rpcSocket.close(code, message);
  }

  protected async rpcSocketSend(data: Uint8Array): Promise<void> {
    this.rpcSocket.send(data)
  }
}
