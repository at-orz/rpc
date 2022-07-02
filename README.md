# rpc

Yet another RPC scaffolding

## Install

### Node.js

```bash
yarn add @orz/rpc
```

### Deno

```typescript
import { RpcWire, connectWire, reverseProtocol, rpcProtocol, rpcMethod } from 'https://esm.sh/@orz/rpc@2.1.3'
```

## Example

[Edit this example in StackBlitz](https://stackblitz.com/edit/orz-rpc)

```typescript
import { RpcWire, connectWire, reverseProtocol, rpcProtocol, rpcMethod } from '@orz/rpc'

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

  protected async rpcSocketSend(data: any): Promise<void> {
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
      for (let i = 5; i > 0; i--) {
        void this.notify(`Thanks for your order. Please wait for ${i} seconds ...`)
        await new Promise<void>((r) => {
          setTimeout(r, 1000)
        })
      }
      return a + b
    }

    this.rpcStart(target)
  }
}

;(async () => {
  const channel = new MessageChannel()
  const server = new DemoServer(channel.port1)
  const client = new DemoClient(channel.port2)
  const result = await client.plus(2, 3)
  console.log(`got rpc result: ${result}`)
})()
```
