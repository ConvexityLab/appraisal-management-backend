/**
 * Image Processing Utility
 * Wraps sharp to provide inspection-photo intelligence:
 *   - Auto-rotation from EXIF orientation
 *   - Thumbnail generation (gallery 400×300, small 120×120)
 *   - EXIF metadata extraction (GPS, timestamp, camera)
 *   - Resolution validation
 *   - HEIC → JPEG conversion
 *   - Perceptual (average) hashing for duplicate detection
 *   - Dominant colour extraction
 *   - Quality scoring (0–100)
 */

import sharp from 'sharp';
import type { PhotoExifData } from '../types/photo.types.js';

/** Minimum acceptable resolution for inspection photos */
const MIN_WIDTH_PX = 800;
const MIN_HEIGHT_PX = 600;

export interface ProcessedPhoto {
  /** Auto-rotated, possibly HEIC-converted image buffer (JPEG) */
  buffer: Buffer;
  mimeType: 'image/jpeg';
  /** Width after rotation */
  width: number;
  /** Height after rotation */
  height: number;
  format: string;
  /** Original format before any conversion */
  originalFormat: string;
  isAutoRotated: boolean;
  exifData: PhotoExifData;
  /** 16-char hex average hash */
  pHash: string;
  /** Dominant colour hex strings */
  dominantColors: string[];
  /** 0–100 quality score */
  qualityScore: number;
}

export interface ThumbnailResult {
  /** 400×300 gallery thumbnail */
  gallery: Buffer;
  /** 120×120 small thumbnail */
  small: Buffer;
  mimeType: 'image/jpeg';
}

export class ImageResolutionError extends Error {
  constructor(public readonly width: number, public readonly height: number) {
    super(
      `Image resolution ${width}×${height} is below the minimum required ${MIN_WIDTH_PX}×${MIN_HEIGHT_PX}. ` +
        `Please upload a higher-resolution photo.`
    );
    this.name = 'ImageResolutionError';
  }
}

/**
 * Fully process an uploaded photo buffer.
 * Throws ImageResolutionError if the photo is too small.
 */
export async function processUploadedPhoto(
  inputBuffer: Buffer,
  originalMimeType: string
): Promise<ProcessedPhoto> {
  // Load image — auto-rotate based on EXIF orientation, convert HEIC to JPEG
  const image = sharp(inputBuffer, { failOn: 'none' })
    .rotate() // reads EXIF orientation and rotates accordingly, strips orientation tag
    .toFormat('jpeg', { quality: 90, mozjpeg: true });

  // Read metadata BEFORE rotation (on the original buffer) so we get raw orientation
  const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
  const originalFormat = meta.format ?? 'unknown';
  const originalOrientation = meta.orientation ?? 1;
  const isAutoRotated = originalOrientation !== 1 && originalOrientation !== undefined;

  // Convert to JPEG buffer
  const { data: processedBuffer, info } = await image.toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  // Resolution gate
  if (width < MIN_WIDTH_PX || height < MIN_HEIGHT_PX) {
    throw new ImageResolutionError(width, height);
  }

  // Extract EXIF data from original buffer (before rotation strips it)
  const exifData = extractExifData(meta.exif ?? null, meta);

  // Perceptual hash and dominant colours on the processed image
  const [pHash, dominantColors] = await Promise.all([
    computeAverageHash(processedBuffer),
    extractDominantColors(processedBuffer)
  ]);

  const qualityScore = computeQualityScore(width, height, processedBuffer.length);

  return {
    buffer: processedBuffer,
    mimeType: 'image/jpeg',
    width,
    height,
    format: 'jpeg',
    originalFormat,
    isAutoRotated,
    exifData,
    pHash,
    dominantColors,
    qualityScore
  };
}

/**
 * Generate gallery (400×300) and small (120×120) thumbnails.
 * Input buffer should already be the processed (rotated) JPEG.
 */
export async function generateThumbnails(processedBuffer: Buffer): Promise<ThumbnailResult> {
  const [gallery, small] = await Promise.all([
    sharp(processedBuffer)
      .resize(400, 300, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80 })
      .toBuffer(),
    sharp(processedBuffer)
      .resize(120, 120, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 75 })
      .toBuffer()
  ]);

  return { gallery, small, mimeType: 'image/jpeg' };
}

// ---------------------------------------------------------------------------
// EXIF parsing (minimal GPS + timestamp reader using raw TIFF buffer)
// ---------------------------------------------------------------------------

/**
 * Parse GPS coordinates, timestamp, and camera info from a raw EXIF buffer.
 * Falls back to empty object if parsing fails or data is absent.
 */
