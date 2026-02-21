import type { DentalImageRecord, ImageFinding, RiskLevel } from "../domain.js";

const CARIES_KEYWORDS = ["caries", "decay", "lesion", "demineralization"];
const ENDO_KEYWORDS = ["abscess", "periapical", "endodontic"];
const PERIODONTAL_KEYWORDS = ["bone loss", "periodontal", "pocket", "furcation"];

function containsAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

export interface ImageTriageInput {
  image: DentalImageRecord;
  clinicalContext?: string;
}

export interface ImageTriageResult {
  summary: string;
  riskLevel: RiskLevel;
  findings: ImageFinding[];
}

export function triageDentalImage(
  input: ImageTriageInput
): ImageTriageResult {
  const combinedContext = `${input.image.notes || ""} ${
    input.clinicalContext || ""
  }`.toLowerCase();

  const findings: ImageFinding[] = [];

  if (containsAny(combinedContext, CARIES_KEYWORDS)) {
    findings.push({
      code: "suspected-caries",
      label: "Possible caries",
      summary:
        "Context suggests possible carious lesion. Confirm with full clinical exam.",
      confidence: 0.62,
      risk: "moderate",
      toothNumbers: input.image.toothNumbers,
    });
  }

  if (containsAny(combinedContext, ENDO_KEYWORDS)) {
    findings.push({
      code: "possible-endo-pathology",
      label: "Possible endodontic pathology",
      summary:
        "Potential endodontic involvement is mentioned in context. Review pulp vitality tests.",
      confidence: 0.67,
      risk: "high",
      toothNumbers: input.image.toothNumbers,
    });
  }

  if (containsAny(combinedContext, PERIODONTAL_KEYWORDS)) {
    findings.push({
      code: "possible-periodontal-involvement",
      label: "Possible periodontal involvement",
      summary:
        "Text indicates possible periodontal disease progression. Correlate with probing chart.",
      confidence: 0.59,
      risk: "moderate",
      toothNumbers: input.image.toothNumbers,
    });
  }

  if (findings.length === 0) {
    findings.push({
      code: "no-high-risk-signal",
      label: "No high-risk signal",
      summary:
        "No high-risk keywords detected. This is a triage result only, not a diagnosis.",
      confidence: 0.5,
      risk: "low",
      toothNumbers: input.image.toothNumbers,
    });
  }

  const riskLevel = findings.some((finding) => finding.risk === "high")
    ? "high"
    : findings.some((finding) => finding.risk === "moderate")
      ? "moderate"
      : "low";

  return {
    summary:
      riskLevel === "high"
        ? "High-priority review suggested based on image context."
        : riskLevel === "moderate"
          ? "Moderate-risk signals detected; routine review recommended."
          : "No high-risk signals detected in triage.",
    riskLevel,
    findings,
  };
}
