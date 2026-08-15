package com.obhl.gateway.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Sends transactional emails via the Resend API (https://resend.com).
 * Free tier covers this app's volume without needing an SMTP server.
 */
@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final RestTemplate restTemplate;

    @Value("${resend.api.key:}")
    private String resendApiKey;

    @Value("${resend.from.email:OBHL <onboarding@resend.dev>}")
    private String fromEmail;

    public EmailService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public void sendPasswordResetEmail(String toEmail, String resetLink) {
        String subject = "Reset your OBHL password";
        String html = "<p>We received a request to reset your OBHL password.</p>"
                + "<p><a href=\"" + resetLink + "\">Click here to reset your password</a></p>"
                + "<p>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>";

        send(toEmail, subject, html);
    }

    public void sendShiftProposalEmail(String toEmail, String name, String roleLabel, String gameDescription,
            String confirmLink, String gamePreviewLink, String weekScheduleHtml) {
        String greeting = (name != null && !name.isBlank()) ? ("Hi " + name + ",") : "Hi,";
        String subject = "OBHL " + roleLabel + " shift — please confirm";
        String previewBlock = (gamePreviewLink != null && !gamePreviewLink.isBlank())
                ? "<p>See the matchup details: <a href=\"" + gamePreviewLink + "\">view the game preview</a>.</p>"
                : "";
        String scheduleBlock = (weekScheduleHtml != null && !weekScheduleHtml.isBlank()) ? weekScheduleHtml : "";
        String html = "<p>" + greeting + "</p>"
                + "<p>You've been assigned a " + roleLabel + " shift:</p>"
                + "<p><strong>" + gameDescription + "</strong></p>"
                + previewBlock
                + "<p>Please let us know if you can make it:</p>"
                + "<p><a href=\"" + confirmLink + "\">Confirm or decline this shift</a></p>"
                + "<p>If you can't make the link work, copy and paste this into your browser:<br>"
                + confirmLink + "</p>"
                + scheduleBlock;

        send(toEmail, subject, html);
    }

    /**
     * Email B — final goalie assignment (post-publish). The goalie's exact game AND team are now
     * locked, unlike the earlier confirm-your-time email which only pinned the time slot.
     */
    public void sendGoalieFinalAssignmentEmail(String toEmail, String name, String gameDescription, String teamName,
            String gamePreviewLink, String weekScheduleHtml) {
        String greeting = (name != null && !name.isBlank()) ? ("Hi " + name + ",") : "Hi,";
        String subject = "OBHL goalie assignment — you're set for " + (teamName != null ? teamName : "your game");
        String team = (teamName != null && !teamName.isBlank())
                ? ("<p>You're in net for <strong>" + teamName + "</strong>.</p>")
                : "";
        String previewBlock = (gamePreviewLink != null && !gamePreviewLink.isBlank())
                ? "<p>See the matchup details: <a href=\"" + gamePreviewLink + "\">view the game preview</a>.</p>"
                : "";
        String scheduleBlock = (weekScheduleHtml != null && !weekScheduleHtml.isBlank()) ? weekScheduleHtml : "";
        String html = "<p>" + greeting + "</p>"
                + "<p>Your goalie assignment is final:</p>"
                + "<p><strong>" + gameDescription + "</strong></p>"
                + team
                + previewBlock
                + "<p>Thanks for playing — see you at the rink. No further action is needed.</p>"
                + scheduleBlock;

        send(toEmail, subject, html);
    }

    /**
     * Final assignment for a referee or scorekeeper, sent on publish. Informational — no confirm or
     * decline links, because by this point they've already agreed.
     *
     * <p>Deliberately not modelled on the goalie version. A goalie's email leads with the team whose
     * net they're in; refs and scorekeepers have no side, so the card leads with <em>when and
     * where</em> — the only things they act on — and keeps the matchup and slot below as context.
     *
     * <p>{@code matchupHtml} and {@code weekScheduleHtml} arrive pre-rendered and pre-escaped from
     * {@code CoordinatorService}, which owns the team-color map and the schedule templates.
     */
    public void sendStaffFinalAssignmentEmail(String toEmail, String name, String roleLabel, String weekLabel,
            String dayDate, String time, String rink, String matchupHtml, String slotLabel,
            String weekScheduleHtml, String coordinatorName, String coordinatorEmail) {
        String greeting = (name != null && !name.isBlank()) ? ("Hi " + name + ",") : "Hi,";
        String when = dayDate + (time == null || time.isBlank() ? "" : ("  &middot;  " + time));
        String subject = "OBHL " + roleLabel + " assignment — you're set for " + dayDate;
        String weekPhrase = (weekLabel != null && !weekLabel.isBlank()) ? (" for " + weekLabel) : "";
        String scheduleBlock = (weekScheduleHtml != null && !weekScheduleHtml.isBlank()) ? weekScheduleHtml : "";

        String contact = (coordinatorEmail != null && !coordinatorEmail.isBlank())
                ? "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                        + "If something comes up and you can't work this game, tell "
                        + (coordinatorName != null && !coordinatorName.isBlank() ? coordinatorName : "your coordinator")
                        + " as early as you can — <a href=\"mailto:" + coordinatorEmail
                        + "\" style=\"color:#1a5fb4;\">" + coordinatorEmail + "</a>.</p>"
                : "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                        + "If something comes up and you can't work this game, tell your coordinator as early as you can.</p>";

        String html = "<div style=\"max-width:600px;margin:0 auto;padding:0 8px;\">"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                + greeting + "</p>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 18px;\">"
                + "Your " + roleLabel + " shift" + weekPhrase + " is final. Nothing to confirm — this is just so you have it.</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"max-width:600px;width:100%;border-collapse:collapse;background:#ffffff;"
                + "border:1px solid #dfe3e8;border-radius:8px;margin:0 0 20px;\">"
                + "<tr><td style=\"padding:18px 20px 16px;\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;"
                + "text-transform:uppercase;color:#8a929b;padding-bottom:6px;\">You're working</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;line-height:1.2;"
                + "color:#1a1d21;\">" + when + "</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#41474e;padding-top:4px;\">"
                + rink + "</div>"
                + "</td></tr>"
                + "<tr><td style=\"padding:0 20px;\">"
                + "<div style=\"height:1px;background:#e8ebee;font-size:0;line-height:1px;\">&nbsp;</div>"
                + "</td></tr>"
                + "<tr><td style=\"padding:14px 20px 18px;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>"
                + "<td valign=\"middle\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;letter-spacing:1.1px;"
                + "text-transform:uppercase;color:#8a929b;padding-bottom:5px;\">Game</div>"
                + matchupHtml
                + "</td>"
                + "<td align=\"right\" valign=\"middle\" style=\"padding-left:12px;\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;letter-spacing:1.1px;"
                + "text-transform:uppercase;color:#8a929b;padding-bottom:5px;\">Your slot</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#1a1d21;\">"
                + slotLabel + "</div>"
                + "</td></tr></table>"
                + "</td></tr></table>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 20px;\">"
                + "Please be at the rink 15 minutes before puck drop.</p>"
                + scheduleBlock
                + contact
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0;\">"
                + "Thanks,<br>Old Buzzard Hockey League</p>"
                + "</div>";

        send(toEmail, subject, html);
    }

    /**
     * Sent when a published official is removed from a game. Deliberately short: the failure mode is
     * someone driving to a rink they're no longer working, so the struck-through game line plus the
     * one bold sentence have to land in a two-second phone glance. No week-schedule block — anything
     * below the fold competes with the one fact that stops the drive.
     *
     * <p>Callers pass pre-escaped, pre-formatted lines (see {@code CoordinatorService.htmlEscape}).
     * {@code coordinatorName}/{@code coordinatorEmail} may be null when the acting coordinator can't
     * be resolved; the copy degrades to an impersonal phrasing rather than printing "null".
     */
    public boolean sendShiftCancelledEmail(String toEmail, String name, String roleLabel, String shortDate,
            String gameLine, String matchupLine, String coordinatorName, String coordinatorEmail) {
        String greeting = (name != null && !name.isBlank()) ? ("Hi " + name + ",") : "Hi,";
        String subject = "OBHL " + roleLabel + " shift — you're no longer scheduled"
                + (shortDate != null && !shortDate.isBlank() ? (" for " + shortDate) : "");
        boolean hasCoordinator = coordinatorName != null && !coordinatorName.isBlank();
        String who = hasCoordinator ? coordinatorName : "Your coordinator";

        String contact = (coordinatorEmail != null && !coordinatorEmail.isBlank())
                ? "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                        + "If this looks like a mistake, reply to this email or contact "
                        + (hasCoordinator ? coordinatorName : "your coordinator") + " at "
                        + "<a href=\"mailto:" + coordinatorEmail + "\" style=\"color:#1a5fb4;\">" + coordinatorEmail + "</a>.</p>"
                : "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                        + "If this looks like a mistake, reply to this email.</p>";

        String html = "<div style=\"max-width:600px;margin:0 auto;padding:0 8px;\">"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 16px;\">"
                + greeting + "</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"max-width:600px;width:100%;border-collapse:collapse;background:#fdecea;"
                + "border:1px solid #f0c4bf;border-radius:8px;margin:0 0 20px;\">"
                + "<tr>"
                + "<td width=\"4\" style=\"background-color:#B3261E;font-size:0;line-height:1px;\">&nbsp;</td>"
                + "<td style=\"padding:18px 20px;\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;"
                + "text-transform:uppercase;color:#B3261E;padding-bottom:7px;\">You're off this game</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;line-height:1.25;"
                + "color:#5c1d17;text-decoration:line-through;\">" + gameLine + "</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#7a352e;padding-top:5px;"
                + "text-decoration:line-through;\">" + matchupLine + "</div>"
                + "<div style=\"height:1px;background:#f0c4bf;font-size:0;line-height:1px;margin:14px 0;\">&nbsp;</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:1.45;"
                + "color:#1a1d21;\">You are not needed at the rink for this game.</div>"
                + "</td></tr></table>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                + who + " has taken you off this game and it's no longer on your schedule. "
                + "Your other games this season are unchanged.</p>"
                + contact
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0;\">"
                + "Thanks,<br>Old Buzzard Hockey League</p>"
                + "</div>";

        return send(toEmail, subject, html);
    }

    /**
     * Tells a coordinator that someone turned a shift down. Declines only — a confirm needs no
     * action, and mailing those too would train the coordinator to ignore the sender, which would
     * cost us the one message that actually needs a response.
     *
     * <p>The decline reason is the point of the email: without it the coordinator has to text the
     * person to find out what happened, which is the situation this replaces.
     */
    public void sendDeclineNoticeEmail(String toEmail, String coordinatorName, String whoDeclined,
            String roleLabel, String gameDescription, String reason, String consoleLink) {
        String greeting = (coordinatorName != null && !coordinatorName.isBlank())
                ? ("Hi " + coordinatorName + ",") : "Hi,";
        String subject = whoDeclined + " declined a " + roleLabel + " shift — " + gameDescription;
        String reasonBlock = (reason != null && !reason.isBlank())
                ? "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;"
                        + "color:#1a1d21;margin:0 0 14px;\">They said: &ldquo;" + reason + "&rdquo;</p>"
                : "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;"
                        + "color:#6b7480;margin:0 0 14px;\">They didn't give a reason.</p>";

        String html = "<div style=\"max-width:600px;margin:0 auto;padding:0 8px;\">"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 16px;\">"
                + greeting + "</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"max-width:600px;width:100%;border-collapse:collapse;background:#fdecea;"
                + "border:1px solid #f0c4bf;border-radius:8px;margin:0 0 18px;\">"
                + "<tr><td width=\"4\" style=\"background-color:#B3261E;font-size:0;line-height:1px;\">&nbsp;</td>"
                + "<td style=\"padding:16px 20px;\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;"
                + "text-transform:uppercase;color:#B3261E;padding-bottom:6px;\">Shift declined</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:1.3;"
                + "color:#1a1d21;\">" + whoDeclined + "</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#41474e;padding-top:4px;\">"
                + gameDescription + "</div>"
                + "</td></tr></table>"
                + reasonBlock
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                + "The slot is waiting for a replacement: <a href=\"" + consoleLink
                + "\" style=\"color:#1a5fb4;\">open the coordinator console</a>.</p>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0;\">"
                + "Thanks,<br>Old Buzzard Hockey League</p>"
                + "</div>";

        send(toEmail, subject, html);
    }

    /**
     * Tells a coordinator that someone has given up a shift they had already confirmed.
     *
     * <p>Deliberately louder than the decline notice. A decline means "I never agreed to this"; a drop
     * means the person had agreed, and if the slot was published their name was on the public
     * schedule until a moment ago — so the coordinator has to find a replacement <em>and</em>
     * republish the matchup. The subject line says "dropped" rather than "declined" for the same
     * reason: the two need to be tellable apart in an inbox.
     */
    public void sendShiftDroppedEmail(String toEmail, String coordinatorName, String whoDropped,
            String roleLabel, String gameDescription, boolean wasPublished, String consoleLink) {
        String greeting = (coordinatorName != null && !coordinatorName.isBlank())
                ? ("Hi " + coordinatorName + ",") : "Hi,";
        String subject = whoDropped + " dropped a confirmed " + roleLabel + " shift — " + gameDescription;

        String impact = wasPublished
                ? "This shift was already published, so they have been taken off the public schedule "
                        + "and the slot is open again. The matchup will need republishing once you fill it."
                : "This shift had not been published yet, so nothing public has changed — the slot is "
                        + "simply open again.";

        String html = "<div style=\"max-width:600px;margin:0 auto;padding:0 8px;\">"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 16px;\">"
                + greeting + "</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"max-width:600px;width:100%;border-collapse:collapse;background:#fdecea;"
                + "border:1px solid #f0c4bf;border-radius:8px;margin:0 0 18px;\">"
                + "<tr><td width=\"4\" style=\"background-color:#B3261E;font-size:0;line-height:1px;\">&nbsp;</td>"
                + "<td style=\"padding:16px 20px;\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;"
                + "text-transform:uppercase;color:#B3261E;padding-bottom:6px;\">Confirmed shift dropped</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:1.3;"
                + "color:#1a1d21;\">" + whoDropped + "</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#41474e;padding-top:4px;\">"
                + gameDescription + "</div>"
                + "</td></tr></table>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                + impact + "</p>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                + "<a href=\"" + consoleLink + "\" style=\"color:#1a5fb4;\">Open the coordinator console</a> to fill the slot.</p>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0;\">"
                + "Thanks,<br>Old Buzzard Hockey League</p>"
                + "</div>";

        send(toEmail, subject, html);
    }

    /**
     * Tells a coordinator that someone accepted a shift. Opt-in only, and off by default: a five-game
     * week produces roughly ten of these per role, and on by default would train the recipient to
     * filter the sender — taking the drop and decline notices down with it.
     *
     * <p>Deliberately the quietest of the three: green rather than red, and no call to action,
     * because nothing needs doing.
     */
    public void sendShiftAcceptedNoticeEmail(String toEmail, String coordinatorName, String whoConfirmed,
            String roleLabel, String gameDescription, String consoleLink) {
        String greeting = (coordinatorName != null && !coordinatorName.isBlank())
                ? ("Hi " + coordinatorName + ",") : "Hi,";
        String subject = whoConfirmed + " confirmed a " + roleLabel + " shift — " + gameDescription;

        String html = "<div style=\"max-width:600px;margin:0 auto;padding:0 8px;\">"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 16px;\">"
                + greeting + "</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"max-width:600px;width:100%;border-collapse:collapse;background:#f1f8f4;"
                + "border:1px solid #cfe6da;border-radius:8px;margin:0 0 18px;\">"
                + "<tr><td width=\"4\" style=\"background-color:#2E8B57;font-size:0;line-height:1px;\">&nbsp;</td>"
                + "<td style=\"padding:16px 20px;\">"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.2px;"
                + "text-transform:uppercase;color:#2E8B57;padding-bottom:6px;\">Shift confirmed</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:1.3;"
                + "color:#1a1d21;\">" + whoConfirmed + "</div>"
                + "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#41474e;padding-top:4px;\">"
                + gameDescription + "</div>"
                + "</td></tr></table>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0 0 14px;\">"
                + "No action needed — this slot is set. You're getting this because you asked for confirmations; "
                + "you can turn them off in <a href=\"" + consoleLink + "\" style=\"color:#1a5fb4;\">the coordinator console</a>.</p>"
                + "<p style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1d21;margin:0;\">"
                + "Thanks,<br>Old Buzzard Hockey League</p>"
                + "</div>";

        send(toEmail, subject, html);
    }

    /** Courtesy confirmation when a coordinator confirms a shift the official signed up for (no action needed). */
    public void sendShiftConfirmedEmail(String toEmail, String name, String roleLabel, String gameDescription) {
        String greeting = (name != null && !name.isBlank()) ? ("Hi " + name + ",") : "Hi,";
        String subject = "OBHL " + roleLabel + " shift — confirmed";
        String html = "<p>" + greeting + "</p>"
                + "<p>Your " + roleLabel + " shift is confirmed:</p>"
                + "<p><strong>" + gameDescription + "</strong></p>"
                + "<p>Thanks for signing up — no further action is needed.</p>";

        send(toEmail, subject, html);
    }

    /**
     * @return true only if the message was handed to Resend successfully. Most callers ignore this —
     *         their email is best-effort — but the cancellation flow needs it, because "removed from
     *         the game but never told" is a state the coordinator has to chase down by phone.
     */
    private boolean send(String toEmail, String subject, String html) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            logger.warn("RESEND_API_KEY is not configured; skipping email send to {}", toEmail);
            return false;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resendApiKey);

        Map<String, Object> body = Map.of(
                "from", fromEmail,
                "to", toEmail,
                "subject", subject,
                "html", html);

        try {
            restTemplate.postForEntity(RESEND_API_URL, new HttpEntity<>(body, headers), String.class);
            return true;
        } catch (Exception e) {
            logger.error("Failed to send email to {}: {}", toEmail, e.getMessage());
            return false;
        }
    }
}
