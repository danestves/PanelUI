/**
 * The bridge to MapLibre.
 *
 * A map is the one component here that cannot be drawn in JavaScript. It needs
 * a renderer with the tiles, the projection and the GPU work already solved,
 * and that renderer is native code — which means `Map` is the only component
 * in the library with a dependency you have to build for.
 *
 * Two things follow, and both are handled here rather than spread through the
 * component:
 *
 * The package is resolved lazily and once. A project that never renders a map
 * installs nothing, and the failure when it is missing is a readable fallback
 * rather than a red screen — which matters because the most common way to hit
 * it is running in a client that cannot load native modules at all.
 *
 * The types are declared here rather than imported from the package. They are
 * structural and cover only what is used. Importing them would put the package
 * in the library's published type surface, so anyone installing PanelUI would
 * have to install a map renderer to typecheck their project, whether or not
 * they ever draw a map.
 *
 * The cost of that choice is that nothing checks these declarations against the
 * renderer, and React Native drops props it does not recognise without a word —
 * so a renamed prop is silently ignored rather than caught. They track the
 * renderer's **v11** API. When the peer range widens, re-read the props used
 * below against the package rather than assuming they survived.
 */
import type { ComponentType, ReactElement, ReactNode, Ref } from 'react';

/** `[longitude, latitude]` — the order the style spec uses, not the spoken one. */
export type LngLat = [number, number];

/** `[west, south, east, north]`. */
export type LngLatBounds = [number, number, number, number];

/**
 * A MapLibre style document. Left loose on purpose: the spec is large, it is
 * versioned separately from this library, and the parts of it callers pass
 * through are exactly the parts a narrower type would get in the way of.
 */
export type StyleSpecification = Record<string, unknown>;

/** Where the map is looking. */
export interface ViewState {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: LngLatBounds;
}

export interface MapRef {
  getCenter(): Promise<LngLat>;
  getZoom(): Promise<number>;
  getBearing(): Promise<number>;
  getPitch(): Promise<number>;
  getBounds(): Promise<LngLatBounds>;
  getViewState(): Promise<ViewState>;
}

/** Pixel insets held off the edges of the viewport. */
export interface ViewPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** Zoom, tilt and rotation — everything about the camera except where it sits. */
export interface CameraOptions {
  zoom?: number;
  bearing?: number;
  pitch?: number;
  padding?: ViewPadding;
}

/** How the camera gets there. */
export interface CameraAnimationOptions {
  duration?: number;
  easing?: 'linear' | 'ease' | 'fly';
}

/**
 * Where the camera starts. Either a centre or a box, never both — the renderer
 * types them as a union for the same reason: a camera framing a box has no
 * separate centre to honour.
 */
export type InitialViewState =
  | (CameraOptions & { center?: never; bounds?: never })
  | (CameraOptions & { center: LngLat; bounds?: never })
  | (CameraOptions & { bounds: LngLatBounds; center?: never });

export interface CameraRef {
  jumpTo(options: { center: LngLat } & CameraOptions): void;
  easeTo(options: { center?: LngLat } & CameraOptions & CameraAnimationOptions): void;
  flyTo(options: { center?: LngLat } & CameraOptions & CameraAnimationOptions): void;
  fitBounds(
    bounds: LngLatBounds,
    options?: CameraOptions & CameraAnimationOptions
  ): void;
}

/** A native event as it arrives — the payload is under `nativeEvent`. */
export interface NativeEvent<T> {
  nativeEvent: T;
}

interface MapLibreModule {
  Map: ComponentType<{
    ref?: Ref<MapRef>;
    mapStyle: string | StyleSpecification;
    style?: unknown;
    logo?: boolean;
    compass?: boolean;
    attribution?: boolean;
    scaleBar?: boolean;
    dragPan?: boolean;
    touchZoom?: boolean;
    touchRotate?: boolean;
    touchPitch?: boolean;
    onPress?: (event: NativeEvent<{ coordinates: LngLat }>) => void;
    onDidFinishLoadingMap?: () => void;
    onRegionDidChange?: (event: NativeEvent<ViewState>) => void;
    children?: ReactNode;
  }>;
  Camera: ComponentType<{
    ref?: Ref<CameraRef>;
    /**
     * The camera's opening position. Applied once, on the first frame — every
     * move after this one goes through the ref, so a re-render never yanks the
     * map back out from under a gesture.
     */
    initialViewState?: InitialViewState;
    center?: LngLat;
    bounds?: LngLatBounds;
    zoom?: number;
    bearing?: number;
    pitch?: number;
    minZoom?: number;
    maxZoom?: number;
    maxBounds?: LngLatBounds;
    padding?: ViewPadding;
  }>;
  Marker: ComponentType<{
    id?: string;
    lngLat: LngLat;
    anchor?: string;
    children: ReactElement;
  }>;
  Callout: ComponentType<{ title?: string; children?: ReactNode; style?: unknown }>;
  GeoJSONSource: ComponentType<{
    id?: string;
    data: unknown;
    cluster?: boolean;
    clusterRadius?: number;
    clusterMaxZoom?: number;
    lineMetrics?: boolean;
    onPress?: (event: NativeEvent<{ features: unknown[] }>) => void;
    children?: ReactNode;
  }>;
  Layer: ComponentType<Record<string, unknown>>;
  UserLocation: ComponentType<{
    animated?: boolean;
    accuracy?: boolean;
    heading?: boolean;
    minDisplacement?: number;
    onPress?: () => void;
    children?: ReactNode;
  }>;
}

/**
 * The renderer, or null when it is not installed. Resolved once at module
 * load — the require is cheap, and caching it keeps a try/catch out of render.
 */
const maplibre: MapLibreModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@maplibre/maplibre-react-native') as MapLibreModule;
  } catch {
    return null;
  }
})();

/**
 * True when a map can actually be drawn.
 *
 * False in any client that cannot load native modules, and in any project that
 * has not installed the renderer. Worth checking before routing somewhere whose
 * whole content is a map.
 */
export const hasMapLibre = maplibre !== null;

/**
 * The renderer's components, or null.
 *
 * Returned as one object rather than as separate exports so a caller destructures
 * once after a single null check, instead of narrowing each component in turn.
 */
export const MapLibre = maplibre;
