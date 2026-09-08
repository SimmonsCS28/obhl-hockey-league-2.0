package com.obhl.league.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.obhl.league.model.DraftSave;
import com.obhl.league.repository.DraftSaveRepository;

import lombok.RequiredArgsConstructor;

/**
 * The read-only "watch" link that lets GMs follow a draft from their own devices.
 *
 * <p>Access cannot be scoped by role. A GM is only flagged as one in {@code players.is_gm} at
 * finalize, which happens AFTER the draft they want to watch, so at watch time the system has no
 * idea who the GMs are. The scope therefore comes from an unguessable link instead of from the
 * identity of the viewer. That is a secret URL, not authentication: anyone holding it can read the
 * board, and the operator revokes it by rotating or clearing the token.
 *
 * <p>This class is the ONLY place that produces a viewer-facing payload, deliberately. The stored
 * draft blob carries an email address for every player -- it is the identity key the whole board is
 * built on -- and the watch endpoint is unauthenticated, so handing back the raw blob would publish
 * the league's entire address book to anyone with the link. Keeping the projection in one method
 * means there is exactly one place to audit, and it cannot be bypassed by a caller that forgets.
 */
@Service
@RequiredArgsConstructor
public class DraftShareService {

    private final DraftSaveRepository draftSaveRepository;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Fields stripped from every player before the payload leaves the building.
     *
     * <p>{@code email} and {@code buddyEmail} are personal data outright. {@code dbId} and the
     * {@code potentialMatch*} trio are import bookkeeping that points at real player records, so
     * they are internal detail a viewer has no business seeing either.
     */
    private static final String[] PLAYER_FIELDS_TO_DROP = {
            "email", "buddyEmail", "dbId", "potentialMatchId", "potentialMatchEmail", "potentialMatchSkill"
    };

    /**
     * Mints a new share token and returns the RAW value, which is the only time it exists in a
     * readable form. Rotating replaces any previous token, so links already handed out stop
     * working -- that is the intended way to cut off a link that spread further than meant.
     */
    @Transactional
    public String createShareToken(Long draftId) {
        DraftSave draft = draftSaveRepository.findById(draftId)
                .orElseThrow(() -> new IllegalArgumentException("Draft not found with id: " + draftId));

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        draft.setShareTokenHash(sha256Hex(token));
        draft.setShareCreatedAt(LocalDateTime.now());
        draftSaveRepository.save(draft);

        return token;
    }

    /** Turns sharing off. Every link already issued dies with it. */
    @Transactional
    public void revokeShareToken(Long draftId) {
        DraftSave draft = draftSaveRepository.findById(draftId)
                .orElseThrow(() -> new IllegalArgumentException("Draft not found with id: " + draftId));
        draft.setShareTokenHash(null);
        draft.setShareCreatedAt(null);
        draftSaveRepository.save(draft);
    }

    /** Whether this draft currently has a live share link, without revealing the token. */
    public boolean isShared(Long draftId) {
        return draftSaveRepository.findById(draftId)
                .map(d -> d.getShareTokenHash() != null)
                .orElse(false);
    }

    /**
     * Resolves a presented token to its draft. Blank tokens are rejected before touching the
     * database so that an empty query parameter cannot match a row whose hash is somehow blank.
     */
    public Optional<DraftSave> findByToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return draftSaveRepository.findByShareTokenHash(sha256Hex(token));
    }

    /**
     * The viewer's copy of the board: everything needed to render it, and nothing that identifies
     * a person beyond the name already printed on their card.
     *
     * <p>Emails are SUBSTITUTED rather than removed. The frontend uses that field as the React key
     * for every card and as the handle that buddy links resolve against, so deleting it would break
     * rendering; replacing the value with an opaque digest keeps the shape the board expects while
     * carrying no personal data. The digest is salted per draft so the same person cannot be
     * correlated across two shared drafts, and it is deterministic within one draft so a card keeps
     * its identity across polls.
     */
    public String projectForViewing(DraftSave draft) throws Exception {
        JsonNode root = MAPPER.readTree(draft.getDraftData());
        if (!root.isObject()) {
            throw new IllegalStateException("Draft data is not an object");
        }
        ObjectNode doc = (ObjectNode) root;

        // Salted with the token hash, which never leaves the server.
        String salt = draft.getShareTokenHash() == null ? String.valueOf(draft.getId()) : draft.getShareTokenHash();

        scrubPlayers(doc.get("playerPool"), salt);
        JsonNode teams = doc.get("teams");
        if (teams != null && teams.isArray()) {
            for (JsonNode team : teams) {
                if (team.isObject()) {
                    scrubPlayers(team.get("players"), salt);
                }
            }
        }

        // Bookkeeping the viewer has no use for, and which names people.
        doc.remove("buddyPickMap");

        return MAPPER.writeValueAsString(doc);
    }

    private void scrubPlayers(JsonNode players, String salt) {
        if (players == null || !players.isArray()) {
            return;
        }
        ArrayNode list = (ArrayNode) players;
        for (Iterator<JsonNode> it = list.elements(); it.hasNext();) {
            JsonNode node = it.next();
            if (!node.isObject()) {
                continue;
            }
            ObjectNode player = (ObjectNode) node;
            JsonNode email = player.get("email");
            String handle = (email == null || email.isNull())
                    ? ""
                    : sha256Hex(salt + ":" + email.asText().toLowerCase()).substring(0, 16);

            for (String field : PLAYER_FIELDS_TO_DROP) {
                player.remove(field);
            }
            // Put the opaque handle back in the slot the board reads, AFTER the removals above so
            // the drop list cannot accidentally take it out again.
            player.put("email", handle);
        }
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required of every JVM; if it is missing the platform is broken.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
