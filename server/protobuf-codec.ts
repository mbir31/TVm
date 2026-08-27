/**
 * TVm Protobuf Wire Codec
 * Implements low-level protobuf serialization & deserialization for Android TV Remote Service v2.
 * Supports Varint encoding/decoding, wire types, length delimiting, and message framing.
 */

import { AndroidKeyCode, KeyDirection } from './types';

export enum WireType {
  VARINT = 0,
  FIXED64 = 1,
  LENGTH_DELIMITED = 2,
  START_GROUP = 3,
  END_GROUP = 4,
  FIXED32 = 5,
}

export class ProtobufWriter {
  private buffer: Buffer;
  private offset: number;

  constructor(initialCapacity = 256) {
    this.buffer = Buffer.alloc(initialCapacity);
    this.offset = 0;
  }

  private ensureCapacity(extraBytes: number) {
    if (this.offset + extraBytes > this.buffer.length) {
      const newCap = Math.max(this.buffer.length * 2, this.offset + extraBytes + 128);
      const next = Buffer.alloc(newCap);
      this.buffer.copy(next, 0, 0, this.offset);
      this.buffer = next;
    }
  }

  public writeVarint(value: number | bigint) {
    let num = typeof value === 'bigint' ? value : BigInt(value);
    // Handle negative numbers (zigzag or 64-bit two's complement)
    if (num < 0n) {
      num = (1n << 64n) + num;
    }
    while (num >= 0x80n) {
      this.ensureCapacity(1);
      this.buffer[this.offset++] = Number(num & 0x7fn) | 0x80;
      num >>= 7n;
    }
    this.ensureCapacity(1);
    this.buffer[this.offset++] = Number(num & 0x7fn);
  }

  public writeTag(fieldNumber: number, wireType: WireType) {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  public writeInt32(fieldNumber: number, value: number) {
    this.writeTag(fieldNumber, WireType.VARINT);
    this.writeVarint(value);
  }

  public writeString(fieldNumber: number, str: string) {
    const strBuf = Buffer.from(str, 'utf-8');
    this.writeTag(fieldNumber, WireType.LENGTH_DELIMITED);
    this.writeVarint(strBuf.length);
    this.ensureCapacity(strBuf.length);
    strBuf.copy(this.buffer, this.offset);
    this.offset += strBuf.length;
  }

  public writeBytes(fieldNumber: number, bytes: Buffer | Uint8Array) {
    const buf = Buffer.from(bytes);
    this.writeTag(fieldNumber, WireType.LENGTH_DELIMITED);
    this.writeVarint(buf.length);
    this.ensureCapacity(buf.length);
    buf.copy(this.buffer, this.offset);
    this.offset += buf.length;
  }

  public writeSubMessage(fieldNumber: number, subWriter: ProtobufWriter) {
    const subBytes = subWriter.toBuffer();
    this.writeTag(fieldNumber, WireType.LENGTH_DELIMITED);
    this.writeVarint(subBytes.length);
    this.ensureCapacity(subBytes.length);
    subBytes.copy(this.buffer, this.offset);
    this.offset += subBytes.length;
  }

  public toBuffer(): Buffer {
    return this.buffer.slice(0, this.offset);
  }

  /**
   * Prepends a varint length header for length-delimited Android TV Remote socket stream framing
   */
  public toFramedPacket(): Buffer {
    const payload = this.toBuffer();
    const lenWriter = new ProtobufWriter(16);
    lenWriter.writeVarint(payload.length);
    return Buffer.concat([lenWriter.toBuffer(), payload]);
  }
}

export interface DecodedField {
  fieldNumber: number;
  wireType: WireType;
  varintValue?: bigint;
  bytesValue?: Buffer;
  stringValue?: string;
}

export class ProtobufReader {
  private buffer: Buffer;
  private offset: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  public getOffset(): number {
    return this.offset;
  }

  public hasMore(): boolean {
    return this.offset < this.buffer.length;
  }

  public static unframePackets(incomingBuffer: Buffer): { packets: Buffer[]; remaining: Buffer } {
    const packets: Buffer[] = [];
    let current = incomingBuffer;

    while (current.length > 0) {
      const reader = new ProtobufReader(current);
      if (!reader.hasMore()) break;

      try {
        const length = Number(reader.readVarint());
        const headerLen = reader.getOffset();

        if (current.length < headerLen + length) {
          // Partial packet, wait for more data
          break;
        }

        const payload = current.slice(headerLen, headerLen + length);
        packets.push(payload);
        current = current.slice(headerLen + length);
      } catch {
        // Incomplete varint, wait for more data
        break;
      }
    }

    return { packets, remaining: current };
  }

  public readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    while (this.offset < this.buffer.length) {
      const b = this.buffer[this.offset++];
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return result;
      }
      shift += 7n;
      if (shift > 64n) {
        throw new Error('Protobuf varint overflow');
      }
    }
    throw new Error('Unexpected end of buffer while reading varint');
  }

  public readFields(): DecodedField[] {
    const fields: DecodedField[] = [];
    while (this.hasMore()) {
      const tag = Number(this.readVarint());
      const wireType = (tag & 0x07) as WireType;
      const fieldNumber = tag >> 3;

      if (wireType === WireType.VARINT) {
        const val = this.readVarint();
        fields.push({ fieldNumber, wireType, varintValue: val });
      } else if (wireType === WireType.LENGTH_DELIMITED) {
        const len = Number(this.readVarint());
        if (this.offset + len > this.buffer.length) {
          break; // Partial packet
        }
        const bytes = this.buffer.slice(this.offset, this.offset + len);
        this.offset += len;
        let stringVal: string | undefined;
        try {
          stringVal = bytes.toString('utf-8');
        } catch {
          stringVal = undefined;
        }
        fields.push({ fieldNumber, wireType, bytesValue: bytes, stringValue: stringVal });
      } else if (wireType === WireType.FIXED32) {
        this.offset += 4;
      } else if (wireType === WireType.FIXED64) {
        this.offset += 8;
      } else {
        // Unknown wire type, skip or stop
        break;
      }
    }
    return fields;
  }
}

