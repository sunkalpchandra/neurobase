import { describe, expect, it } from "vitest";
import { ACTIVE_TRIAL_STATUSES } from "@/domain/enums";
import { broadenedTsQuery, parseQuery } from "./parser";

function values(parsed: ReturnType<typeof parseQuery>, field: string): string[] {
  return parsed.interpreted.filter((f) => f.field === field).map((f) => f.value);
}

describe("parseQuery", () => {
  it("interprets implanted BCIs for speech restoration", () => {
    const parsed = parseQuery("implanted BCIs for speech restoration");
    expect(values(parsed, "invasiveness")).toEqual(["invasive"]);
    expect(parsed.terms).toEqual(["bci", "speech restoration"]);
    expect(parsed.interpreted[0]?.matchedTerm).toBe("implanted");
    const bci = parsed.expansions.find((e) => e.term === "bci");
    expect(bci?.synonyms).toContain("brain computer interface");
    expect(parsed.tsquery).toContain("speech:* <-> restoration:*");
  });

  it("interprets noninvasive devices for stroke rehabilitation", () => {
    const parsed = parseQuery("noninvasive devices for stroke rehabilitation");
    expect(values(parsed, "invasiveness")).toEqual(["noninvasive"]);
    expect(values(parsed, "category")).toEqual(["devices"]);
    expect(parsed.terms).toEqual(["stroke rehabilitation"]);
  });

  it("interprets retinal prostheses tested in humans", () => {
    const parsed = parseQuery("retinal prostheses tested in humans");
    expect(values(parsed, "evidenceStage")).toEqual([
      "early_human_feasibility",
      "clinical_study",
      "regulatory_authorization",
      "clinical_or_commercial_use",
    ]);
    expect(parsed.terms).toEqual(["retinal prosthesis"]);
    expect(parsed.expansions[0]?.synonyms).toContain("retinal implant");
  });

  it("interprets companies working on peripheral nerve stimulation", () => {
    const parsed = parseQuery("companies working on peripheral nerve stimulation");
    expect(values(parsed, "category")).toEqual(["companies"]);
    expect(parsed.terms).toEqual(["peripheral nerve stimulation"]);
    expect(values(parsed, "modality")).toEqual([]);
  });

  it("interprets active clinical trials involving neural decoding", () => {
    const parsed = parseQuery("active clinical trials involving neural decoding");
    expect(values(parsed, "category")).toEqual(["clinical_trials"]);
    expect(values(parsed, "trialStatus")).toEqual([...ACTIVE_TRIAL_STATUSES]);
    expect(parsed.terms).toEqual(["neural decoding"]);
  });

  it("leaves 'active' as a content term without a nearby trial term", () => {
    const parsed = parseQuery("active electrode coating");
    expect(values(parsed, "trialStatus")).toEqual([]);
    expect(parsed.terms).toEqual(["active", "electrode", "coating"]);
  });

  it("keeps only the first category word as a filter", () => {
    const parsed = parseQuery("companies with devices");
    expect(values(parsed, "category")).toEqual(["companies"]);
    expect(parsed.terms).toEqual(["devices"]);
  });

  it("treats quoted text as an exact phrase that is neither interpreted nor expanded", () => {
    const parsed = parseQuery('"active recording" eeg');
    expect(parsed.phrases).toEqual(["active recording"]);
    expect(parsed.interpreted).toEqual([]);
    expect(parsed.terms).toEqual(["active recording", "eeg"]);
    expect(parsed.expansions[0]?.synonyms).toEqual([]);
    expect(parsed.tsquery).toContain("active:* <-> recording:*");
  });

  it("normalises unicode, curly quotes and apostrophes", () => {
    const parsed = parseQuery("Parkinson’s   disease – “deep brain stimulation”");
    expect(parsed.normalized).toBe('parkinsons disease "deep brain stimulation"');
    expect(parsed.terms).toEqual(["deep brain stimulation", "parkinson disease"]);
  });

  it("maps stimulation to both stimulation and combined modality", () => {
    expect(values(parseQuery("stimulation devices"), "modality")).toEqual(["stimulation", "both"]);
  });

  it("produces no terms and an empty tsquery for empty or stop-word-only input", () => {
    for (const q of ["", "   ", "the of and", '"the in"', "日本語"]) {
      const parsed = parseQuery(q);
      expect(parsed.terms).toEqual([]);
      expect(parsed.tsquery).toBe("");
    }
  });

  it("drops single characters and stop words but keeps digits", () => {
    expect(parseQuery("a 2024 x update").terms).toEqual(["2024", "update"]);
  });

  it("caps very long queries", () => {
    const parsed = parseQuery("word ".repeat(200));
    expect(parsed.normalized.length).toBeLessThanOrEqual(200);
    expect(parsed.terms).toEqual(["word"]);
  });

  it("builds a broadened OR query from the same groups", () => {
    const parsed = parseQuery("epilepsy ecog");
    expect(parsed.tsquery).toContain(" & ");
    expect(broadenedTsQuery(parsed)).not.toContain(" & ");
    expect(broadenedTsQuery(parsed)).toContain(") | (");
  });
});
