/**
 * Runs the shared, language-neutral test cases in spec/fixtures against this
 * implementation. haiku (Kotlin) and sutori run the same files.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { historyAfter, readEntity, type Entity } from "./entity";
import { reconcile, type ReconcileInput } from "./reconcile";

const fixtures = join(__dirname, "../../../spec/fixtures");
const load = (name: string) => JSON.parse(readFileSync(join(fixtures, name), "utf8"));

/** Check that `actual` has every field listed in `expected` (null = absent). */
function expectFields(actual: Record<string, unknown> | null, expected: Record<string, unknown>, where: string) {
  expect(actual, where).not.toBeNull();
  for (const [key, want] of Object.entries(expected)) {
    const got = actual![key];
    if (want === null) {
      expect(got, `${where}: ${key} should be absent`).toBeUndefined();
    } else if (key === "alternates" && Array.isArray(want)) {
      expect(Array.isArray(got), `${where}: alternates`).toBe(true);
      const alts = got as Record<string, unknown>[];
      expect(alts.length, `${where}: number of alternates`).toBe(want.length);
      want.forEach((w, i) => expectFields(alts[i], w as Record<string, unknown>, `${where}: alternate ${i}`));
    } else {
      expect(got, `${where}: ${key}`).toEqual(want);
    }
  }
}

describe("spec/fixtures/entities.json: reading files", () => {
  for (const c of load("entities.json").cases) {
    it(c.name, () => {
      const r = readEntity(c.input);
      expect(r.status).toBe(c.expect);
      if (r.status === "valid" && c.roundTripUnchanged) {
        expect(JSON.parse(JSON.stringify(r.entity))).toEqual(c.input);
      }
    });
  }
});

describe("spec/fixtures/reconcile.json: combining versions", () => {
  for (const c of load("reconcile.json").cases) {
    it(`${c.rule}: ${c.name}`, () => {
      const input = c.input as ReconcileInput;
      for (const side of [input.local, input.remote]) {
        if (side) expect(readEntity(side).status, "fixture items are valid").toBe("valid");
      }
      const out = reconcile(structuredClone(input));
      expect(out.action).toBe(c.expect.action);
      expect(out.parent).toBe(c.expect.parent);
      expect(out.notice).toBe(c.expect.notice);
      if (c.expect.result) expectFields(out.result as Entity, c.expect.result, c.name);
    });
  }
});

describe("spec/fixtures/history.json: recording history", () => {
  for (const c of load("history.json").cases) {
    it(c.name, () => expect(historyAfter(c.parent)).toEqual(c.expect));
  }
});
