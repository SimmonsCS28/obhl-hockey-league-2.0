package com.obhl.gateway.service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Turns whatever a player uploads into one 512×512 JPEG.
 *
 * Re-encoding is the point, not an optimisation: it strips EXIF (phone photos carry
 * GPS coordinates), proves the bytes really decode as an image, and bounds the size
 * of what gets served to every visitor of the Players page. javax.imageio is in the
 * JRE, so this costs no dependency — at the price of two known limits, both handled
 * on the client before upload (see the frontend's photo crop helper):
 *   - ImageIO cannot read WebP/HEIC, hence the JPEG/PNG allowlist;
 *   - ImageIO ignores the EXIF orientation tag, so a portrait phone shot would land
 *     sideways if the client did not bake the orientation in first.
 * The server still runs on every upload regardless — the client step is a courtesy,
 * not a trust boundary.
 */
@Service
public class ProfilePhotoProcessor {

    public static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;
    public static final int OUTPUT_SIZE = 512;
    public static final String OUTPUT_EXTENSION = ".jpg";
    public static final String OUTPUT_CONTENT_TYPE = "image/jpeg";

    /** Refuse to decode anything this wide/tall: a 20k×20k PNG is a 1.6 GB BufferedImage. */
    private static final int MAX_SOURCE_DIMENSION = 6000;
    private static final float JPEG_QUALITY = 0.85f;
    private static final Set<String> ACCEPTED_TYPES = Set.of("image/jpeg", "image/png");

    public static final String ERR_TYPE = "JPG or PNG only.";
    public static final String ERR_SIZE = "Keep it under 5 MB.";
    public static final String ERR_DECODE = "That file doesn't look like an image.";

    public byte[] process(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw bad(ERR_DECODE);
        }
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT).trim();
        if (!ACCEPTED_TYPES.contains(type)) {
            throw bad(ERR_TYPE);
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw bad(ERR_SIZE);
        }

        byte[] source;
        try {
            source = file.getBytes();
        } catch (IOException e) {
            throw bad(ERR_DECODE);
        }

        BufferedImage image = decodeGuarded(source);
        BufferedImage square = cropAndScale(image);
        return encodeJpeg(square);
    }

    /**
     * Reads the header for dimensions before committing to a full decode, so an
     * image that is small on disk but enormous in pixels is rejected cheaply.
     */
    private BufferedImage decodeGuarded(byte[] source) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            if (in == null) {
                throw bad(ERR_DECODE);
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw bad(ERR_DECODE);
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0) {
                    throw bad(ERR_DECODE);
                }
                if (width > MAX_SOURCE_DIMENSION || height > MAX_SOURCE_DIMENSION) {
                    throw bad("That image is too large. Try one under " + MAX_SOURCE_DIMENSION + " pixels on a side.");
                }
                BufferedImage image = reader.read(0);
                if (image == null) {
                    throw bad(ERR_DECODE);
                }
                return image;
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw bad(ERR_DECODE);
        }
    }

    /**
     * Center-crops to a square and scales to OUTPUT_SIZE onto an opaque white canvas —
     * the JPEG writer refuses ARGB, and a transparent PNG corner would otherwise come
     * out black.
     */
    private static BufferedImage cropAndScale(BufferedImage src) {
        int side = Math.min(src.getWidth(), src.getHeight());
        int x = (src.getWidth() - side) / 2;
        int y = (src.getHeight() - side) / 2;

        BufferedImage out = new BufferedImage(OUTPUT_SIZE, OUTPUT_SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(src, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE, x, y, x + side, y + side, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static byte[] encodeJpeg(BufferedImage image) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No JPEG encoder available.");
        }
        ImageWriter writer = writers.next();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream(64 * 1024);
        try (ImageOutputStream out = ImageIO.createImageOutputStream(buffer)) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not encode the photo.");
        } finally {
            writer.dispose();
        }
        return buffer.toByteArray();
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
