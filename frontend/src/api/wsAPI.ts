import { reactive, Reactive, readonly } from 'vue';

export interface WSAPIPackets {
  // #region t_client
  0x0000: {
    type: 'client';
    name: 'cWorldStop';
    data: undefined;
  }
  0x0001: {
    type: 'client';
    name: 'cWorldStart';
    data: undefined;
  }
  0x0002: {
    type: 'client';
    name: 'cWorldChange';
    data: {
      /** u8 flags */
      flag: number;
      /** u16,u16 */
      points: Array<[x: number, y: number]>;
    };
  }

  // #region t_server
  0x8000: {
    type: 'server';
    name: 'sWorldStop';
    data: undefined;
  }
  0x8001: {
    type: 'server';
    name: 'sWorldStart';
    data: undefined;
  }
  0x8002: {
    type: 'server';
    name: 'sWorldChange';
    data: {
      /** u64 */
      epoch: bigint;
      /** u8 flags */
      flag: number;
      /** u16,u16 */
      points: Array<[x: number, y: number]>;
    };
  }
  0x88ff: {
    type: 'server';
    name: 'sError';
    data: {
      msg: string;
    };
  }
}

// #region register/get
// type Merged<T, T2> = T extends infer Z ? Z extends T2 ? Z : never : never;
// type KeyOfValueInObject<Obj, Value> = keyof Obj extends infer _Key ? _Key extends keyof Obj ? Obj[_Key] extends Value ? _Key : never : never : never;

type KeyOfValueInObject<Obj, Value> = {
  [Key in keyof Obj]: Obj[Key] extends Value ? Key : never;
}[keyof Obj];

type _WSAPIHandlersMapT<PType extends keyof WSAPIPackets = keyof WSAPIPackets> = {
  ptype: PType;
  pname: WSAPIPackets[PType]['name'];
  decode(data: ArrayBuffer): WSAPIPackets[PType]['data'];
  encode(data: WSAPIPackets[PType]['data']): ArrayBuffer;
};

type WSAPIData<Type extends Parameters<typeof getPacketHandlers>[0]> = ReturnType<NonNullable<ReturnType<typeof getPacketHandlers<Type>>>['decode']>

const wsApiTypesHandlers = new Map<string | number, _WSAPIHandlersMapT>();

function registerPacket<
  PType extends keyof WSAPIPackets
>(
  ptype: PType,
  pname: WSAPIPackets[PType]['name'],
  decode: (data: ArrayBuffer) => WSAPIPackets[PType]['data'],
  encode: (data: WSAPIPackets[PType]['data']) => ArrayBuffer,
) {
  if (wsApiTypesHandlers.has(ptype)) {
    console.warn(`Handlers for ptype=0x${ptype.toString(16).padStart(4, '0')}, pname=${pname} already set! Overwriting`);
  }
  const o: _WSAPIHandlersMapT = {
    pname,
    ptype,
    decode,
    encode,
  };
  wsApiTypesHandlers.set(ptype, o);
  wsApiTypesHandlers.set(pname, o);
}

function getPacketHandlers<
  P extends (keyof WSAPIPackets | WSAPIPackets[keyof WSAPIPackets]['name']),
  R = P extends number ? _WSAPIHandlersMapT<P> : _WSAPIHandlersMapT<KeyOfValueInObject<WSAPIPackets, { name: P }>>,
>(pTypeOrName: P): R | undefined {
  const result = wsApiTypesHandlers.get(pTypeOrName) as R | undefined;
  return result;
}

function getWsConnectionStateString(socket?: WebSocket) {
  if (!socket) return 'unknown';
  if (socket.readyState === WebSocket.OPEN) {
    return 'open';
  } else if (socket.readyState === WebSocket.CONNECTING) {
    return 'connecting';
  } else if (socket.readyState === WebSocket.CLOSING) {
    return 'closing';
  } else if (socket.readyState === WebSocket.CLOSED) {
    return 'closed';
  }
  return 'unknown';
}


