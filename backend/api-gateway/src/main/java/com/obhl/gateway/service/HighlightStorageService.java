package com.obhl.gateway.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import jakarta.annotation.PostConstruct;

/**
 * The only class in the app that writes uploaded bytes to disk.
 *
 * Files land in {@code app.media.root} (a named Docker volume mounted into the
 * api-gateway container) under a server-generated UUID filename. The client's
 * filename is NEVER used to build a path — it is stored as a display label only.
 */
@Service
public class HighlightStorageService {

    private static final Logger log = LoggerFactory.getLogger(HighlightStorageService.class);

    /** 30s of Live Barn 1080p lands well under this; the cap is a guard, not a target. */
    private static final long MAX_VIDEO_BYTES = 100L * 1024 * 1024;
    private static final long MAX_POSTER_BYTES = 5L * 1024 * 1024;

    /**
     * mp4 only. Browsers all play H.264/mp4 natively, so accepting other containers
     * would just let an admin upload something that silently fails to play for half
     * the league. Some browsers send an empty or generic content type, so the
     * extension is checked too and either one matching is enough to reject early.
     */
    private static final String VIDEO_EXTENSION = ".mp4";

    private static final Map<String, String> POSTER_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    @Value("${app.media.root}")
    private String mediaRoot;

    private Path root;

    @PostConstruct
    void init() throws IOException {
        root = Paths.get(mediaRoot).toAbsolutePath().normalize();
        Files.createDirectories(root);
        log.info("Highlight media root: {}", root);
    }

    /** Validates and stores the video, returning its storage key. */
    public String storeVideo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A video file is required.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);

        if (!name.endsWith(VIDEO_EXTENSION) || (!type.isBlank() && !type.startsWith("video/"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only .mp4 video files are supported.");
        }
        if (file.getSize() > MAX_VIDEO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Video is too large (" + mb(file.getSize()) + "MB). The limit is " + mb(MAX_VIDEO_BYTES) + "MB.");
        }
        return write(file, UUID.randomUUID() + VIDEO_EXTENSION);
    }

    /** Validates and stores an optional poster image, returning its storage key or null. */
    public String storePoster(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String extension = POSTER_TYPES.get(type);
        if (extension == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Poster image must be a JPEG, PNG or WebP.");
        }
        if (file.getSize() > MAX_POSTER_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Poster image is too large (" + mb(file.getSize()) + "MB). The limit is " + mb(MAX_POSTER_BYTES) + "MB.");
        }
        return write(file, UUID.randomUUID() + extension);
    }

    private String write(MultipartFile file, String storageKey) {
        Path target = resolve(storageKey);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed writing upload to {}", target, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the uploaded file.");
        }
        return storageKey;
    }

    /**
     * Best-effort delete. A missing file must not block deleting the row — otherwise
     * a highlight whose file was already removed becomes permanently undeletable.
     */
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(storageKey));
        } catch (IOException e) {
            log.warn("Could not delete media file {} — leaving the row deletion to proceed", storageKey, e);
        }
    }

    /**
     * Guards against a storage key that tries to escape the media root. Keys are
     * generated server-side so this should be unreachable, but the check is cheap
     * and this is the one place in the app that turns a string into a filesystem path.
     */
    private Path resolve(String storageKey) {
        Path candidate = root.resolve(storageKey).normalize();
        if (!candidate.startsWith(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file reference.");
        }
        return candidate;
    }

    private static long mb(long bytes) {
        return Math.max(1, bytes / (1024 * 1024));
    }
}
