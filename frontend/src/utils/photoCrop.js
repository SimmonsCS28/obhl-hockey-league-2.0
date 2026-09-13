/**
 * Client side of the profile-photo pipeline.
 *
 * The server re-encodes every upload to a 512×512 JPEG (ProfilePhotoProcessor), but it
 * uses javax.imageio, which ignores the EXIF orientation tag and cannot read HEIC/WebP.
 * So the browser does two things first:
 *   1. decodes the file with `imageOrientation: 'from-image'`, which bakes a phone's
 *      rotation into the pixels, and lets the user pick a HEIC/WebP the server would refuse;
 *   2. applies the square crop the user positioned by dragging, and exports ONE JPEG.
 * The server still validates and re-crops whatever arrives — this is a courtesy pass,
 * not the trust boundary.
 */

export const OUTPUT_SIZE = 512;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const ERR_TYPE = 'JPG or PNG only.';
export const ERR_SIZE = 'Keep it under 5 MB.';
export const ERR_DECODE = "That file doesn't look like an image.";

/** Cheap checks before decoding. Returns an error string, or null when the file looks usable. */
export function precheckPhoto(file) {
    if (!file) return ERR_DECODE;
    const type = (file.type || '').toLowerCase();
    // Some browsers send an empty type for HEIC; let the decoder be the judge in that case.
    if (type && !ACCEPTED_TYPES.includes(type)) return ERR_TYPE;
    if (file.size > MAX_UPLOAD_BYTES) return ERR_SIZE;
    return null;
}

/**
 * Decodes a File into something drawImage() accepts, orientation applied.
 * Resolves to { source, width, height, release() } or rejects with ERR_DECODE.
 */
export async function decodePhoto(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
        } catch {
            // fall through to the <img> path (older Safari rejects the options bag)
        }
    }
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({
            source: img,
            width: img.naturalWidth,
            height: img.naturalHeight,
            release: () => URL.revokeObjectURL(url)
        });
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(ERR_DECODE)); };
        img.src = url;
    });
}

/**
 * Geometry for the drag-to-reposition preview: the decoded image scaled so its SHORT side
 * fills a `frame`px square, plus the offset bounds the crop window may move within.
 */
export function previewGeometry(width, height, frame) {
    const scale = frame / Math.min(width, height);
    const w = width * scale;
    const h = height * scale;
    return {
        scale,
        width: w,
        height: h,
        // offsets are the image's top-left relative to the frame, so they are ≤ 0
        minX: frame - w,
        minY: frame - h,
        // centred start
        startX: (frame - w) / 2,
        startY: (frame - h) / 2
    };
}

export function clampOffset(value, min) {
    return Math.min(0, Math.max(min, value));
}

/**
 * Renders the framed square (offset expressed in preview pixels, as previewGeometry
 * defines it) to an OUTPUT_SIZE×OUTPUT_SIZE JPEG Blob.
 */
export async function cropToBlob(decoded, geometry, offsetX, offsetY, frame) {
    const sx = -offsetX / geometry.scale;
    const sy = -offsetY / geometry.scale;
    const side = frame / geometry.scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // transparent PNG corners become white, matching the server
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error(ERR_DECODE))),
            'image/jpeg',
            0.9
        );
    });
}