// #region ws api
export class WebSocketAPI {
  private socket: WebSocket | undefined;
  private baseURL: string;
  private _connectionState: Reactive<{
    state: 'closed' | 'connecting' | 'closing' | 'open' | 'unknown';
  }> = reactive({
    state: 'unknown',
  });
  public readonly connectionState = readonly(this._connectionState);

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private onMessage(event: MessageEvent<ArrayBuffer | Blob | string>) {
    if (event.data instanceof ArrayBuffer) {
      this.processServerMessage(event.data);
    } else {
      console.warn('Unexpect data type:', event.data);
    }
  }
  private onError(event: Event) {
    // TODO
    console.error(event);
  }
  private onOpen(_event: Event) {
    this._connectionState.state = getWsConnectionStateString(this.socket);
  }
  private onClose(_event: CloseEvent) {
    this._connectionState.state = getWsConnectionStateString(this.socket);
  }

  connect(worldId: number | string) {
    this.socket = new WebSocket(`${this.baseURL}/${worldId}`);
    this.socket.binaryType = 'arraybuffer';
    this._connectionState.state = getWsConnectionStateString(this.socket);
    const messageBind = this.onMessage.bind(this);
    const errorBind = this.onError.bind(this);
    const openBind = this.onOpen.bind(this);
    const closeBind = (ev: CloseEvent) => {
      this.onClose(ev);
      this.socket?.removeEventListener('message', messageBind);
      this.socket?.removeEventListener('error', errorBind);
      this.socket?.removeEventListener('open', openBind);
      this.socket?.removeEventListener('close', closeBind);
    };
    this.socket.addEventListener('message', messageBind);
    this.socket.addEventListener('error', errorBind);
    this.socket.addEventListener('close', closeBind);
    this.socket.addEventListener('open', openBind);
  }
  disconnect() {
    this.socket?.close();
  }

  sendRawMessage(data: ArrayBuffer) {
    this.socket?.send(data);
  }

  sendMessage<Type extends Parameters<typeof getPacketHandlers>[0]>(
    type: Type,
    data: WSAPIData<Type>,
  ) {
    const packet: _WSAPIHandlersMapT | undefined = getPacketHandlers(type);
    if (!packet) throw new TypeError(`Packet encoder for ptype/pname=${type} not found!`);
    const buffer = packet.encode(data as any);
    this.sendRawMessage(buffer);
  }

  processServerMessage(data: ArrayBuffer) {
    const view = new DataView(data);
    const ptype = view.getUint16(0, true);
    const packet = getPacketHandlers(ptype as Parameters<typeof getPacketHandlers>[0]);
    if (!packet) {
      console.error(`Received unknown packet with ptype=${ptype.toString(16).padStart(4, '0')} from server!`);
      return;
    }
    const parsed = packet.decode(data);
    this.emit(packet.pname, parsed as any);
  }
  
  
  // #region events


  private events: Record<string, Array<(...args: any[]) => void>> = {};

  // event-emitter
  on<Type extends Exclude<Parameters<typeof getPacketHandlers>[0], number>>(
    type: Type,
    cb: (data: WSAPIData<Type>) => void,
    once = false,
  ) {
    if (!this.events[type]) this.events[type] = [];
    let fn = cb;
    if (once) {
      fn = (...args) => {
        cb(...args);
        this.events[type].splice(this.events[type].indexOf(fn), 1);
      }
      (fn as any).__original__ = cb;
    }
    this.events[type].push(fn);
  }

  off<Type extends Exclude<Parameters<typeof getPacketHandlers>[0], number>>(
    type: Type,
    cb: (data: WSAPIData<Type>) => void,
    once = false,
  ) {
    if (!this.events[type]) return;
    let index = -1;
    for (let i = 0; i < this.events[type].length; i++) {
      if (
        (!once && this.events[type][i] === cb) ||
        (once && (this.events[type][i] as any).__original__ === cb)
      ) {
        index = i;
        break;
      }
    }
    if (index >= 0) this.events[type].splice(index, 1);
  }

  private emit<Type extends Exclude<Parameters<typeof getPacketHandlers>[0], number>>(
    type: Type,
    data: WSAPIData<Type>,
  ) {
    if (!this.events[type]) return;
    for (const fn of this.events[type]) {
      try {
        fn(data);
      } catch(e) {
        console.warn(`Error during processing ${type} event:`, e);
      }
    }
  }

