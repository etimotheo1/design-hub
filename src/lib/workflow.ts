// Shared helper: can a given user perform a stage transition on a project?
// Returns { allowed, requiredDesignations? }. If no workflow is set on the
// project, or no designations are configured for that transition, allowed=true.

import { get, all } from "@/lib/db";
import type { Stage } from "@/lib/types";

export interface ApprovalCheck {
  allowed: boolean;
  requiredDesignations: string[]; // designation names the transition needs
}

export function checkStageApproval(
  userId: number,
  userRole: string,
  projectId: number,
  fromStage: Stage,
  toStage: Stage
): ApprovalCheck {
  if (userRole === "admin") return { allowed: true, requiredDesignations: [] };

  const project = get<{ workflow_id: number | null }>(
    `SELECT workflow_id FROM projects WHERE id = ?`,
    [projectId]
  );
  if (!project || !project.workflow_id) return { allowed: true, requiredDesignations: [] };

  const transition = get<{ id: number }>(
    `SELECT id FROM workflow_transitions WHERE workflow_id = ? AND from_stage = ? AND to_stage = ?`,
    [project.workflow_id, fromStage, toStage]
  );
  if (!transition) return { allowed: true, requiredDesignations: [] };

  const allowedDesignations = all<{ designation_id: number; name: string }>(
    `SELECT wtd.designation_id, d.name
     FROM workflow_transition_designations wtd
     JOIN designations d ON d.id = wtd.designation_id
     WHERE wtd.transition_id = ?`,
    [transition.id]
  );
  if (allowedDesignations.length === 0) return { allowed: true, requiredDesignations: [] };

  const userDesignation = get<{ designation_id: number | null }>(
    `SELECT designation_id FROM users WHERE id = ?`,
    [userId]
  );
  const allowed = !!userDesignation?.designation_id &&
    allowedDesignations.some((a) => a.designation_id === userDesignation.designation_id);

  return {
    allowed,
    requiredDesignations: allowedDesignations.map((a) => a.name),
  };
}
