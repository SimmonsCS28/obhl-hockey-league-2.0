package com.obhl.gateway.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GeneratePreviewDTO {

    /** Players that have no existing user and no name conflict — safe to auto-create */
    private List<PlayerDto> toCreate;

    /** Players where no email match exists but a user with the same name does */
    private List<PotentialDuplicate> potentialDuplicates;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PotentialDuplicate {
        private PlayerDto player;
        private UserDTO existingUser;
    }
}
