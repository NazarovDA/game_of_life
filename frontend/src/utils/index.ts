/** @deprecated in favour of WS API */
export function _generateWorldPacketFromServer(maxPoints = 1000, w = 1000, h = 1000, epoch = 0n): ArrayBuffer {
  const points = Math.floor(Math.random() * maxPoints);
  const buf = new ArrayBuffer(2 + 8 + 1 + points * 8);
  const p = new DataView(buf);

  let ptr = 0;
  // type
  p.setUint16(ptr, 0x8002, true); ptr += 2;
  // epoch
  p.setBigUint64(ptr, epoch, true); ptr += 8;
  // flag
  p.setUint8(ptr, 0x00); ptr += 1;

  // points
  for (let i = 0; i < points; i++) {
    const x = Math.floor(Math.random() * w);
    const y = Math.floor(Math.random() * h);
    p.setUint32(ptr, x, true); ptr += 4;
    p.setUint32(ptr, y, true); ptr += 4;
  }

  return buf;
}

/** @deprecated in favour of WS API */
export function parsePacket(packet: ArrayBuffer) {
  const dataView = new DataView(packet);
  const type = dataView.getUint16(0, true);
  switch (type) {
    case 0x8000: return { type: 'ServerWorldStopped' as const };
    case 0x8001: return { type: 'ServerWorldStarted' as const };
    case 0x8002: return parsePacket_8002(packet.slice(2));
    case 0x88ff: return parsePacket_88ff(packet.slice(2));
    default: {
      console.warn('Unexpect packet type');
      return null;
    }
  }
}

/** @deprecated in favour of WS API */
export function parsePacket_8002(packet: ArrayBuffer) {
  const view = new DataView(packet);
  const pointsView = new Uint32Array(packet.slice(9));
  const result = {
    type: 'ServerWorldState' as const,
    epoch: view.getBigUint64(0, true),
    flag: view.getUint8(8),
    points: [] as Array<[x: number, y: number]>,
  };

  for (let i = 0; i < pointsView.length; i += 2) {
    result.points.push([pointsView[i], pointsView[i + 1]]);
  }

  return result;
}

/** @deprecated in favour of WS API */
export function parsePacket_88ff(packet: ArrayBuffer) {
  const result = {
    type: 'ServerError' as const,
    message: '',
  };
  const decoder = new TextDecoder();
  result.message = decoder.decode(packet);
  return result;
}