function extractExifData(
  exifBuffer: Buffer | null,
  sharpMeta: sharp.Metadata
): PhotoExifData {
  const result: PhotoExifData = {};
  if (sharpMeta.width !== undefined) result.originalWidth = sharpMeta.width;
  if (sharpMeta.height !== undefined) result.originalHeight = sharpMeta.height;
  if (sharpMeta.orientation !== undefined) result.orientation = sharpMeta.orientation;

  if (!exifBuffer || exifBuffer.length < 14) {
    return result;
  }

  try {
    // Some sharp versions return the buffer starting with "Exif\0\0"; others strip the header
    let tiffStart = 0;
    if (exifBuffer.length >= 6 && exifBuffer.toString('ascii', 0, 4) === 'Exif') {
      tiffStart = 6;
    }

    const byteOrderMark = exifBuffer.toString('ascii', tiffStart, tiffStart + 2);
    const isLE = byteOrderMark === 'II';

    const readU16 = (off: number) =>
      isLE
        ? exifBuffer.readUInt16LE(tiffStart + off)
        : exifBuffer.readUInt16BE(tiffStart + off);

    const readU32 = (off: number) =>
      isLE
        ? exifBuffer.readUInt32LE(tiffStart + off)
        : exifBuffer.readUInt32BE(tiffStart + off);

    // Verify TIFF magic number (42)
    if (readU16(2) !== 42) return result;

    const ifd0Offset = readU32(4);

    // Parse an IFD at the given TIFF-relative offset
    const readIFD = (ifdOffset: number): Map<number, { type: number; count: number; rawValOff: number }> => {
      const entries = new Map<number, { type: number; count: number; rawValOff: number }>();
      if (ifdOffset < 0 || tiffStart + ifdOffset + 2 > exifBuffer.length) return entries;

      const entryCount = readU16(ifdOffset);
      for (let i = 0; i < entryCount; i++) {
        const entryOff = ifdOffset + 2 + i * 12;
        if (tiffStart + entryOff + 12 > exifBuffer.length) break;

        const tag = readU16(entryOff);
        const type = readU16(entryOff + 2);
        const count = readU32(entryOff + 4);
        const rawValOff = entryOff + 8; // TIFF-relative offset to the 4-byte value/offset field
        entries.set(tag, { type, count, rawValOff });
      }
      return entries;
    };

    // Type sizes in bytes: BYTE=1, ASCII=1, SHORT=2, LONG=4, RATIONAL=8
    const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

    /**
     * Returns the TIFF-relative byte offset where an entry's data lives.
     * For inline values (≤ 4 total bytes), that IS rawValOff.
     * For non-inline, it's the uint32 stored at rawValOff.
     */
    const getDataOffset = (entry: { type: number; count: number; rawValOff: number }): number => {
      const totalSize = (TYPE_SIZES[entry.type] ?? 1) * entry.count;
      return totalSize <= 4 ? entry.rawValOff : readU32(entry.rawValOff);
    };

    const readRational = (tiffRelOff: number): number => {
      const num = readU32(tiffRelOff);
      const den = readU32(tiffRelOff + 4);
      return den === 0 ? 0 : num / den;
    };

    const readAscii = (tiffRelOff: number, count: number): string =>
      exifBuffer
        .toString('ascii', tiffStart + tiffRelOff, tiffStart + tiffRelOff + Math.max(0, count - 1))
        .replace(/\0/g, '')
        .trim();

    const ifd0 = readIFD(ifd0Offset);

    // Camera Make (0x010F) and Model (0x0110)
    const makeEntry = ifd0.get(0x010f);
    if (makeEntry) result.cameraMake = readAscii(getDataOffset(makeEntry), makeEntry.count);

    const modelEntry = ifd0.get(0x0110);
    if (modelEntry) result.cameraModel = readAscii(getDataOffset(modelEntry), modelEntry.count);

    // ExifIFD pointer (0x8769) — contains DateTimeOriginal
    const exifIFDEntry = ifd0.get(0x8769);
    if (exifIFDEntry) {
      const exifIFDOffset = readU32(exifIFDEntry.rawValOff); // LONG → inline, value IS the offset
      const exifIFD = readIFD(exifIFDOffset);

      const dtoEntry = exifIFD.get(0x9003); // DateTimeOriginal
      if (dtoEntry) {
        const dtOff = getDataOffset(dtoEntry);
        const dtStr = exifBuffer.toString('ascii', tiffStart + dtOff, tiffStart + dtOff + 19);
        // "YYYY:MM:DD HH:MM:SS" → ISO 8601
        result.dateTaken = dtStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      }
    }

    // GPS IFD pointer (0x8825)
    const gpsIFDEntry = ifd0.get(0x8825);
    if (gpsIFDEntry) {
      const gpsIFDOffset = readU32(gpsIFDEntry.rawValOff); // LONG → inline
      const gpsIFD = readIFD(gpsIFDOffset);

      // GPSLatitudeRef (0x0001) + GPSLatitude (0x0002)
      const latEntry = gpsIFD.get(0x0002);
      if (latEntry) {
        const latOff = getDataOffset(latEntry); // non-inline RATIONAL×3
        const deg = readRational(latOff);
        const min = readRational(latOff + 8);
        const sec = readRational(latOff + 16);
        let lat = deg + min / 60 + sec / 3600;

        const latRefEntry = gpsIFD.get(0x0001);
        if (latRefEntry) {
          const refOff = getDataOffset(latRefEntry);
          const ref = exifBuffer.toString('ascii', tiffStart + refOff, tiffStart + refOff + 1);
          if (ref === 'S') lat = -lat;
        }
        result.gpsLatitude = lat;
      }

      // GPSLongitudeRef (0x0003) + GPSLongitude (0x0004)
      const lonEntry = gpsIFD.get(0x0004);
      if (lonEntry) {
        const lonOff = getDataOffset(lonEntry);
        const deg = readRational(lonOff);
        const min = readRational(lonOff + 8);
        const sec = readRational(lonOff + 16);
        let lon = deg + min / 60 + sec / 3600;

        const lonRefEntry = gpsIFD.get(0x0003);
        if (lonRefEntry) {
          const refOff = getDataOffset(lonRefEntry);
          const ref = exifBuffer.toString('ascii', tiffStart + refOff, tiffStart + refOff + 1);
          if (ref === 'W') lon = -lon;
        }
        result.gpsLongitude = lon;
      }

      // GPSAltitude (0x0006)
      const altEntry = gpsIFD.get(0x0006);
      if (altEntry) {
        const altOff = getDataOffset(altEntry);
        let alt = readRational(altOff);

        const altRefEntry = gpsIFD.get(0x0005);
        if (altRefEntry) {
          const refOff = getDataOffset(altRefEntry);
          const ref = exifBuffer[tiffStart + refOff];
          if (ref === 1) alt = -alt; // below sea level
        }
        result.gpsAltitude = alt;
      }
    }
  } catch {
    // Non-fatal: return what we have so far
  }

  return result;
}