  waitFor<Type extends Exclude<Parameters<typeof getPacketHandlers>[0], number>>(
    type: Type,
  ): Promise<WSAPIData<Type>> {
    return new Promise((resolve, _reject) => {
      // TODO: pass errors to reject
      this.on(type, resolve, true);
    });
  }
}


// #region packets ser/de


function encodePacket_empty(ptype: number) {
  return () => Uint16Array.from([ptype]).buffer;
}


// #region 0x8002


function decodePacket_8002(packet: ArrayBuffer): WSAPIPackets[0x8002]['data'] {
  const view = new DataView(packet);
  const pointsView = new Uint32Array(packet.slice(2+8+1));
  const result = {
    epoch: view.getBigUint64(2, true),
    flag: view.getUint8(2+8),
    points: [] as Array<[x: number, y: number]>,
  };

  for (let i = 0; i < pointsView.length; i += 2) {
    result.points.push([pointsView[i], pointsView[i + 1]]);
  }

  return result;
}

function encodePacket_8002(data: WSAPIPackets[0x8002]['data']) {
  const points = data.points.length;
  const buf = new ArrayBuffer(2 + 8 + 1 + points * 8);
  const p = new DataView(buf);

  let ptr = 0;
  // type
  p.setUint16(ptr, 0x8002, true); ptr += 2;
  // epoch
  p.setBigUint64(ptr, data.epoch, true); ptr += 8;
  // flag
  p.setUint8(ptr, 0x00); ptr += 1;

  // points
  for (let i = 0; i < points; i++) {
    p.setUint32(ptr, data.points[i][0], true); ptr += 4;
    p.setUint32(ptr, data.points[i][1], true); ptr += 4;
  }

  return buf;
}


// #region 0x0002


function decodePacket_0002(packet: ArrayBuffer): WSAPIPackets[0x0002]['data'] {
  const view = new DataView(packet);
  const pointsView = new Uint32Array(packet.slice(2 + 1));
  const result = {
    flag: view.getUint8(2),
    points: [] as Array<[x: number, y: number]>,
  };

  for (let i = 0; i < pointsView.length; i += 2) {
    result.points.push([pointsView[i], pointsView[i + 1]]);
  }

  return result;
}

function encodePacket_0002(data: WSAPIPackets[0x0002]['data']) {
  const points = data.points.length;
  const buf = new ArrayBuffer(2 + 1 + points * 8);
  const p = new DataView(buf);

  let ptr = 0;
  // type
  p.setUint16(ptr, 0x0002, true); ptr += 2;
  // flag
  p.setUint8(ptr, 0x00); ptr += 1;

  // points
  for (let i = 0; i < points; i++) {
    p.setUint32(ptr, data.points[i][0], true); ptr += 4;
    p.setUint32(ptr, data.points[i][1], true); ptr += 4;
  }

  return buf;
}


// #region 0x88ff


function decodePacket_88ff(packet: ArrayBuffer) {
  const result = {
    // type: 'ServerError' as const,
    msg: '',
  };
  const decoder = new TextDecoder();
  result.msg = decoder.decode(packet);
  return result;
}

function encodePacket_88ff(data: WSAPIPackets[0x88ff]['data']) {
  const encoder = new TextEncoder();
  const textBuffer = encoder.encode(data.msg);
  const buf = new Uint8Array(2 + textBuffer.length);
  buf.set([0x88, 0xff], 0);
  buf.set(textBuffer, 2);
  return buf.buffer;
}


// #region register


registerPacket(0x0000, 'cWorldStop', () => undefined, encodePacket_empty(0x0000));
registerPacket(0x0001, 'cWorldStart', () => undefined, encodePacket_empty(0x0001));
registerPacket(0x8000, 'sWorldStop', () => undefined, encodePacket_empty(0x8000));
registerPacket(0x8001, 'sWorldStart', () => undefined, encodePacket_empty(0x8001));
registerPacket(0x0002, 'cWorldChange', decodePacket_0002, encodePacket_0002);
registerPacket(0x8002, 'sWorldChange', decodePacket_8002, encodePacket_8002);
registerPacket(0x88ff, 'sError', decodePacket_88ff, encodePacket_88ff);