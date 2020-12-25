import { Any } from 'loi';

export type RpcMethod<Name extends string, Arguments extends Any[], Return extends Any> = { name: Name, arguments: Arguments, return: Return }
export type AnyRpcMethod = RpcMethod<any, any, any>

export function rpcMethod<
  Name extends string,
  Arguments extends Any[],
  Return extends Any
>(name: Name, returnType: Return, ...args: Arguments): RpcMethod<Name, Arguments, Return> {
  return { name, return: returnType, arguments: args }
}

type RpcMethodDict<T extends readonly AnyRpcMethod[]> = {
  [K in Extract<keyof T, number> as T[K]['name']]: T[K]
}

export type RpcProtocolInput = {
  server: readonly AnyRpcMethod[],
  client: readonly AnyRpcMethod[],
}

export type RpcProtocol<T extends RpcProtocolInput> = {
  server: RpcMethodDict<T['server']>,
  client: RpcMethodDict<T['client']>
}
