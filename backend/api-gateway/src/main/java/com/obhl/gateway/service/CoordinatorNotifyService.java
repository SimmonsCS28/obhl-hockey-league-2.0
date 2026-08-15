package com.obhl.gateway.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;

/**
 * Tells the coordinator when a shift falls through — either turned down before it was ever agreed
 * (a decline) or given up after (a drop).
 *
 * <p>Both live here rather than beside their triggers because they answer the same awkward question:
 * <em>who</em> is the coordinator for this shift. That answer has three fallbacks and is easy to get
 * subtly wrong, and having two copies of it drift apart is how one of these notices ends up going to
 * nobody.
 *
 * <p>Every send is best-effort. The event that triggered it — a decline, a drop, an unpublish — is
 * already committed and must stand even if Resend is down; a lost notice degrades to "they see it on
 * the board", which is the status quo these replace.
 */
@Service
public class CoordinatorNotifyService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    /** Someone turned down a shift they had not yet agreed to. */
    public void notifyDecline(ShiftAssignment a, String whoDeclined, String gameDescription) {
        for (User c : recipientsFor(a)) {
            emailService.sendDeclineNoticeEmail(c.getEmail(), firstName(c), whoDeclined,
                    roleLabel(a.getRole()), gameDescription, a.getDeclineReason(), consoleLink());
        }
    }

    /**
     * Someone gave up a shift they had already confirmed. More urgent than a decline: if the slot was
     * published, that person's name was on the public schedule until a moment ago, so the coordinator
     * has to both find a replacement and republish the matchup.
     */
    public void notifyDrop(ShiftAssignment a, String whoDropped, String gameDescription, boolean wasPublished) {
        for (User c : recipientsFor(a)) {
            emailService.sendShiftDroppedEmail(c.getEmail(), firstName(c), whoDropped,
                    roleLabel(a.getRole()), gameDescription, wasPublished, consoleLink());
        }
    }

    /**
     * Who to tell, in order of preference:
     * <ol>
     *   <li>the coordinator who proposed the shift — right in the normal case;</li>
     *   <li>everyone currently holding the matching coordinator role, when the proposer is unknown
     *       (self-signups, older rows) or has since lost the role;</li>
     *   <li>admins, but <em>only</em> when nobody holds that coordinator role at all.</li>
     * </ol>
     *
     * <p>The last step exists because the goalie and scorekeeper roles are unfilled and run from the
     * admin console — without it those notices resolve to an empty list and vanish silently. Keeping
     * it to a last resort means holding ADMIN grants console access without subscribing you to the
     * mail of a coordinator who does exist.
     *
     * <p>Anyone without a usable email address is dropped here rather than at each call site.
     */
    private List<User> recipientsFor(ShiftAssignment a) {
        String coordRole = coordinatorRole(a.getRole());

        List<User> chosen = null;
        if (a.getAssignedBy() != null) {
            User assigner = userRepository.findById(a.getAssignedBy()).orElse(null);
            if (assigner != null && holdsRole(assigner, coordRole)) {
                chosen = List.of(assigner);
            }
        }
        if (chosen == null) {
            chosen = usersWithRole(coordRole);
        }
        if (chosen.isEmpty()) {
            chosen = usersWithRole("ADMIN");
        }
        return chosen.stream()
                .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
                .toList();
    }

    /** Holders of a role, reading both the roles table and the deprecated single-role column. */
    private List<User> usersWithRole(String roleName) {
        Map<Long, User> byId = new LinkedHashMap<>();
        userRepository.findByRoles_Name(roleName).forEach(u -> byId.put(u.getId(), u));
        userRepository.findByRole(roleName).forEach(u -> byId.put(u.getId(), u));
        return new ArrayList<>(byId.values());
    }

    private boolean holdsRole(User u, String roleName) {
        if (u.getRoles() != null && u.getRoles().stream().anyMatch(r -> roleName.equals(r.getName()))) {
            return true;
        }
        return roleName.equals(u.getRole());
    }

    private String coordinatorRole(String role) {
        if ("REF".equals(role)) {
            return "REF_COORDINATOR";
        }
        if ("SCOREKEEPER".equals(role)) {
            return "SCOREKEEPER_COORDINATOR";
        }
        return "GOALIE_COORDINATOR";
    }

    private String roleLabel(String role) {
        if ("REF".equals(role)) {
            return "referee";
        }
        if ("SCOREKEEPER".equals(role)) {
            return "scorekeeper";
        }
        return "goalie";
    }

    private String firstName(User u) {
        return (u.getFirstName() != null && !u.getFirstName().isBlank()) ? u.getFirstName() : u.getUsername();
    }

    private String consoleLink() {
        return frontendUrl + "/coordinator";
    }
}
