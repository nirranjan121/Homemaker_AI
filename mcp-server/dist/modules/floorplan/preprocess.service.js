import sharp from 'sharp';
const MAX_DIM = 1600;
export async function preprocessImage(fileBuffer) {
    let image = sharp(fileBuffer);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
        throw new Error("Could not decode image — unsupported format");
    }
    let w = metadata.width;
    let h = metadata.height;
    let scale_factor = 1.0;
    if (Math.max(h, w) > MAX_DIM) {
        scale_factor = MAX_DIM / Math.max(h, w);
        w = Math.round(w * scale_factor);
        h = Math.round(h * scale_factor);
        image = image.resize({ width: w, height: h, fit: 'inside' });
    }
    // Grayscale and contrast stretching (normalize)
    const processedBuffer = await image
        .grayscale()
        .normalize()
        .jpeg({ quality: 90 })
        .toBuffer();
    const image_b64 = processedBuffer.toString('base64');
    return {
        image_b64,
        width: w,
        height: h,
        scale_factor,
        mime_type: 'image/jpeg',
    };
}
//# sourceMappingURL=preprocess.service.js.map