/**
 * Map — a themed vector map.
 *
 * Everything visible is built from theme tokens rather than shipped as a
 * finished style, so the map belongs to whatever theme is active instead of
 * being the one rectangle on the screen that stayed grey. See `basemap.ts` for
 * how the style is assembled; the short version is that the tiles are bought
 * and the colours are ours.
 *
 * ```tsx
 * <Map center={[-0.12, 51.5]} zoom={11}>
 *   <Map.Marker lngLat={[-0.12, 51.5]}>
 *     <Map.Popup>
 *       <Text weight="medium">Charing Cross</Text>
 *     </Map.Popup>
 *   </Map.Marker>
 *   <Map.Controls locate />
 * </Map>
 * ```
 *
 * The renderer is native and optional, so `Map` has a state no other component
 * here does: it may be unable to draw at all. It says so in place rather than
 * throwing, because the usual way to reach that state is running in a client
 * that cannot load native modules, and a screen explaining the build you need
 * is more use than a stack trace.
 *
 * `Map.Popup` reads its position from the marker it sits inside, the way a
 * frame's title reads its weight from its slot. Given a `lngLat` of its own it
 * anchors to that coordinate instead, so the same name covers both the popup
 * attached to a pin and the one floating over a place with no pin at all.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { tv } from 'tailwind-variants';
import { CompassIcon, CrosshairIcon, MinusIcon, PlusIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import {
  buildBasemapStyle,
  CARTO_SOURCE,
  type BasemapSource,
  type BasemapTokens,
} from './basemap';
import {
  hasMapLibre,
  MapLibre,
  type CameraRef,
  type LngLat,
  type LngLatBounds,
  type MapRef,
  type StyleSpecification,
  type ViewState,
} from './maplibre';

export { hasMapLibre, CARTO_SOURCE };
export type { BasemapSource, BasemapTokens, LngLat, LngLatBounds, ViewState };

const mapVariants = tv({
  slots: {
    root: 'flex-1 overflow-hidden',
    controls: 'absolute gap-2',
    // A control group is one surface split by hairlines rather than separate
    // buttons: at 36pt a gap between them reads as damage, not as spacing.
    group: 'overflow-hidden rounded-xl border border-border bg-card shadow-sm',
    control: 'h-9 w-9 items-center justify-center active:bg-muted',
    popup: 'rounded-xl border border-border bg-popover px-3 py-2 shadow-lg',
    pin: 'h-3.5 w-3.5 rounded-full border-2 border-background bg-primary shadow-md',
  },
  variants: {
    position: {
      'top-left': { controls: 'left-3 top-3' },
      'top-right': { controls: 'right-3 top-3' },
      'bottom-left': { controls: 'bottom-3 left-3' },
      'bottom-right': { controls: 'bottom-3 right-3' },
    },
  },
  defaultVariants: { position: 'bottom-right' },
});

export type MapControlsPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** Reads a theme token, falling back when it resolves to something unusable. */
function useToken(name: string, fallback: string): string {
  const value = useCSSVariable(name);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

interface MapContextValue {
  mapRef: React.RefObject<MapRef | null>;
  cameraRef: React.RefObject<CameraRef | null>;
  /** The style has loaded and the map is drawing. */
  ready: boolean;
}

const MapContext = createContext<MapContextValue | null>(null);

/**
 * The map's camera and view state, from inside it.
 *
 * For a control, an overlay, or anything that has to move the map in response
 * to something that is not a gesture on it.
 */
export function useMap(): MapContextValue {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMap must be used inside a <Map>.');
  return context;
}

/** Set by `Map.Marker`, so a popup inside one knows where it is. */
const MarkerContext = createContext<LngLat | null>(null);

export interface MapHandle {
  /** Move the camera, animating unless `duration` is 0. */
  flyTo(options: { center: LngLat; zoom?: number; duration?: number }): void;
  /** Frame a bounding box, leaving `padding` points around it. */
  fitBounds(bounds: LngLatBounds, padding?: number): void;
  /** Where the map is looking right now. */
  getViewState(): Promise<ViewState | null>;
}

export interface MapProps extends Omit<ViewProps, 'children'> {
  children?: ReactNode;
  /** Initial centre, `[longitude, latitude]`. */
  center?: LngLat;
  /** Initial zoom. 0 is the whole world; 18 is a building. */
  zoom?: number;
  /** Initial bearing in degrees, clockwise from north. */
  bearing?: number;
  /** Initial tilt in degrees. 0 looks straight down. */
  pitch?: number;
  /**
   * Frame these bounds instead of centring — `[west, south, east, north]`.
   * Wins over `center` and `zoom` when both are given.
   */
  bounds?: LngLatBounds;
  /**
   * Drop the basemap and keep only the ground colour. For data that carries
   * its own geography — a choropleth, an arc diagram — where streets
   * underneath are noise rather than context.
   */
  blank?: boolean;
  /**
   * Where the vector tiles come from. Defaults to CARTO, which is free for
   * non-commercial use and licensed for everything else.
   */
  source?: BasemapSource;
  /**
   * Use this style wholesale instead of building one from tokens. The escape
   * hatch for a map that has to match something outside the app.
   */
  mapStyle?: string | StyleSpecification;
  /** Let the map rotate and tilt. Off by default — most maps only pan and zoom. */
  rotatable?: boolean;
  /** Turn off panning and zooming, for a map that is an illustration. */
  interactive?: boolean;
  /** Fires continuously while the map moves. */
  onViewStateChange?: (state: ViewState) => void;
  /** Fires when the map is pressed somewhere that is not a feature. */
  onPress?: (lngLat: LngLat) => void;
  /** Fires once the style has loaded and the first frame is drawn. */
  onReady?: () => void;
}

/**
 * Shown when the renderer is missing. Deliberately explicit about the cause:
 * "map unavailable" sends people looking at their network, and the actual
 * problem is almost always a build that never included the native module.
 */
function MapUnavailable({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex-1 items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-muted/25 p-6',
        className
      )}
      accessibilityRole="alert"
      {...props}
    >
      <Text size="sm" weight="medium">
        Map renderer not installed
      </Text>
      <Text size="xs" muted className="text-center">
        Map needs a development build. Install
        @maplibre/maplibre-react-native, add its config plugin, and rebuild —
        it cannot run in a client that loads no native modules.
      </Text>
    </View>
  );
}

