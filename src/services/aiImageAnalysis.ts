import type {
  DentalImageRecord,
  ImageFinding,
  RiskLevel,
} from "../domain.js";
import { triageDentalImage } from "./dentalImagery.js";

export interface AIImageAnalyzerConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface AnalyzeImageInput {
  image: DentalImageRecord;
  clinicalContext?: string;
}

export interface AnalyzeImageResult {
  summary: string;
  riskLevel: RiskLevel;
  findings: ImageFinding[];
  source: "model" | "rule";
}

interface ModelResult {
  summary: string;
  riskLevel: RiskLevel;
  findings: Array<{
    code: string;
    label: string;
    summary: string;
    confidence: number;
    risk: RiskLevel;
    toothNumbers?: string[];
  }>;
}

function riskFromUnknown(value: unknown): RiskLevel {
  return value === "high" || value === "moderate" || value === "low"
    ? value
    : "low";
}

function numberFromUnknown(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, n));
}

function parseJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Could not parse model JSON output");
  }
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Model response is not an object");
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  const output = data.output;
  if (!Array.isArray(output)) {
    throw new Error("Model response is missing output text");
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") {
        continue;
      }
      const text = (chunk as Record<string, unknown>).text;
      if (typeof text === "string" && text.length > 0) {
        return text;
      }
    }
  }

  throw new Error("Model response did not include parsable text content");
}

function normalizeModelResult(
  image: DentalImageRecord,
  modelResult: ModelResult
): AnalyzeImageResult {
  const findings: ImageFinding[] = Array.isArray(modelResult.findings)
    ? modelResult.findings.map((finding) => ({
        code: finding.code || "model-finding",
        label: finding.label || "Model finding",
        summary: finding.summary || "No summary provided",
        confidence: numberFromUnknown(finding.confidence, 0.5),
        risk: riskFromUnknown(finding.risk),
        toothNumbers:
          Array.isArray(finding.toothNumbers) && finding.toothNumbers.length > 0
            ? finding.toothNumbers
            : image.toothNumbers,
      }))
    : [];

  return {
    summary:
      typeof modelResult.summary === "string" && modelResult.summary.length > 0
        ? modelResult.summary
        : "Model completed analysis.",
    riskLevel: riskFromUnknown(modelResult.riskLevel),
    findings,
    source: "model",
  };
}

export class DentalImageAnalyzer {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: AIImageAnalyzerConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gpt-4.1-mini";
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
  }

  private get canUseModel(): boolean {
    return Boolean(this.apiKey);
  }

  private async callModel(
    input: AnalyzeImageInput
  ): Promise<AnalyzeImageResult> {
    const prompt = [
      "You are a dental imaging triage assistant.",
      "Return strict JSON only with this schema:",
      '{"summary":"string","riskLevel":"low|moderate|high","findings":[{"code":"string","label":"string","summary":"string","confidence":0.0,"risk":"low|moderate|high","toothNumbers":["string"]}]}',
      "This is triage and not diagnosis.",
      `Modality: ${input.image.modality}`,
      `Notes: ${input.image.notes || ""}`,
      `Clinical context: ${input.clinicalContext || ""}`,
      `Tooth numbers: ${(input.image.toothNumbers || []).join(", ") || "unknown"}`,
    ].join("\n");

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
              {
                type: "input_image",
                image_url: input.image.imageUrl,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Model API failed with ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const outputText = extractOutputText(payload);
    const parsed = parseJsonFromText(outputText) as ModelResult;
    return normalizeModelResult(input.image, parsed);
  }

  async analyze(input: AnalyzeImageInput): Promise<AnalyzeImageResult> {
    if (this.canUseModel) {
      try {
        const result = await this.callModel(input);
        if (result.findings.length > 0) {
          return result;
        }
      } catch (error) {
        console.warn(
          `Model analysis failed; falling back to rule triage: ${String(error)}`
        );
      }
    }

    const triage = triageDentalImage(input);
    return {
      summary: triage.summary,
      riskLevel: triage.riskLevel,
      findings: triage.findings,
      source: "rule",
    };
  }
}
