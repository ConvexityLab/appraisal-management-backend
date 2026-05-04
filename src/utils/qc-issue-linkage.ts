/**
 * Build the program / version / source-run linkage object that gets attached
 * to every qc.issue.detected event published from axiom.service.
 *
 * Extracted to a tiny pure helper so the publisher's contract — "if any of
 * these fields are present in scope, they MUST appear on the event" — has a
 * unit test. Without this, a future refactor could silently drop one of the
 * linkage fields and the recorder-side test would still pass.
 */

export interface QCIssueLinkage {
  programId?: string;
  programVersion?: string;
  sourceRunId?: string;
}

export function buildQCIssueLinkage(input: {
  mapped?: { programId?: string; programVersion?: string };
  meta?: { runId?: unknown };
}): QCIssueLinkage {
  const linkage: QCIssueLinkage = {};
  const mapped = input.mapped ?? {};
  const meta = input.meta ?? {};

  if (typeof mapped.programId === 'string' && mapped.programId.length > 0) {
    linkage.programId = mapped.programId;
  }
  if (typeof mapped.programVersion === 'string' && mapped.programVersion.length > 0) {
    linkage.programVersion = mapped.programVersion;
  }
  if (typeof meta.runId === 'string' && meta.runId.length > 0) {
    linkage.sourceRunId = meta.runId;
  }

  return linkage;
}