const MapRoot = forwardRef<MapHandle, MapProps>(function MapRoot(
  {
    children,
    className,
    center,
    zoom = 2,
    bearing,
    pitch,
    bounds,
    blank = false,
    source = CARTO_SOURCE,
    mapStyle,
    rotatable = false,
    interactive = true,
    onViewStateChange,
    onPress,
    onReady,
    ...props
  },
  ref
) {
  const slots = mapVariants();
  const mapRef = useRef<MapRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const [ready, setReady] = useState(false);

  // Every colour the style needs, resolved from the active theme. Hooks run
  // unconditionally, so they sit above the renderer check rather than inside it.
  const tokens: BasemapTokens = {
    background: useToken('--color-background', '#ffffff'),
    water: useToken('--color-muted', 'rgba(0,0,0,0.06)'),
    land: useToken('--color-surface-secondary', 'rgba(0,0,0,0.04)'),
    building: useToken('--color-surface-tertiary', 'rgba(0,0,0,0.08)'),
    line: useToken('--color-border', 'rgba(0,0,0,0.1)'),
    label: useToken('--color-muted-foreground', '#686868'),
    labelHalo: useToken('--color-background', '#ffffff'),
  };

  const style = useMemo(
    () => mapStyle ?? buildBasemapStyle(tokens, { blank, source }),
    // The token object is rebuilt every render, so depend on its values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      mapStyle,
      blank,
      source,
      tokens.background,
      tokens.water,
      tokens.land,
      tokens.building,
      tokens.line,
      tokens.label,
      tokens.labelHalo,
    ]
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: ({ center: to, zoom: z, duration = 900 }) =>
        cameraRef.current?.flyTo({ center: to, zoom: z, duration }),
      fitBounds: (box, padding = 48) =>
        cameraRef.current?.fitBounds(
          [box[2], box[3]],
          [box[0], box[1]],
          padding,
          900
        ),
      getViewState: async () => (await mapRef.current?.getViewState()) ?? null,
    }),
    []
  );

  const context = useMemo(() => ({ mapRef, cameraRef, ready }), [ready]);

  if (!hasMapLibre || !MapLibre) {
    return <MapUnavailable className={className} {...props} />;
  }

  const { Map: MapLibreMap, Camera } = MapLibre;

  return (
    <View className={slots.root({ className })} {...props}>
      <MapContext.Provider value={context}>
        <MapLibreMap
          ref={mapRef}
          mapStyle={style}
          style={{ flex: 1 }}
          // The library's own ornaments are turned off across the board:
          // they are drawn by the renderer in its own style and cannot be
          // themed, so `Map.Controls` replaces them with views that can.
          logo={false}
          compass={false}
          attribution={false}
          scaleBar={false}
          dragPan={interactive}
          touchZoom={interactive}
          touchRotate={rotatable}
          touchPitch={rotatable}
          onDidFinishLoadingMap={() => {
            setReady(true);
            onReady?.();
          }}
          onRegionDidChange={
            onViewStateChange
              ? (event) => onViewStateChange(event.nativeEvent)
              : undefined
          }
          onPress={
            onPress
              ? (event) => onPress(event.nativeEvent.coordinates)
              : undefined
          }
        >
          <Camera
            ref={cameraRef}
            defaultSettings={
              bounds
                ? { bounds }
                : { center: center ?? [0, 20], zoom, bearing, pitch }
            }
          />
          {children}
        </MapLibreMap>
      </MapContext.Provider>
    </View>
  );
});
MapRoot.displayName = 'Map';

