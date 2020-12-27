import { loggerStub } from '@orz/logger-stub';
import { defer as createDefer, NavybirdDefer } from 'navybird';
import { Bag } from './Bag';

export abstract class RpcWire {
  public logger = loggerStub

  public runInContext<T>(task: () => T) {
    return task()
  }

  private _seq: number = 0

  // TODO: cleanup callbacks
  private _defers = new Map<number, NavybirdDefer<any>>()

  protected async _handleMessage(message: Uint8Array | string) {
    if (typeof message === 'string') {
      return this._panic('Non-binary message received');
    }

    let decoded: any
    try {
      decoded = Bag.decode(message)
    } catch (e) {
      this.logger.error(e, 'Failed to decode message')
      return this._panic("Cannot decode the message");
    }

    if (this._isRpcRequest(decoded)) {
      await this._handleRequest(decoded)
    } else if (this._isRpcResponse(decoded)) {
      if (!this._defers.has(decoded.seq)) {
        this.logger.warn("Got unwanted response, seq: {Seq}", decoded.seq)
        return
      }

      const defer = this._defers.get(decoded.seq)!
      this._defers.delete(decoded.seq)

      if ('result' in decoded) {
        defer.resolve(decoded.result)
      } else {
        defer.reject(new RpcError(decoded.error))
      }
    } else {
      this.logger.error('Got neither request nor response {@Message}', decoded)
      return this._panic('Invalid message received')
    }
  }

  private async _handleRequest(decoded: RpcRequest<any, any[]>) {
    try {
      const result = await (this as any)[decoded.fn].apply(this, decoded.args);
      const response: RpcSuccessResponse<any> = {
        seq: decoded.seq,
        result,
        error: null
      }
      await this._send(Bag.encode(response));
    } catch (e) {
      const response: RpcErrorResponse = {
        seq: decoded.seq,
        error: {
          code: '// TODO',
          message: '// TODO'
        },
      }
      await this._send(Bag.encode(response));
    }
  }

  /**
   * @param code https://github.com/Luka967/websocket-close-codes
   */
  protected _panic(message: string, code: number = 4033): void {
    this._panic = () => { };
    this.logger.error("Connection closed due to {Reason}", message);
    this._close(message, code);
  }

  protected abstract _close(message?: string, code?: number): void
  protected abstract _send(data: Uint8Array): Promise<void>

  public async _call<Name, Arguments extends any[], R = any>(fn: Name, args: Arguments): Promise<R> {
    const seq = this._seq++;
    const defer = createDefer<R>()
    this._defers.set(seq, defer)

    const request: RpcRequest<Name, Arguments> = {
      seq,
      args,
      fn,
    }

    const payload = Bag.encode(request)
    await this._send(payload)

    return await defer.promise
  }

  public _isRpcRequest(obj: any): obj is RpcRequest<any, any[]> {
    return 'fn' in obj
  }

  public _isRpcResponse(obj: any): obj is RpcResponse<any> {
    return 'result' in obj
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
