import { test } from "node:test";
import assert from "node:assert/strict";
import { createSizingConfiguration, moveSizingPoint, sizingConstraint, sizingCurve, sizingTokens, type ThreePoints, type SizingPrecision } from "../src/nuance/domain/sizing";
import { createSizingStudy, deserializeFormStudy, readFormStudy, serializeFormStudy } from "../src/nuance/domain/formStudies";
import { readSavedFormStudy } from "../src/nuance/account/formStudyRepository";

const id = "33333333-3333-4333-8333-333333333333";
const curves: ThreePoints[] = [[0, 0, 0], [1, 1, 1], [0, 0.5, 1], [0.01, 0.99, 0.99], [0.0625, 0.25, 0.5625]];

test("snapping reserves distinct positive tokens, preserves zero and fixes the exact maximum", () => {
  for (const precision of [1, 2, 4] as SizingPrecision[]) {
    for (let steps = 6; steps <= 12; steps++) {
      for (const maxSize of [steps * precision, (steps + 1) * precision, 128, 4096]) {
        for (const points of curves) {
          const tokens = sizingTokens({ ...createSizingConfiguration(), maxSize, precision, steps, points });
          assert.equal(tokens.length, steps + 1);
          assert.deepEqual(tokens[0], { name: "size-0", value: 0 });
          assert.deepEqual(tokens.at(-1), { name: `size-${steps}`, value: maxSize });
          tokens.forEach((token, index) => {
            assert.equal(token.value % precision, 0);
            assert.ok(token.value <= maxSize);
            assert.equal(token.name, `size-${index}`);
            if (index) assert.ok(token.value > tokens[index - 1].value);
          });
        }
      }
    }
  }
});

test("uncontested values snap to nearest precision increments", () => {
  const configuration = { ...createSizingConfiguration(), points: [0.25, 0.5, 0.75] as ThreePoints, maxSize: 104 };
  assert.equal(sizingTokens({ ...configuration, precision: 1 })[1].value, 10);
  assert.equal(sizingTokens({ ...configuration, precision: 2 })[1].value, 10);
  assert.equal(sizingTokens({ ...configuration, precision: 4 })[1].value, 12);
  assert.ok(sizingConstraint(38, 4, 10));
  assert.ok(sizingConstraint(40, 4, 11));
  assert.ok(sizingConstraint(130, 4, 10));
  assert.ok(sizingConstraint(128, 2, 13));
  assert.ok(sizingConstraint(Number.NaN, 1, 10));
  assert.throws(() => sizingTokens({ ...configuration, precision: 4, maxSize: 130 }), /multiple/);
});

test("uneven horizontal knot positions preserve smooth ordered curves and control point interpolation", () => {
  for (const points of curves) {
    for (const positions of [[0.04, 0.08, 0.12], [0.04, 0.5, 0.96], [0.88, 0.92, 0.96]] as ThreePoints[]) {
      let previous = 0;
      for (let i = 0; i <= 1000; i++) {
        const next = sizingCurve(points, i / 1000, positions);
        assert.ok(Number.isFinite(next) && next >= previous - 1e-10 && next >= -1e-10 && next <= 1 + 1e-10);
        previous = next;
      }
      positions.forEach((x, index) => assert.ok(Math.abs(sizingCurve(points, x, positions) - points[index]) < 1e-10));
    }
  }
  const original = createSizingConfiguration();
  const moved = moveSizingPoint(original, 1, 2, -2);
  assert.equal(moved.points[1], original.points[2]);
  assert.ok(Math.abs(moved.positions[1] - (original.positions[0] + 0.04)) < 1e-10);
  assert.deepEqual(original.positions, [0.25, 0.5, 0.75]);
});

test("changing steps and precision only resamples the existing continuous curve", () => {
  const original = createSizingConfiguration();
  const before = JSON.stringify(original);
  for (const steps of [6, 9, 12]) {
    const configuration = { ...original, steps };
    assert.equal(sizingTokens(configuration).length, steps + 1);
    for (let i = 0; i <= 100; i++) {
      assert.equal(sizingCurve(configuration.points, i / 100, configuration.positions), sizingCurve(original.points, i / 100, original.positions));
    }
  }
  assert.equal(JSON.stringify(original), before);
});

test("versioned Form studies round-trip exact source parameters and resolved output", () => {
  const configuration = moveSizingPoint({ ...createSizingConfiguration(), precision: 4, steps: 12 }, 1, 0.43, 0.62);
  const study = createSizingStudy(id, "  Spacious  ", configuration);
  assert.equal(study.name, "Spacious");
  assert.deepEqual(deserializeFormStudy(serializeFormStudy(study)), study);
  assert.deepEqual(study.resolvedTokens, sizingTokens(configuration));
  assert.deepEqual(readSavedFormStudy({ id, setting: "sizing", document: study, updated_at: "2026-11-23T12:00:00Z" }).document, study);
  configuration.points[0] = 0;
  assert.notEqual(study.values.points[0], configuration.points[0], "documents do not share mutable draft arrays");
  assert.throws(() => readFormStudy({ ...study, schemaVersion: 2 }), /format/);
  assert.throws(() => readFormStudy({ ...study, generatorVersion: "future" }), /newer/);
  assert.throws(() => readFormStudy({ ...study, name: " " }), /format/);
  assert.throws(() => readFormStudy({ ...study, values: { ...study.values, positions: [0.5, 0.4, 0.7] } }), /curve/);
  assert.throws(() => readFormStudy({ ...study, resolvedTokens: [] }), /token/);
  assert.throws(() => readSavedFormStudy({ id: crypto.randomUUID(), setting: "sizing", document: study, updated_at: "2026-11-23T12:00:00Z" }), /read/);
});