export interface MapMarkerProps {
  /** Where the marker sits, `[longitude, latitude]`. */
  lngLat: LngLat;
  /**
   * Which part of the marker sits on the coordinate. A pin drawn above its
   * point wants `bottom`; a dot centred on it wants the default.
   */
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  /** Pressing the marker. Adds a button role when given. */
  onPress?: () => void;
  className?: string;
  /** Defaults to a dot. Anything else replaces it. */
  children?: ReactNode;
}

/**
 * A point on the map, drawn as React views rather than as a style layer — so
 * it can be anything the rest of the library can draw. For hundreds of points
 * use `Map.Cluster` instead: a view per marker stops being affordable long
 * before the map stops being readable.
 */
function MapMarker({
  lngLat,
  anchor = 'center',
  onPress,
  className,
  children,
}: MapMarkerProps) {
  const slots = mapVariants();

  if (!MapLibre) return null;
  const { Marker } = MapLibre;

  const body = (
    <View className={cn('items-center', className)}>
      {children ?? <View className={slots.pin()} />}
    </View>
  );

  return (
    <MarkerContext.Provider value={lngLat}>
      <Marker lngLat={lngLat} anchor={anchor}>
        {onPress ? (
          <Pressable accessibilityRole="button" onPress={onPress}>
            {body}
          </Pressable>
        ) : (
          body
        )}
      </Marker>
    </MarkerContext.Provider>
  );
}
MapMarker.displayName = 'Map.Marker';

export interface MapLabelProps {
  children?: ReactNode;
  className?: string;
  /** Which side of the marker the label sits on. */
  side?: 'top' | 'bottom';
}

/**
 * A caption pinned to a marker. Always visible, unlike a popup — for the
 * handful of places whose names are the point of the map.
 */