/**
 * Android TV Remote v2 Message Builders
 */
export class ATVRemoteV2Messages {
  // ================= PAIRING PROTOCOL (PORT 6467) =================

  public static buildPairingRequest(serviceName = 'TVm', clientName = 'TVm Remote Client'): Buffer {
    const w = new ProtobufWriter();
    w.writeInt32(1, 2); // protocol_version: 2
    w.writeInt32(2, 1); // status: STATUS_OK (1)
    w.writeString(10, serviceName);
    w.writeString(11, clientName);
    return w.toFramedPacket();
  }

  public static buildPairingConfiguration(encodingType = 1, symbolLength = 6): Buffer {
    const w = new ProtobufWriter();
    w.writeInt32(1, 2); // protocol_version: 2
    w.writeInt32(2, 1); // status: STATUS_OK (1)

    const confWriter = new ProtobufWriter();
    confWriter.writeInt32(1, encodingType); // 1 = HEXADECIMAL, 2 = ALPHANUMERIC
    confWriter.writeInt32(2, symbolLength); // 6 digits

    w.writeSubMessage(10, confWriter);
    return w.toFramedPacket();
  }

  public static buildPairingSecret(secretSha256: Buffer): Buffer {
    const w = new ProtobufWriter();
    w.writeInt32(1, 2); // protocol_version: 2
    w.writeInt32(2, 1); // status: STATUS_OK (1)
    w.writeBytes(10, secretSha256);
    return w.toFramedPacket();
  }

  // ================= REMOTE PROTOCOL (PORT 6466) =================

  public static buildRemoteConfigure(deviceModel = 'TVm', clientVersion = '1.0.0'): Buffer {
    const w = new ProtobufWriter();
    const configSub = new ProtobufWriter();
    configSub.writeInt32(1, 622); // code1

    const devInfoSub = new ProtobufWriter();
    devInfoSub.writeString(1, deviceModel);
    devInfoSub.writeString(2, 'TVm Control Center');
    devInfoSub.writeInt32(3, 1);
    devInfoSub.writeString(4, clientVersion);
    devInfoSub.writeString(5, 'com.tvm.remote');
    devInfoSub.writeString(6, 'TVm');

    configSub.writeSubMessage(2, devInfoSub);
    w.writeSubMessage(1, configSub); // Outer field 1: RemoteConfigure
    return w.toFramedPacket();
  }

  public static buildRemoteSetActive(activeCode = 622): Buffer {
    const w = new ProtobufWriter();
    const activeSub = new ProtobufWriter();
    activeSub.writeInt32(1, activeCode);
    w.writeSubMessage(2, activeSub); // Outer field 2: RemoteSetActive
    return w.toFramedPacket();
  }

  public static buildRemoteKeyInject(keyCode: AndroidKeyCode, direction: KeyDirection = KeyDirection.SHORT): Buffer {
    const w = new ProtobufWriter();
    const keySub = new ProtobufWriter();
    keySub.writeInt32(1, keyCode);
    keySub.writeInt32(2, direction);
    w.writeSubMessage(10, keySub); // Outer field 10: RemoteKeyInject
    return w.toFramedPacket();
  }

  public static buildRemoteAdjustVolume(direction: 'UP' | 'DOWN' | 'MUTE'): Buffer {
    const w = new ProtobufWriter();
    const volSub = new ProtobufWriter();
    const dirVal = direction === 'UP' ? 1 : direction === 'DOWN' ? 2 : 3;
    volSub.writeInt32(1, dirVal);
    w.writeSubMessage(11, volSub); // Outer field 11: RemoteAdjustVolume
    return w.toFramedPacket();
  }

  public static buildRemoteImeKeyInject(text: string): Buffer {
    const w = new ProtobufWriter();
    const imeSub = new ProtobufWriter();
    imeSub.writeString(1, text);
    imeSub.writeInt32(2, 0); // start
    imeSub.writeInt32(3, text.length); // end
    w.writeSubMessage(20, imeSub); // Outer field 20: RemoteImeKeyInject
    return w.toFramedPacket();
  }

  public static buildRemoteAppLinkLaunch(deepLinkUrl: string): Buffer {
    const w = new ProtobufWriter();
    const appSub = new ProtobufWriter();
    appSub.writeString(1, deepLinkUrl);
    w.writeSubMessage(26, appSub); // Outer field 26: RemoteAppLinkLaunchRequest
    return w.toFramedPacket();
  }

  public static buildRemotePingRequest(val1 = 1, val2 = 2): Buffer {
    const w = new ProtobufWriter();
    const pingSub = new ProtobufWriter();
    pingSub.writeInt32(1, val1);
    pingSub.writeInt32(2, val2);
    w.writeSubMessage(7, pingSub); // Outer field 7: RemotePingRequest
    return w.toFramedPacket();
  }

  public static buildRemotePingResponse(val1 = 1): Buffer {
    const w = new ProtobufWriter();
    const pingSub = new ProtobufWriter();
    pingSub.writeInt32(1, val1);
    w.writeSubMessage(8, pingSub); // Outer field 8: RemotePingResponse
    return w.toFramedPacket();
  }
}