// ---------------------------------------------------------------------------
// Perceptual hashing (average hash — 64-bit)
// ---------------------------------------------------------------------------

/**
 * Compute a 16-char hex average hash.
 * Resize to 8×8 grayscale, threshold each pixel against the mean.
 */
async function computeAverageHash(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const mean = pixels.reduce((sum, p) => sum + p, 0) / 64;

  let hi = 0;
  let lo = 0;
  for (let i = 0; i < 64; i++) {
    const bit = (pixels[i] ?? 0) > mean ? 1 : 0;
    if (i < 32) {
      hi = (hi * 2 + bit) >>> 0;
    } else {
      lo = (lo * 2 + bit) >>> 0;
    }
  }

  return (hi >>> 0).toString(16).padStart(8, '0') + (lo >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hamming distance between two 16-char hex hashes (0 = identical).
 */
export function pHashDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64;
  let distance = 0;
  for (let i = 0; i < hash1.length; i += 8) {
    const a = parseInt(hash1.substring(i, i + 8), 16);
    const b = parseInt(hash2.substring(i, i + 8), 16);
    let xor = (a ^ b) >>> 0;
    while (xor) {
      distance += xor & 1;
      xor >>>= 1;
    }
  }
  return distance;
}

/** Threshold for considering two photos duplicates (Hamming ≤ 10 out of 64 bits) */
export const DUPLICATE_HASH_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Dominant colours
// ---------------------------------------------------------------------------

/**
 * Return the average colour as a single CSS hex string.
 * Good-enough proxy for dominant colour without k-means clustering.
 */
async function extractDominantColors(buffer: Buffer): Promise<string[]> {
  const stats = await sharp(buffer).stats();
  const toHex = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v)))
      .toString(16)
      .padStart(2, '0');

  const r = stats.channels[0]?.mean ?? 0;
  const g = stats.channels[1]?.mean ?? 0;
  const b = stats.channels[2]?.mean ?? 0;
  return [`#${toHex(r)}${toHex(g)}${toHex(b)}`];
}

// ---------------------------------------------------------------------------
// Quality score
// ---------------------------------------------------------------------------

/**
 * Compute a 0–100 quality score.
 *  70 % resolution component: normalized against 1920×1080 target
 *  30 % file-size component: normalized against 2 MB target
 */
function computeQualityScore(width: number, height: number, fileSizeBytes: number): number {
  const TARGET_PIXELS = 1920 * 1080;
  const TARGET_SIZE = 2 * 1024 * 1024; // 2 MB

  const resScore = Math.min(100, ((width * height) / TARGET_PIXELS) * 100);
  const sizeScore = Math.min(100, (fileSizeBytes / TARGET_SIZE) * 100);

  return Math.round(resScore * 0.7 + sizeScore * 0.3);
}

// ---------------------------------------------------------------------------
// Geo-verification
// ---------------------------------------------------------------------------

/**
 * Haversine distance in metres between two WGS-84 coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Maximum distance (metres) from property to be considered geo-verified */
export const GEO_VERIFY_THRESHOLD_METERS = 500;