function MapLabel({ children, className, side = 'bottom' }: MapLabelProps) {
  return (
    <View
      className={cn(
        'rounded-md bg-background/85 px-1.5 py-0.5',
        side === 'top' ? 'mb-1' : 'mt-1',
        className
      )}
    >
      {typeof children === 'string' ? (
        <Text size="xs" weight="medium">
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
MapLabel.displayName = 'Map.Label';

export interface MapPopupProps {
  children?: ReactNode;
  className?: string;
  /** Heading above the content. Strings are wrapped for you. */
  title?: string;
  /**
   * Anchor to this coordinate instead of to an enclosing marker. Required when
   * the popup is not inside one.
   */
  lngLat?: LngLat;
}

/**
 * A card anchored to a point.
 *
 * Inside a `Map.Marker` it attaches to that marker and opens when it is
 * pressed. Given a `lngLat` it stands alone at that coordinate — the same
 * component either way, because the difference is where it is anchored rather
 * than what it is.
 */
function MapPopup({ children, className, title, lngLat }: MapPopupProps) {
  const slots = mapVariants();
  const markerLngLat = useContext(MarkerContext);
  const coordinate = lngLat ?? markerLngLat;

  if (!MapLibre) return null;
  const { Callout, Marker } = MapLibre;

  const body = (
    <View className={slots.popup({ className })}>
      {title ? (
        <Text size="sm" weight="medium">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );

  // Inside a marker the renderer owns the show/hide, so this is a Callout.
  // Standalone it is its own marker, because a callout with nothing to hang
  // off has nowhere to be.
  if (markerLngLat && !lngLat) return <Callout>{body}</Callout>;
  if (!coordinate) return null;

  return (
    <Marker lngLat={coordinate} anchor="bottom">
      {body}
    </Marker>
  );
}
MapPopup.displayName = 'Map.Popup';

export interface MapControlsProps {
  /** Which corner the stack sits in. */
  position?: MapControlsPosition;
  /** Zoom in and out. On by default — it is the one control a map always needs. */
  zoom?: boolean;
  /** Recentre on the device's location. Needs a location permission. */
  locate?: boolean;
  /** Reset bearing and pitch to north and flat. */
  compass?: boolean;
  className?: string;
  /** Called with the located coordinate, so a caller can react to it. */
  onLocate?: (lngLat: LngLat) => void;
}

function ControlButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const slots = mapVariants();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={slots.control()}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

/**
 * The map's own chrome, as themed views.
 *
 * The renderer draws its own zoom and compass ornaments, but in its style
 * rather than the app's, and they cannot be recoloured — so they are turned
 * off in `Map` and replaced here by buttons built from the same tokens as
 * every other control in the library.
 */
function MapControls({
  position = 'bottom-right',
  zoom = true,
  locate = false,
  compass = false,
  className,
  onLocate,
}: MapControlsProps) {
  const slots = mapVariants({ position });
  const { mapRef, cameraRef } = useMap();

  // Read the live zoom rather than tracking it in state: the map is moved by
  // gestures too, and a counter kept alongside it drifts on the first pinch.
  const nudgeZoom = useCallback(
    async (delta: number) => {
      const map = mapRef.current;
      const camera = cameraRef.current;
      if (!map || !camera) return;
      const [center, current] = await Promise.all([
        map.getCenter(),
        map.getZoom(),
      ]);
      camera.easeTo({
        center,
        zoom: Math.min(22, Math.max(0, current + delta)),
        duration: 250,
      });
    },
    [mapRef, cameraRef]
  );

  const handleLocate = useCallback(async () => {
    let position$: { coords: { longitude: number; latitude: number } } | null =
      null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const location = require('expo-location');
      const granted = await location.requestForegroundPermissionsAsync();
      if (!granted?.granted) return;
      position$ = await location.getCurrentPositionAsync({});
    } catch {
      return;
    }
    if (!position$) return;
    const lngLat: LngLat = [
      position$.coords.longitude,
      position$.coords.latitude,
    ];
    cameraRef.current?.flyTo({ center: lngLat, zoom: 14, duration: 900 });
    onLocate?.(lngLat);
  }, [cameraRef, onLocate]);

  const resetNorth = useCallback(async () => {
    const center = await mapRef.current?.getCenter();
    if (!center) return;
    cameraRef.current?.easeTo({ center, bearing: 0, pitch: 0, duration: 300 });
  }, [mapRef, cameraRef]);

  return (
    <View className={slots.controls({ className })}>
      {zoom ? (
        <View className={slots.group()}>
          <ControlButton label="Zoom in" onPress={() => nudgeZoom(1)}>
            <PlusIcon size={16} />
          </ControlButton>
          <View className="h-px bg-border" />
          <ControlButton label="Zoom out" onPress={() => nudgeZoom(-1)}>
            <MinusIcon size={16} />
          </ControlButton>
        </View>
      ) : null}
      {compass ? (
        <View className={slots.group()}>
          <ControlButton label="Face north" onPress={resetNorth}>
            <CompassIcon size={16} />
          </ControlButton>
        </View>
      ) : null}
      {locate ? (
        <View className={slots.group()}>
          <ControlButton label="Show my location" onPress={handleLocate}>
            <CrosshairIcon size={16} />
          </ControlButton>
        </View>
      ) : null}
    </View>
  );
}
MapControls.displayName = 'Map.Controls';

/** Turns a token into a colour a style layer can use. */
function useLineColor(color?: string) {
  const fallback = useToken('--color-primary', '#262626');
  return color ?? fallback;
}

export interface MapRouteProps {
  /** The path, in order. */
  coordinates: LngLat[];
  /** Defaults to the primary token. */
  color?: string;
  /** Line thickness in points. */
  width?: number;
  /** Draw it dashed — for a leg that is planned rather than travelled. */
  dashed?: boolean;
  /** 0 is invisible, 1 is solid. */
  opacity?: number;
  id?: string;
}

/**
 * A path across the map, drawn as a style layer rather than as views — so its
 * cost does not grow with the number of points in it.
 */
function MapRoute({
  coordinates,
  color,
  width = 3,
  dashed = false,
  opacity = 1,
  id = 'route',
}: MapRouteProps) {
  const stroke = useLineColor(color);
  const data = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    }),
    [coordinates]
  );

  if (!MapLibre) return null;
  const { GeoJSONSource, Layer } = MapLibre;

  return (
    <GeoJSONSource id={`${id}-source`} data={data} lineMetrics>
      <Layer
        id={id}
        type="line"
        style={{
          lineColor: stroke,
          lineWidth: width,
          lineOpacity: opacity,
          lineCap: 'round',
          lineJoin: 'round',
          ...(dashed ? { lineDasharray: [2, 1.5] } : {}),
        }}
      />
    </GeoJSONSource>
  );
}
MapRoute.displayName = 'Map.Route';

export interface MapArcProps {
  /** Where the arc starts. */
  from: LngLat;
  /** Where it ends. */
  to: LngLat;
  /** How far it bows. 0 is a straight line; 0.2 is the default lift. */
  curvature?: number;
  color?: string;
  width?: number;
  opacity?: number;
  id?: string;
}

/**
 * A curved connection between two points.
 *
 * The curve is not geography — a great circle between two cities is not bowed
 * on a flat projection. It is there so that two arcs sharing an endpoint stay
 * tellable apart, which a bundle of straight lines through one city does not.
 */
function MapArc({
  from,
  to,
  curvature = 0.2,
  color,
  width = 2,
  opacity = 0.9,
  id = 'arc',
}: MapArcProps) {
  const stroke = useLineColor(color);

  const data = useMemo(() => {
    // A quadratic Bézier whose control point is pushed off the midpoint
    // perpendicular to the line, so the bow scales with the distance rather
    // than being a fixed lift that vanishes on long hops.
    const [x1, y1] = from;
    const [x2, y2] = to;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const controlX = midX - (y2 - y1) * curvature;
    const controlY = midY + (x2 - x1) * curvature;

    const SEGMENTS = 64;
    const coordinates: LngLat[] = [];
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const t = i / SEGMENTS;
      const inv = 1 - t;
      coordinates.push([
        inv * inv * x1 + 2 * inv * t * controlX + t * t * x2,
        inv * inv * y1 + 2 * inv * t * controlY + t * t * y2,
      ]);
    }
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    };
  }, [from, to, curvature]);

  if (!MapLibre) return null;
  const { GeoJSONSource, Layer } = MapLibre;

  return (
    <GeoJSONSource id={`${id}-source`} data={data} lineMetrics>
      <Layer
        id={id}
        type="line"
        style={{
          lineColor: stroke,
          lineWidth: width,
          lineOpacity: opacity,
          lineCap: 'round',
        }}
      />
    </GeoJSONSource>
  );
}
MapArc.displayName = 'Map.Arc';

