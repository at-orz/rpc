# rpc

## Example

```typescript
import { RpcWire, connectWire } from '@orz/rpc'

class WindowMessageRpc extends RpcWire {
  private target!: MessagePort

  public rpcStart(target: MessagePort) {
    this.rpcStop()
    this.target = target
    target.onmessage = this.rpcOnMessage as any
    target.onmessageerror = console.error
  }

  private rpcOnMessage = (e: MessageEvent) => {
    void this.rpcHandleMessage(e.data)
  }

  public rpcStop() {
    if (this.target) this.target.close()
  }

  protected rpcSocketClose(_message?: string, _code?: number): void {
    this.rpcStop()
    this.target.close()
  }

  protected async rpcSocketSend(data: Uint8Array): Promise<void> {
    this.target.postMessage(data)
  }
}

const demoProtocol = rpcProtocol({
  server: {
    plus: rpcMethod<[number, number], number>(),
  },
  client: {
    notify: rpcMethod<[string], void>(),
  },
})

class DemoClient extends connectWire(demoProtocol, WindowMessageRpc) {
  public constructor(target: MessagePort) {
    super()

    this.on.notify = async (str: string) => {
      console.log(`server notify us: ${str}`)
    }

    this.rpcStart(target)
  }
}

class DemoServer extends connectWire(reverseProtocol(demoProtocol), WindowMessageRpc) {
  public constructor(target: MessagePort) {
    super()

    this.on.plus = async (a: number, b: number) => {
      await this.notify('Thanks for your order. You are now on the queue #1')
      await Promise.resolve((r) => {
        setTimeout(r, 2000)
      })
      return a + b
    }

    this.rpcStart(target)
  }
}

const channel = new MessageChannel()
const server = new DemoServer(channel.port1)
const client = new DemoServer(channel.port2)
const result = await client.plus(1 + 1)
console.log(`got rpc result: ${result}`)
```
