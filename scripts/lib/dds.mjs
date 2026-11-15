// Décodage des textures DDS (compressées zstd) fournies par Path of Building PoE2.
// Gère les tableaux de textures DX10 (plusieurs images dans un fichier) en BC1 / BC7 / RGBA.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodeBC1, decodeBC7 } from 'tex-decoder';

const DXGI = {
  71: 'BC1', 72: 'BC1',
  98: 'BC7', 99: 'BC7',
  28: 'RGBA', 29: 'RGBA',
  87: 'BGRA', 91: 'BGRA',
};

export function readDds(file) {
  let buf = fs.readFileSync(file);
  if (file.endsWith('.zst')) buf = zlib.zstdDecompressSync(buf);
  if (buf.toString('ascii', 0, 4) !== 'DDS ') throw new Error(`Pas un fichier DDS : ${file}`);
  const u32 = (o) => buf.readUInt32LE(o);
  const height = u32(12);
  const width = u32(16);
  const mips = Math.max(1, u32(28));
  const fourCC = buf.toString('ascii', 84, 88);
  let format, arraySize = 1, dataOffset = 128;
  if (fourCC === 'DX10') {
    format = DXGI[u32(128)];
    arraySize = Math.max(1, u32(140));
    dataOffset = 148;
  } else if (fourCC === 'DXT1') {
    format = 'BC1';
  } else {
    throw new Error(`Format DDS non géré (${fourCC}) : ${file}`);
  }
  if (!format) throw new Error(`Format DXGI non géré (${u32(128)}) : ${file}`);
  return { buf, width, height, mips, format, arraySize, dataOffset };
}

function levelSize(format, w, h) {
  if (format === 'BC1') return Math.ceil(w / 4) * Math.ceil(h / 4) * 8;
  if (format === 'BC7') return Math.ceil(w / 4) * Math.ceil(h / 4) * 16;
  return w * h * 4;
}

/** Retourne les pixels RGBA (mip 0) de la couche `layer` (0-based). */
export function decodeLayer(dds, layer) {
  const { buf, width, height, mips, format, dataOffset } = dds;
  let layerBytes = 0;
  for (let m = 0; m < mips; m++) {
    layerBytes += levelSize(format, Math.max(1, width >> m), Math.max(1, height >> m));
  }
  const start = dataOffset + layer * layerBytes;
  const size = levelSize(format, width, height);
  const src = buf.subarray(start, start + size);
  if (src.length < size) throw new Error(`Couche ${layer} hors limites`);
  if (format === 'BC1') return Buffer.from(decodeBC1(src, width, height));
  if (format === 'BC7') return Buffer.from(decodeBC7(src, width, height));
  if (format === 'RGBA') return Buffer.from(src);
  if (format === 'BGRA') {
    const out = Buffer.from(src);
    for (let i = 0; i < out.length; i += 4) {
      const b = out[i];
      out[i] = out[i + 2];
      out[i + 2] = b;
    }
    return out;
  }
  throw new Error(`Format ${format} non géré`);
}
