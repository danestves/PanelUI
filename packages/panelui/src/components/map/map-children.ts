/**
 * Which of a map's children belong to the renderer, and which belong to us.
 *
 * The native map view is not a React Native container. On Android it is a real
 * `FrameLayout`, and it lays its children out itself — so an ordinary view
 * handed to it loses the frame the layout engine computed, arrives stretched
 * to the full size of the map, and covers the surface the map is drawn on. A
 * control group written to sit in a corner ends up in the top-left, full
 * bleed, with the map invisible behind it.
 *
 * So the children are split before they are mounted. Anything the renderer
 * understands — a marker, a route, a layer — goes inside it. Everything else,
 * including `Map.Controls` and any chrome written at the call site, is drawn
 * as a sibling above the map, where the layout engine still owns it.
 *
 * Parts opt in by carrying `MAP_LAYER`, so the rule is a property of the part
 * rather than a list kept somewhere else that a new part could be left out of.
 */
import { Children, isValidElement, type ReactNode } from 'react';

/** Marks a component that has to be mounted inside the native map view. */
export const MAP_LAYER = Symbol.for('panelui.map.layer');

type Layer = { [MAP_LAYER]?: true };

/** Tags a part as belonging inside the renderer, and hands it back. */
export function asMapLayer<T>(part: T): T {
  (part as T & Layer)[MAP_LAYER] = true;
  return part;
}

/** Whether an element type has been tagged with {@link asMapLayer}. */
export function isMapLayer(type: unknown): boolean {
  return (
    (typeof type === 'function' || typeof type === 'object') &&
    type !== null &&
    (type as Layer)[MAP_LAYER] === true
  );
}

export interface PartitionedMapChildren {
  /** Mounted inside the native map view. */
  layers: ReactNode[];
  /** Drawn as a sibling above it, where React Native's layout still applies. */
  overlay: ReactNode[];
}

/**
 * Splits a map's children into the two halves above.
 *
 * A child that is not an element at all — a string, a number, a nullish branch
 * — goes to the overlay. The renderer drops what it does not recognise, and
 * drops it *silently*, which also puts its own child bookkeeping out of step
 * with React's.
 */
export function partitionMapChildren(children: ReactNode): PartitionedMapChildren {
  const layers: ReactNode[] = [];
  const overlay: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child) && isMapLayer(child.type)) layers.push(child);
    else if (child !== null && child !== undefined && child !== false) overlay.push(child);
  });

  return { layers, overlay };
}
