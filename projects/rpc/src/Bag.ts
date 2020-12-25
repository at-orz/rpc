import { createCodec, decode as msgpackDecode, encode as msgpackEncode } from 'msgpack-lite';

export namespace Bag {
  export const codec = createCodec({
    uint8array: true,
    int64: false,
  })
  codec.addExtPacker(0x12, Uint8Array, (t) => t);
  codec.addExtUnpacker(0x12, (t) => Uint8Array.from(t));

  export function encode<T>(value: T): Uint8Array {
    return msgpackEncode(value, { codec });
  }

  export function decode<T>(value: Uint8Array): T {
    return msgpackDecode(value, { codec });
  }

  export function deepClone<T>(value: T): T {
    return decode(encode(value));
  }
}
