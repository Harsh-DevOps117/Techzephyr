import { checkInjection, checkInputLength, checkSecrets, checkToxicity } from "llm-guardrails";
import { logger } from "../../infrastructure/logging/logger.js";

const blockedIntent = [
  /ignore (all |any |the )?(previous|prior|above) (instructions|rules)/i,
  /\b(approve|publish|apply) (this |the )?(schedule|timetable|booking|proposal)\b/i,
  /\b(change|raise|bypass) (the )?(priority|role|category cap)\b/i,
  /\bmake me (an? )?admin\b/i,
  /\b(bypass|skip|disable) (the )?(validator|approval|hard constraints)\b/i,
];

export class GuardrailBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailBlockedError";
  }
}

function violationsOf(text: string) {
  return [
    checkInjection(text, { enabled: true }),
    checkInputLength(text, { maxChars: 4000, action: "block" }),
    checkToxicity(text),
    checkSecrets(text, "block"),
  ].flatMap((result) => result.violations.filter((item) => item.severity === "block"));
}

export function assertAiInput(text: string) {
  const library = violationsOf(text).map((item) => item.message);
  const policy = blockedIntent.filter((pattern) => pattern.test(text)).map((pattern) => `Blocked by campus policy (${pattern.source})`);
  const reasons = [...library, ...policy];
  if (reasons.length === 0) return;
  logger.warn("ai.input_blocked", { reasons });
  throw new GuardrailBlockedError("That request is outside what the assistant is allowed to do. It cannot approve, change priority, or skip the validator.");
}

export function assertAiOutput(raw: string) {
  const reasons = violationsOf(raw).map((item) => item.message);
  if (/"(approved|priority|role)"\s*:/i.test(raw) && /approve|priority_order|admin/i.test(raw)) {
    reasons.push("Model output tried to decide approval or priority");
  }
  if (reasons.length === 0) return;
  logger.warn("ai.output_blocked", { reasons });
  throw new GuardrailBlockedError("The assistant reply was discarded because it failed the output checks. Use the manual form.");
}
