import type { GuardrailOutput } from './executor.js';

export const guardrailEvaluators = {
  decision_correct: (output: GuardrailOutput, target = output.expectedAccepted) =>
    Number(output.status === 'decision' && output.accepted === target),
  false_accept: (output: GuardrailOutput, target = output.expectedAccepted) =>
    Number(output.status === 'decision' && !target && output.accepted),
  false_reject: (output: GuardrailOutput, target = output.expectedAccepted) =>
    Number(output.status === 'decision' && target && !output.accepted),
  validation_error: (output: GuardrailOutput) => Number(output.status === 'error'),
};

export function summarizeGuardrails(outputs: GuardrailOutput[]) {
  const correctAccepts = outputs.filter((o) => o.status === 'decision' && o.expectedAccepted && o.accepted).length;
  const correctRejects = outputs.filter((o) => o.status === 'decision' && !o.expectedAccepted && !o.accepted).length;
  const falseAccepts = outputs.reduce((n, o) => n + guardrailEvaluators.false_accept(o), 0);
  const falseRejects = outputs.reduce((n, o) => n + guardrailEvaluators.false_reject(o), 0);
  const errors = outputs.reduce((n, o) => n + guardrailEvaluators.validation_error(o), 0);
  const expectedAccepts = outputs.filter((o) => o.expectedAccepted).length;
  const expectedRejects = outputs.length - expectedAccepts;
  return {
    total: outputs.length, correctAccepts, correctRejects, falseAccepts, falseRejects, errors,
    accuracy: outputs.length ? (correctAccepts + correctRejects) / outputs.length : null,
    falseAcceptRate: expectedRejects ? falseAccepts / expectedRejects : null,
    falseRejectRate: expectedAccepts ? falseRejects / expectedAccepts : null,
  };
}
