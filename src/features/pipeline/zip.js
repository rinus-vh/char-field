// Minimal store-only (no compression) ZIP encoder.
// PNG frames are already compressed, so storing them verbatim is both simplest
// and effectively lossless on size — and avoids any third-party dep.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const encoder = new TextEncoder()

/**
 * Build a ZIP archive from a list of files.
 * @param {{ name: string, data: Uint8Array }[]} files
 * @returns {Blob}
 */
export function createZip(files) {
  const chunks  = []
  const central = []
  let offset    = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const data      = file.data
    const crc       = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0,  0x04034b50, true)   // signature
    local.setUint16(4,  20, true)            // version needed
    local.setUint16(6,  0,  true)            // flags
    local.setUint16(8,  0,  true)            // method 0 = store
    local.setUint16(10, 0,  true)            // mod time
    local.setUint16(12, 0,  true)            // mod date
    local.setUint32(14, crc, true)           // crc32
    local.setUint32(18, data.length, true)   // compressed size
    local.setUint32(22, data.length, true)   // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true)             // extra length

    chunks.push(new Uint8Array(local.buffer), nameBytes, data)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0,  0x02014b50, true)
    cd.setUint16(4,  20, true)
    cd.setUint16(6,  20, true)
    cd.setUint16(8,  0,  true)
    cd.setUint16(10, 0,  true)
    cd.setUint16(12, 0,  true)
    cd.setUint16(14, 0,  true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, data.length, true)
    cd.setUint32(24, data.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint16(30, 0, true)
    cd.setUint16(32, 0, true)
    cd.setUint16(34, 0, true)
    cd.setUint16(36, 0, true)
    cd.setUint32(38, 0, true)
    cd.setUint32(42, offset, true)

    central.push(new Uint8Array(cd.buffer), nameBytes)

    offset += 30 + nameBytes.length + data.length
  }

  const centralSize   = central.reduce((sum, c) => sum + c.length, 0)
  const centralOffset = offset

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0,  0x06054b50, true)
  end.setUint16(4,  0, true)
  end.setUint16(6,  0, true)
  end.setUint16(8,  files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, centralOffset, true)
  end.setUint16(20, 0, true)

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' })
}
