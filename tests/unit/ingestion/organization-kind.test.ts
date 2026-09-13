import { describe, expect, it } from "vitest";
import { looksLikePersonName, sourceAllowsIndividuals } from "@/ingestion/stages/resolve-entities";

/**
 * Every name in these lists was pulled from NeuroBase's own review queue, where the old
 * heuristic had filed it. The organizations below were real losses: Boston Scientific
 * Neuromodulation and Medtronic Neuromodulation are two of the largest neurotechnology
 * businesses in the world, and neither was in the database.
 */
describe("looksLikePersonName", () => {
  it("recognises the individual investigators a registry can list as a sponsor", () => {
    for (const name of [
      "Ali Rezai",
      "Chen Li",
      "Jocelyne Bloch",
      "Kathleen Friel",
      "Jay C. Buckey Jr.",
      "Paolo Maria Rossini",
      "Halil Ibrahim Altun",
    ]) {
      expect(looksLikePersonName(name), name).toBe(true);
    }
  });

  it("does not mistake an organization for a person because of its stem", () => {
    // "neuro" and "institut" are stems, spelled short on purpose. A whole-word test made
    // every one of them unreachable, which is how these came to be filed as people.
    for (const name of [
      "Boston Scientific Neuromodulation",
      "Medtronic Neuromodulation",
      "Instituto Nacional de Rehabilitacion",
      "Auxilium Biotechnologies",
      "Centro Universitario La Salle",
      "Hospices Civils de Lyon",
      "Fondation Lenval",
      "Universitair Ziekenhuis Brussel",
    ]) {
      expect(looksLikePersonName(name), name).toBe(false);
    }
  });

  it("still refuses names carrying a legal suffix", () => {
    for (const name of ["Neuralink Corp", "Synchron Inc", "Paradromics Ltd"]) {
      expect(looksLikePersonName(name), name).toBe(false);
    }
  });

  it("does not let a legal suffix match inside an ordinary surname", () => {
    // Matched as prefixes, "co", "sa" and "ab" would swallow these.
    for (const name of ["Daniel Cohen", "Maria Sanders", "Yusuf Abdul"]) {
      expect(looksLikePersonName(name), name).toBe(true);
    }
  });
});

describe("sourceAllowsIndividuals", () => {
  it("allows an individual only where a registry can actually list one", () => {
    expect(sourceAllowsIndividuals("clinical_trial_registry")).toBe(true);
  });

  it("refuses the question for a device regulator", () => {
    // The applicant on a 510(k) or PMA is the corporate entity holding the clearance.
    // Asking the name-shape question here produced a false positive every time it fired.
    expect(sourceAllowsIndividuals("government_database")).toBe(false);
    expect(sourceAllowsIndividuals("peer_reviewed_paper")).toBe(false);
  });

  it("keeps every FDA applicant that the old heuristic rejected", () => {
    for (const name of [
      "Biomet Spine",
      "Boston Scientific Neuromodulation",
      "Cochlear Americas",
      "Depuy Mitek",
      "Medtronic Neuromodulation",
      "Medtronic Sofamor Danek",
      "Medtronic Vascular",
      "Midwest Development",
      "Mitek Products",
      "Nicolet Biomedical Instruments",
      "Relievant Medsystems",
    ]) {
      const filedAsPerson =
        sourceAllowsIndividuals("government_database") && looksLikePersonName(name);
      expect(filedAsPerson, name).toBe(false);
    }
  });
});
