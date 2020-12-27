import { Any } from 'loi';

export const rpcMethodBrand = Symbol.for("@orz/rpc/rpcMethodBrand")

export type RpcMethod<Arguments extends Any[], Return extends Any> = { [rpcMethodBrand]: true, arguments: Arguments, return: Return }
export type AnyRpcMethod = RpcMethod<any, any>

export function rpcMethod<
  Arguments extends Any[],
  Return extends Any
>(returnType: Return, ...args: Arguments): RpcMethod<Arguments, Return> {
  return { [rpcMethodBrand]: true, return: returnType, arguments: args }
}

export type RpcMethods = {
  [K: string]: AnyRpcMethod | RpcMethods
}

export function isRpcMethod(t: any): t is AnyRpcMethod {
  return t && rpcMethodBrand in t && t[rpcMethodBrand] === true;
}

export function getFlattenRpcMethods(methods: RpcMethods, prefix: string = "") {
  const result: Record<string, AnyRpcMethod> = Object.create(null);
  for (const [key, value] of Object.entries(methods)) {
    const fullKey = `${prefix}${key}`
    if (isRpcMethod(value)) {
      result[`${fullKey}`] = value;
    } else {
      Object.assign(result, getFlattenRpcMethods(value, `${fullKey}.`))
    }
  }
  return result;
}

export function rpcProtocol<T extends RpcProtocolInput>(i: T): T & RpcProtocolMeta {
  return {
    ...i,
    flattenServer: getFlattenRpcMethods(i.server),
    flattenClient: getFlattenRpcMethods(i.client),
  }
}

export type RpcProtocolInput = {
  server: RpcMethods,
  client: RpcMethods,
}

export type RpcProtocolMeta = {
  flattenServer: Record<string, AnyRpcMethod>,
  flattenClient: Record<string, AnyRpcMethod>,
}

export type RpcProtocol = RpcProtocolInput & RpcProtocolMeta
