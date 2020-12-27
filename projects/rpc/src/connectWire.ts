import { t } from 'loi';
import * as Loi from 'loi';
import { RpcMethods, RpcProtocol } from "./RpcProtocol";
import { RpcWire } from "./RpcWire";

type TypeOfTuple<Y extends any[]> = {
  [K in keyof Y]: Y[K] extends t.Any ? t.TypeOf<Y[K]> : never
}

type TupleOrNot<Y> = Y extends readonly any[] ? Y : never

export type RpcMethodFunctionDefinition<M extends RpcMethods> = {
  [K in keyof M]: M[K] extends RpcMethods ? RpcMethodFunctionDefinition<M[K]> : (...args: TupleOrNot<TypeOfTuple<M[K]['arguments']>>) => Promise<t.TypeOf<M[K]['return']>>
}

export type ConnectWire<T extends RpcProtocol> = RpcMethodFunctionDefinition<T['server']> & { on: RpcMethodFunctionDefinition<T['client']> }
export type ConnectedWire<P extends RpcProtocol, T extends new (...args: any[]) => RpcWire> = ConnectWire<P> & InstanceType<T>

function castPath(path: string | string[]) {
  if (Array.isArray(path)) return path;
  return path.split(".");
}

function getPath(target: any, inputPath: string | string[]) {
  const path = castPath(inputPath);
  while (path.length > 0) {
    if (!target) return;
    if (typeof target !== 'object') return;

    const key = path.shift()!
    if (!Object.prototype.hasOwnProperty.call(target, key)) return;
    target = target[key];
  }
  return target;
}

function setPath(target: any, inputPath: string | string[], value: any) {
  const path = castPath(inputPath);
  if (!target) throw new Error('Invalid target');
  if (!path.length) throw new Error('Invalid path');

  const last = path.pop()!;
  while (path.length > 0) {
    const key = path.shift()!
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      const next = Object.create(null);
      Object.defineProperty(target, key, { configurable: true, enumerable: true, value: next, writable: true })
      target = next;
    } else {
      const next = target[key];
      if (!next || typeof next !== 'object') throw new Error('Path already exist with unsafe type');
      target = next;
    }
  }
  Object.defineProperty(target, last, { configurable: true, enumerable: true, value: value, writable: true });
}

export function connectWire<P extends RpcProtocol, T extends new (...args: any[]) => RpcWire>(protocol: P, wire: T) {
  const base = class ConnectedWireBase extends wire {
    _close!: any
    _send!: any

    constructor(...args: any[]) {
      super(...args);

      for (const [key, fn] of serverMethods) {
        setPath(this, key, fn.bind(this));
      }
    }

    async _runMethod(name: string, args: any[]): Promise<any> {
      if (!Object.prototype.hasOwnProperty.call(protocol.flattenClient, name)) throw new Error("Method Not Found");
      const method = protocol.flattenClient[name];

      const decoded: any[] = []
      for (let i = 0; i < method.arguments.length; i++) {
        const type = method.arguments[i]
        decoded[i] = Loi.validateOrThrow(args[i], type)
      }

      const fn = getPath((this as ConnectedWire<P, T>).on, name);
      if (typeof fn !== 'function') throw new Error('Invalid Method');
      const result = await fn.apply(this, decoded)
      const encodedResult = method.return.encode(result)
      Loi.validateOrThrow(result, method.return)
      return encodedResult;
    }
  }
  const klass = base as unknown as {
    new(...args: T extends (new (...args: infer R) => any) ? R : never): ConnectedWire<P, T>,
    prototype: ConnectedWire<P, T>,
  }

  const serverMethods: Array<[string, Function]> = []
  for (const [path, method] of Object.entries(protocol.flattenServer)) {
    const fn = async function connectedRemoteFunction(this: RpcWire, ...args: any[]) {
      const encoded: any[] = [];
      for (let i = 0; i < method.arguments.length; i++) {
        const type = method.arguments[i]
        encoded[i] = type.encode(args[i])
        Loi.validateOrThrow(encoded[i], method.arguments[i])
      }

      return Loi.validateOrThrow(await this._call(path, encoded), method.return);
    }
    setPath(klass.prototype, path, fn)
    serverMethods.push([path, fn]);
  }

  const notImplemented = async function connectedNotImplementedHandler() {
    throw new Error('Method Not Implemented');
  }
  const on = klass.prototype.on = Object.create(null)
  for (const [path] of Object.entries(protocol.flattenClient)) {
    setPath(on, path, notImplemented);
  }

  return klass
}
