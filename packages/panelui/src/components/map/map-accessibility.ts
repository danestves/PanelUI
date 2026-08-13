import type { AccessibilityState } from 'react-native';

/** The nonvisual description of one feature in a GeoJSON-backed layer. */
export interface MapFeatureAccessibility {
  /** The feature's spoken name. */
  label: string;
  /** What activating the feature does, when the layer has `onPress`. */
  hint?: string;
  /** Selection, disabled, expanded, checked, or busy state. */
  state?: AccessibilityState;
}

export type MapFeatureAccessibilityDescription = MapFeatureAccessibility & {
  feature: unknown;
};

/**
 * Describes the features in inline GeoJSON without maintaining a second list.
 * URL sources cannot be read synchronously and remain decorative.
 */
export function describeMapFeatures(
  data: unknown,
  describe: (feature: unknown, index: number) => MapFeatureAccessibility
): MapFeatureAccessibilityDescription[] {
  const record = isRecord(data) ? data : null;
  const features =
    record?.type === 'FeatureCollection' && Array.isArray(record.features)
      ? record.features
      : record?.type === 'Feature'
        ? [data]
        : [];

  return features.map((feature, index) => ({
    feature,
    ...describe(feature, index),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
