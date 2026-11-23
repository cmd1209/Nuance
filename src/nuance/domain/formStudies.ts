import { FORM_SETTING_LABELS, type FormSettingId } from "./form";
import { MIN_POINT_DISTANCE, SIZING_GENERATOR_VERSION, sizingConstraint, sizingTokens, type SizingConfiguration } from "./sizing";

export const FORM_STUDY_SCHEMA_VERSION = 1;
export interface FormStudy<T = unknown> {
  schemaVersion: 1;
  id: string;
  setting: FormSettingId;
  name: string;
  generatorVersion: string;
  values: T;
  resolvedTokens: { name: string; value: number }[];
}
export type SizingStudy = FormStudy<SizingConfiguration> & { setting: "sizing" };
export interface SavedFormStudy { document: SizingStudy; updatedAt: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validStudyName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 80;
}

export function createSizingStudy(id: string, name: string, values: SizingConfiguration): SizingStudy {
  return readFormStudy({ schemaVersion: 1, id, setting: "sizing", name: name.trim(),
    generatorVersion: SIZING_GENERATOR_VERSION, values, resolvedTokens: sizingTokens(values) });
}

/** The shared envelope is versioned independently of each tool's generator. */
export function readFormStudy(raw: unknown): SizingStudy {
  if (!raw || typeof raw !== "object") throw new Error("This Form study could not be read.");
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== FORM_STUDY_SCHEMA_VERSION || typeof data.id !== "string" || !UUID.test(data.id)
    || typeof data.name !== "string" || !validStudyName(data.name)
    || typeof data.setting !== "string" || !(data.setting in FORM_SETTING_LABELS)) {
    throw new Error("This Form study has an unsupported format.");
  }
  if (data.setting !== "sizing" || data.generatorVersion !== SIZING_GENERATOR_VERSION) {
    throw new Error("This Form study requires a newer version of Nuance.");
  }
  const values = data.values as SizingConfiguration | undefined;
  if (!values || sizingConstraint(values.maxSize, values.precision, values.steps)
    || !Array.isArray(values.points) || values.points.length !== 3
    || !Array.isArray(values.positions) || values.positions.length !== 3) {
    throw new Error("This Form study contains invalid sizing settings.");
  }
  let previousY = 0, previousX = 0;
  for (let index = 0; index < 3; index++) {
    const y = values.points[index], x = values.positions[index];
    if (!Number.isFinite(y) || y < previousY || y > 1 || !Number.isFinite(x)
      || x - previousX < MIN_POINT_DISTANCE - 1e-10 || x > 1 - MIN_POINT_DISTANCE + 1e-10) {
      throw new Error("This Form study contains an invalid curve.");
    }
    previousY = y; previousX = x;
  }
  const resolvedTokens = sizingTokens(values);
  if (!Array.isArray(data.resolvedTokens) || data.resolvedTokens.length !== resolvedTokens.length
    || resolvedTokens.some((token, index) => {
      const stored = (data.resolvedTokens as Record<string, unknown>[])[index];
      return !stored || token.name !== stored.name || token.value !== stored.value;
    })) throw new Error("This Form study's token values do not match its curve.");
  return { schemaVersion: 1, id: data.id, name: data.name.trim(), setting: "sizing", generatorVersion: SIZING_GENERATOR_VERSION,
    values: { maxSize: values.maxSize, precision: values.precision, steps: values.steps,
      points: [...values.points], positions: [...values.positions] }, resolvedTokens };
}

export function serializeFormStudy(study: SizingStudy): string { return JSON.stringify(readFormStudy(study)); }
export function deserializeFormStudy(text: string): SizingStudy { return readFormStudy(JSON.parse(text)); }