export interface MapGeoJSONProps {
  /** A Feature, FeatureCollection, or the URL of one. */
  data: unknown;
  /** Fill colour for polygons. A style expression works here too. */
  fill?: string | unknown[];
  /** Outline colour. Defaults to the border token. */
  stroke?: string | unknown[];
  /** Outline thickness. */
  strokeWidth?: number;
  /** 0 is invisible, 1 is solid. */
  fillOpacity?: number;
  /** Fires with the pressed feature. */
  onPress?: (feature: unknown) => void;
  id?: string;
}

/**
 * Arbitrary geography as a themed layer — the component behind a choropleth,
 * a coverage area, or any other shape that comes from data rather than from
 * the basemap.
 *
 * `fill` takes a style expression as well as a colour, which is what makes a
 * choropleth one layer instead of one layer per bucket.
 */
function MapGeoJSON({
  data,
  fill,
  stroke,
  strokeWidth = 1,
  fillOpacity = 0.7,
  onPress,
  id = 'geojson',
}: MapGeoJSONProps) {
  const defaultFill = useToken('--color-primary', '#262626');
  const defaultStroke = useToken('--color-border', 'rgba(0,0,0,0.1)');

  if (!MapLibre) return null;
  const { GeoJSONSource, Layer } = MapLibre;

  return (
    <GeoJSONSource
      id={`${id}-source`}
      data={data}
      onPress={
        onPress
          ? (event) => onPress(event.nativeEvent.features?.[0])
          : undefined
      }
    >
      <Layer
        id={`${id}-fill`}
        type="fill"
        style={{
          fillColor: fill ?? defaultFill,
          fillOpacity,
        }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        style={{
          lineColor: stroke ?? defaultStroke,
          lineWidth: strokeWidth,
        }}
      />
    </GeoJSONSource>
  );
}
MapGeoJSON.displayName = 'Map.GeoJSON';

export interface MapClusterProps {
  /** Point features to cluster. */
  data: unknown;
  /** Defaults to the primary token. */
  color?: string;
  /** Text colour inside a cluster bubble. */
  textColor?: string;
  /** How close two points have to be, in points, to merge. */
  radius?: number;
  /** Above this zoom every point stands alone. */
  maxZoom?: number;
  /** Fires with the pressed cluster or point. */
  onPress?: (feature: unknown) => void;
  id?: string;
}

/**
 * Dense points, merged as they get too close to tell apart.
 *
 * This is the layer to reach for past a few dozen points: `Map.Marker` mounts
 * a React view each, which a thousand points cannot afford, and a thousand
 * overlapping pins would be unreadable even if it could.
 */
function MapCluster({
  data,
  color,
  textColor,
  radius = 50,
  maxZoom = 14,
  onPress,
  id = 'cluster',
}: MapClusterProps) {
  const fill = useToken('--color-primary', '#262626');
  const onFill = useToken('--color-primary-foreground', '#fafafa');
  const bubble = color ?? fill;
  const ink = textColor ?? onFill;

  if (!MapLibre) return null;
  const { GeoJSONSource, Layer } = MapLibre;

  return (
    <GeoJSONSource
      id={`${id}-source`}
      data={data}
      cluster
      clusterRadius={radius}
      clusterMaxZoom={maxZoom}
      onPress={
        onPress
          ? (event) => onPress(event.nativeEvent.features?.[0])
          : undefined
      }
    >
      {/* Bubbles grow in steps rather than continuously: the point is to read
          "more than that one", not to estimate a count from an area. */}
      <Layer
        id={`${id}-bubble`}
        type="circle"
        filter={['has', 'point_count']}
        style={{
          circleColor: bubble,
          circleRadius: ['step', ['get', 'point_count'], 16, 25, 22, 100, 28],
          circleStrokeWidth: 2,
          circleStrokeColor: ink,
          circleStrokeOpacity: 0.25,
        }}
      />
      <Layer
        id={`${id}-count`}
        type="symbol"
        filter={['has', 'point_count']}
        style={{
          textField: ['get', 'point_count_abbreviated'],
          textSize: 12,
          textColor: ink,
        }}
      />
      <Layer
        id={`${id}-point`}
        type="circle"
        filter={['!', ['has', 'point_count']]}
        style={{
          circleColor: bubble,
          circleRadius: 6,
          circleStrokeWidth: 2,
          circleStrokeColor: ink,
          circleStrokeOpacity: 0.4,
        }}
      />
    </GeoJSONSource>
  );
}
MapCluster.displayName = 'Map.Cluster';

export interface MapUserLocationProps {
  /** Show which way the device is facing, not just where it is. */
  heading?: boolean;
}

/** The device's own position, drawn by the renderer. */
function MapUserLocation({ heading = false }: MapUserLocationProps) {
  if (!MapLibre) return null;
  const { UserLocation } = MapLibre;
  return <UserLocation visible showsUserHeadingIndicator={heading} />;
}
MapUserLocation.displayName = 'Map.UserLocation';

export const Map = Object.assign(MapRoot, {
  Marker: MapMarker,
  Label: MapLabel,
  Popup: MapPopup,
  Controls: MapControls,
  Route: MapRoute,
  Arc: MapArc,
  GeoJSON: MapGeoJSON,
  Cluster: MapCluster,
  UserLocation: MapUserLocation,
});
