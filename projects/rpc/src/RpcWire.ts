import { loggerStub } from '@orz/logger-stub';
import { defer as createDefer, NavybirdDefer } from 'navybird';
import { Bag } from './Bag';

export abstract class RpcWire {
  public logger = loggerStub

  public rpcRunInContext<T>(task: () => T) {
    return task()
  }

  private rpcSeq: number = 0

  // TODO: cleanup callbacks
  private rpcDefers = new Map<number, NavybirdDefer<any>>()

  protected async rpcHandleMessage(message: Uint8Array | string) {
    if (typeof message === 'string') {
      return this.rpcPanic('Non-binary message received');
    }

    let decoded: any
    try {
      decoded = Bag.decode(message)
    } catch (e) {
      this.logger.error(e, 'Failed to decode message')
      return this.rpcPanic("Cannot decode the message");
    }

    if (this.rpcIsRequest(decoded)) {
      await this.rpcHandleRequest(decoded)
    } else if (this.rpcIsResponse(decoded)) {
      if (!this.rpcDefers.has(decoded.seq)) {
        this.logger.warn("Got unwanted response, seq: {Seq}", decoded.seq)
        return
      }

      const defer = this.rpcDefers.get(decoded.seq)!
      this.rpcDefers.delete(decoded.seq)

      if ('result' in decoded) {
        defer.resolve(decoded.result)
      } else {
        defer.reject(new RpcError(decoded.error))
      }
    } else {
      this.logger.error('Got neither request nor response {@Message}', decoded)
      return this.rpcPanic('Invalid message received')
    }
  }

  async rpcRunMethod(_name: string, _args: any[]): Promise<any> {
    throw new Error('All Methods Not Implemented');
  }

  private async rpcHandleRequest(decoded: RpcRequest<any, any[]>) {
    try {
      const result = await this.rpcRunMethod(decoded.fn, decoded.args);
      const response: RpcSuccessResponse<any> = {
        seq: decoded.seq,
        result,
        error: null
      }
      await this.rpcSocketSend(Bag.encode(response));
    } catch (e) {
      this.logger.error(e, 'Error happened while running RPC method {MethodName} with {@Arguments}', decoded.fn, decoded.args)
      const response: RpcErrorResponse = {
        seq: decoded.seq,
        error: this.rpcFormatError(e),
      }
      await this.rpcSocketSend(Bag.encode(response));
    }
  }

  protected rpcFormatError(_error: any): IRpcError {
    return {
      code: "internal",
      message: "Internal Error"
    }
  }

  /**
   * @param code https://github.com/Luka967/websocket-close-codes
   */
  protected rpcPanic(message: string, code: number = 4033): void {
    this.rpcPanic = () => { };
    this.logger.error("Connection closed due to {Reason}", message);
    this.rpcSocketClose(message, code);
  }

  protected abstract rpcSocketClose(message?: string, code?: number): void
  protected abstract rpcSocketSend(data: Uint8Array): Promise<void>

  public async rpcCall<Name, Arguments extends any[], R = any>(fn: Name, args: Arguments): Promise<R> {
    const seq = this.rpcSeq++;
    const defer = createDefer<R>()
    this.rpcDefers.set(seq, defer)

    const request: RpcRequest<Name, Arguments> = {
      seq,
      args,
      fn,
    }

    const payload = Bag.encode(request)
    await this.rpcSocketSend(payload)

    return await defer.promise
  }

  public rpcIsRequest(obj: any): obj is RpcRequest<any, any[]> {
    return 'fn' in obj
  }

  public rpcIsResponse(obj: any): obj is RpcResponse<any> {
    return 'result' in obj || 'error' in obj
  }
}

export interface IRpcError {
  code: string
  message: string
}

export class RpcError extends Error implements IRpcError {
  public code: string
  constructor(data: IRpcError) {
    super(data.message)
    this.code = data.code
  }
}

type RpcRequest<Name, Arguments extends any[]> = {
  fn: Name,
  args: Arguments,
  seq: number,
}

type RpcSuccessResponse<T> = {
  seq: number,
  error: null,
  result: T,
}

type RpcErrorResponse = {
  seq: number,
  error: IRpcError,
}
type RpcResponse<T> = RpcSuccessResponse<T> | RpcErrorResponse
