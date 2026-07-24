/**
 * Flow — a canvas of nodes joined by edges, that you pan, pinch and rearrange
 * with a finger.
 *
 * ```tsx
 * <Flow>
 *   <Flow.Background variant="dots" />
 *   <Flow.Node id="db" position={{ x: 24, y: 40 }}>
 *     <Frame>…</Frame>
 *   </Flow.Node>
 *   <Flow.Node id="web" position={{ x: 220, y: 200 }}>
 *     <Frame>…</Frame>
 *   </Flow.Node>
 *   <Flow.Edge from="web" to="db" dashed animated />
 *   <Flow.Controls />
 * </Flow>
 * ```
 *
 * ## Where the positions live
 *
 * Every node's box is one entry in a single shared value, and nothing else
 * knows a position. Dragging a node rewrites that entry on the UI thread; the
 * node's transform and every edge's `d` string are derived from it in worklets
 * on the same thread. A drag is therefore zero React renders, however many
 * edges are attached — which is the difference between a graph that tracks a
 * finger and one that catches up afterwards.
 *
 * JavaScript hears about a drag once, when the finger lifts, through
 * `onNodeDragEnd`. Positions are otherwise yours to leave alone: pass
 * `position` once and the canvas takes it from there, or keep it in state and
 * pass it back to drive nodes from outside.
 *
 * ## Where the edges attach
 *
 * An edge names nodes, not coordinates: `from="web" to="db"`. Which face it
 * leaves and arrives on is worked out from where the two boxes currently are,
 * so a graph the user rearranges stays readable without anyone re-specifying
 * anything. Name a handle instead — `from="web.out"` — and it attaches there.
 *
 * ## Two gestures, one canvas
 *
 * The pane pans and pinches; a node drags; a handle draws a new connection.
 * They are nested gesture detectors rather than one gesture doing three jobs,
 * so the innermost thing under the finger wins, which is what a finger expects.
 */
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Marker,
  Path,
  Pattern,
  Rect,
} from 'react-native-svg';
import { tv } from 'tailwind-variants';
import { LockIcon, MaximizeIcon, MinusIcon, PlusIcon, UnlockIcon } from '../../icons';
import { AnimatedPressable } from '../../primitives/animated-pressable';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import {
  anchorOf,
  autoSides,
  edgePath,
  type FlowPoint,
  type FlowRect,
  type FlowSide,
} from './flow-paths';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const SPRING = { duration: 320, easing: Easing.out(Easing.cubic) } as const;

/**
 * Without this the transform pivots on the layer's centre, and every zoom
 * throws the graph across the screen.
 */
const TRANSFORM_ORIGIN = { transformOrigin: 'top left' } as const;

/** How many screens of grid to draw around the container in each direction. */
const GRID_SPAN = 4;

/**
 * An SVG is backed by a single texture, and a texture has a maximum size the
 * platform will allocate — past it, nothing is drawn at all rather than
 * something clipped. This keeps the grid comfortably under it at 3× device
 * scale, which is why the grid is the only thing sized in graph space.
 */
function clampCanvas(value: number): number {
  return Math.max(Math.min(value, 4000), 1);
}

/** How close a finger has to get to a handle for a connection to land. */
const CONNECT_RADIUS = 44;

export type FlowEdgeVariant = 'bezier' | 'smoothstep' | 'step' | 'straight';

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowNodePosition {
  x: number;
  y: number;
}

/** What `onConnect` is handed when a connection lands. */
export interface FlowConnection {
  /** Node the drag started from. */
  source: string;
  /** Handle it started from, when it started from one. */
  sourceHandle?: string;
  /** Node it was dropped on. */
  target: string;
  /** Handle it was dropped on, when it landed on one. */
  targetHandle?: string;
}

interface HandleEntry {
  key: string;
  node: string;
  id: string;
  side: FlowSide;
  offset: number;
  type: 'source' | 'target' | 'both';
}

interface FlowContextValue {
  /** Every node's box, in graph coordinates. The only copy that exists. */
  rects: SharedValue<Record<string, FlowRect>>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  zoom: SharedValue<number>;
  /** The connection being drawn, in graph coordinates. `active` is 0 or 1. */
  connection: SharedValue<{ active: number; x1: number; y1: number; x2: number; y2: number }>;
  size: SharedValue<{ width: number; height: number }>;
  /**
   * The same size as `size`, in React state. An `<Svg>` needs concrete width
   * and height props, which a shared value cannot supply — this changes once
   * per layout, not once per frame.
   */
  box: { width: number; height: number };
  /**
   * Half the node layer's extent. The layer is positioned at `-origin` and a
   * node translates by its graph position plus this, so graph (0, 0) still
   * lands where the container's top-left is.
   */
  origin: { x: number; y: number };
  minZoom: number;
  maxZoom: number;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  nodeIds: string[];
  handles: HandleEntry[];
  edges: { key: string; props: FlowEdgeProps }[];
  registerNode: (id: string, parent?: string) => void;
  unregisterNode: (id: string) => void;
  registerHandle: (entry: HandleEntry) => void;
  unregisterHandle: (key: string) => void;
  registerEdge: (key: string, props: FlowEdgeProps) => void;
  unregisterEdge: (key: string) => void;
  onConnect?: (connection: FlowConnection) => void;
  isValidConnection?: (connection: FlowConnection) => boolean;
  onNodeDragEnd?: (id: string, position: FlowNodePosition) => void;
  fitView: () => void;
  zoomBy: (factor: number) => void;
}

const FlowContext = createContext<FlowContextValue | null>(null);

function useFlow(component: string): FlowContextValue {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Flow>`);
  }
  return context;
}

/**
 * Which layer a part belongs to. Declared on the component as a static so the
 * root can sort its children without depending on function identity.
 */
type FlowSlot = 'background' | 'overlay';

/** Set by Flow.Group, so a node inside one registers as its child. */
const FlowGroupContext = createContext<string | null>(null);

/** Set by Flow.Node, so a handle knows which node it belongs to. */
const FlowNodeContext = createContext<string | null>(null);

const flowVariants = tv({
  slots: {
    root: 'flex-1 overflow-hidden bg-background',
    controls: 'absolute bottom-4 right-4 overflow-hidden rounded-xl border border-border bg-card',
    control: 'h-10 w-10 items-center justify-center active:bg-muted',
    minimap: 'absolute overflow-hidden rounded-xl border border-border bg-card/90',
    handle: 'absolute h-3.5 w-3.5 rounded-full border-2 border-background bg-muted-foreground',
  },
});

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

export interface FlowProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Where the canvas starts. `zoom` of 1 is one graph point per screen point. */
  defaultViewport?: FlowViewport;
  /** Closest the canvas will zoom out. */
  minZoom?: number;
  /** Closest it will zoom in. */
  maxZoom?: number;
  /** Drag the empty canvas to move it. */
  panOnDrag?: boolean;
  /** Pinch to zoom. */
  zoomOnPinch?: boolean;
  /**
   * Frame every node once they have all measured themselves. For a graph whose
   * positions come from data and are not laid out against a known screen size.
   */
  fitViewOnMount?: boolean;
  /** Padding left around the graph when fitting, in screen points. */
  fitViewPadding?: number;
  /** The canvas has moved or zoomed. Fired as it happens, on the JS thread. */
  onViewportChange?: (viewport: FlowViewport) => void;
  /** A node was dropped somewhere new. The only time a drag reaches JavaScript. */
  onNodeDragEnd?: (id: string, position: FlowNodePosition) => void;
  /**
   * A connection was drawn between two handles. The canvas never adds the edge
   * itself — the graph is yours, so what a new connection means is yours too.
   */
  onConnect?: (connection: FlowConnection) => void;
  /** Refuse a connection before `onConnect` sees it. */
  isValidConnection?: (connection: FlowConnection) => boolean;
  children?: ReactNode;
}

function FlowRoot({
  className,
  defaultViewport,
  minZoom = 0.3,
  maxZoom = 2.5,
  panOnDrag = true,
  zoomOnPinch = true,
  fitViewOnMount = false,
  fitViewPadding = 48,
  onViewportChange,
  onNodeDragEnd,
  onConnect,
  isValidConnection,
  children,
  ...props
}: FlowProps) {
  const rects = useSharedValue<Record<string, FlowRect>>({});
  const translateX = useSharedValue(defaultViewport?.x ?? 0);
  const translateY = useSharedValue(defaultViewport?.y ?? 0);
  const zoom = useSharedValue(defaultViewport?.zoom ?? 1);
  const connection = useSharedValue({ active: 0, x1: 0, y1: 0, x2: 0, y2: 0 });
  const size = useSharedValue({ width: 0, height: 0 });

  const [locked, setLocked] = useState(false);
  const [nodeIds, setNodeIds] = useState<string[]>([]);
  const [handles, setHandles] = useState<HandleEntry[]>([]);
  const [edges, setEdges] = useState<{ key: string; props: FlowEdgeProps }[]>([]);
  const [box, setBox] = useState({ width: 0, height: 0 });

  /**
   * The node layer is given real extent rather than being left the size of the
   * container. A view translated past its parent's bounds still draws, but it
   * stops receiving touches — which is why a node dragged off toward the edge
   * of the canvas would quietly become unmovable. Sizing the layer to the same
   * span as the grid keeps every node inside its parent, where it can be hit.
   */
  const layer = useMemo(
    () => ({
      width: clampCanvas(Math.max(box.width, 320) * GRID_SPAN),
      height: clampCanvas(Math.max(box.height, 480) * GRID_SPAN),
    }),
    [box.height, box.width]
  );
  const origin = useMemo(
    () => ({ x: layer.width / 2, y: layer.height / 2 }),
    [layer.height, layer.width]
  );

  const viewportChangeRef = useRef(onViewportChange);
  viewportChangeRef.current = onViewportChange;

  const reportViewport = useCallback((x: number, y: number, z: number) => {
    viewportChangeRef.current?.({ x, y, zoom: z });
  }, []);

  const registerNode = useCallback((id: string) => {
    setNodeIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const unregisterNode = useCallback((id: string) => {
    setNodeIds((current) => current.filter((entry) => entry !== id));
  }, []);

  const registerHandle = useCallback((entry: HandleEntry) => {
    setHandles((current) => [...current.filter((h) => h.key !== entry.key), entry]);
  }, []);

  const unregisterHandle = useCallback((key: string) => {
    setHandles((current) => current.filter((h) => h.key !== key));
  }, []);

  const registerEdge = useCallback((key: string, props: FlowEdgeProps) => {
    setEdges((current) => {
      const rest = current.filter((edge) => edge.key !== key);
      return [...rest, { key, props }];
    });
  }, []);

  const unregisterEdge = useCallback((key: string) => {
    setEdges((current) => current.filter((edge) => edge.key !== key));
  }, []);

  const fitView = useCallback(() => {
    const { width, height } = size.value;
    const all = Object.values(rects.value);
    if (!width || !height || all.length === 0) return;

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const rect of all) {
      if (rect.width === 0 || rect.height === 0) continue;
      left = Math.min(left, rect.x);
      top = Math.min(top, rect.y);
      right = Math.max(right, rect.x + rect.width);
      bottom = Math.max(bottom, rect.y + rect.height);
    }
    if (!Number.isFinite(left)) return;

    const graphWidth = Math.max(right - left, 1);
    const graphHeight = Math.max(bottom - top, 1);
    const next = Math.min(
      Math.max(
        Math.min(
          (width - fitViewPadding * 2) / graphWidth,
          (height - fitViewPadding * 2) / graphHeight
        ),
        minZoom
      ),
      maxZoom
    );

    zoom.value = withTiming(next, SPRING);
    translateX.value = withTiming(width / 2 - (left + graphWidth / 2) * next, SPRING);
    translateY.value = withTiming(height / 2 - (top + graphHeight / 2) * next, SPRING);
    reportViewport(translateX.value, translateY.value, next);
  }, [
    fitViewPadding,
    maxZoom,
    minZoom,
    rects,
    reportViewport,
    size,
    translateX,
    translateY,
    zoom,
  ]);

  /** Zoom about the middle of the screen, which is where a button press means. */
  const zoomBy = useCallback(
    (factor: number) => {
      const { width, height } = size.value;
      const current = zoom.value;
      const next = Math.min(Math.max(current * factor, minZoom), maxZoom);
      if (next === current) return;

      const focalX = width / 2;
      const focalY = height / 2;
      const ratio = next / current;
      const x = focalX - (focalX - translateX.value) * ratio;
      const y = focalY - (focalY - translateY.value) * ratio;

      zoom.value = withTiming(next, SPRING);
      translateX.value = withTiming(x, SPRING);
      translateY.value = withTiming(y, SPRING);
      reportViewport(x, y, next);
    },
    [maxZoom, minZoom, reportViewport, size, translateX, translateY, zoom]
  );

  // Nodes measure themselves on their first layout pass, so a fit asked for at
  // mount has nothing to fit to yet. One frame later they do.
  const fitOnMount = useRef(fitViewOnMount);
  useEffect(() => {
    if (!fitOnMount.current || nodeIds.length === 0) return;
    const timer = setTimeout(fitView, 32);
    return () => clearTimeout(timer);
  }, [fitView, nodeIds.length]);

  const panStart = useSharedValue({ x: 0, y: 0 });
  const pinchStart = useSharedValue({ zoom: 1, x: 0, y: 0 });

  const paneGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(panOnDrag && !locked)
      .averageTouches(true)
      .onBegin(() => {
        'worklet';
        panStart.value = { x: translateX.value, y: translateY.value };
      })
      .onUpdate((event) => {
        'worklet';
        translateX.value = panStart.value.x + event.translationX;
        translateY.value = panStart.value.y + event.translationY;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(reportViewport)(translateX.value, translateY.value, zoom.value);
      });

    const pinch = Gesture.Pinch()
      .enabled(zoomOnPinch && !locked)
      .onBegin((event) => {
        'worklet';
        pinchStart.value = {
          zoom: zoom.value,
          x: translateX.value,
          y: translateY.value,
        };
        // Keep the point under the fingers still: the translation that holds a
        // focal point in place is the one that scales the distance from it.
        connection.value = { ...connection.value };
        panStart.value = { x: event.focalX, y: event.focalY };
      })
      .onUpdate((event) => {
        'worklet';
        const next = Math.min(
          Math.max(pinchStart.value.zoom * event.scale, minZoom),
          maxZoom
        );
        const ratio = next / pinchStart.value.zoom;
        zoom.value = next;
        translateX.value = event.focalX - (event.focalX - pinchStart.value.x) * ratio;
        translateY.value = event.focalY - (event.focalY - pinchStart.value.y) * ratio;
      })
      .onEnd(() => {
        'worklet';
        runOnJS(reportViewport)(translateX.value, translateY.value, zoom.value);
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [
    connection,
    locked,
    maxZoom,
    minZoom,
    panOnDrag,
    panStart,
    pinchStart,
    reportViewport,
    translateX,
    translateY,
    zoom,
    zoomOnPinch,
  ]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoom.value },
    ],
  }));

  const context = useMemo<FlowContextValue>(
    () => ({
      rects,
      translateX,
      translateY,
      zoom,
      connection,
      size,
      box,
      origin,
      minZoom,
      maxZoom,
      locked,
      setLocked,
      nodeIds,
      handles,
      edges,
      registerNode,
      unregisterNode,
      registerHandle,
      unregisterHandle,
      registerEdge,
      unregisterEdge,
      onConnect,
      isValidConnection,
      onNodeDragEnd,
      fitView,
      zoomBy,
    }),
    [
      box,
      origin,
      connection,
      edges,
      fitView,
      handles,
      registerEdge,
      unregisterEdge,
      isValidConnection,
      locked,
      maxZoom,
      minZoom,
      nodeIds,
      onConnect,
      onNodeDragEnd,
      rects,
      registerHandle,
      registerNode,
      size,
      translateX,
      translateY,
      unregisterHandle,
      unregisterNode,
      zoom,
      zoomBy,
    ]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      size.value = { width, height };
      setBox((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
    },
    [size]
  );

  // Children are sorted into the layers that actually draw them. Only nodes go
  // inside the transform; the grid and the edges map graph coordinates to
  // screen coordinates themselves, and the controls must not pan away with the
  // graph they control.
  const { background, overlay, canvas } = useMemo(() => splitChildren(children), [children]);

  return (
    <View
      className={flowVariants().root({ className })}
      onLayout={onLayout}
      collapsable={false}
      accessibilityRole="none"
      {...props}
    >
      <FlowContext.Provider value={context}>
        <GestureDetector gesture={paneGesture}>
          <View collapsable={false} style={{ flex: 1 }}>
            {/* Painted in this order: grid, edges, nodes. Only the nodes are
                transformed — the other two do their own mapping, because an
                SVG large enough to hold a whole graph is larger than the
                platform will allocate a texture for. */}
            {/* Two transformed layers with the same style rather than one,
                because the edges have to be painted between them: the grid
                belongs to the canvas and rides the transform, while the edges
                map graph coordinates to screen coordinates themselves. */}
            <Animated.View
              pointerEvents="none"
              collapsable={false}
              style={[StyleSheet.absoluteFill, TRANSFORM_ORIGIN, contentStyle]}
            >
              {background}
            </Animated.View>
            <FlowEdgeLayer />
            <Animated.View
              collapsable={false}
              style={[
                {
                  position: 'absolute',
                  left: -origin.x,
                  top: -origin.y,
                  width: layer.width,
                  height: layer.height,
                  // Pivot on graph (0, 0), not on this layer's own corner.
                  // The layer starts half its width up and to the left of the
                  // container, so scaling about its corner would throw the
                  // graph off screen by half the layer on every zoom.
                  transformOrigin: [origin.x, origin.y, 0],
                },
                contentStyle,
              ]}
            >
              {canvas}
            </Animated.View>
          </View>
        </GestureDetector>
        {overlay}
      </FlowContext.Provider>
    </View>
  );
}

/**
 * Sorts what was declared inside `<Flow>` into the three layers that actually
 * draw it.
 *
 * An edge reads best written next to the nodes it joins, but it is an SVG
 * element and has to be inside the canvas's single `<Svg>`; controls and the
 * minimap read best written last, but have to sit outside the transform or
 * they pan away with the graph they control. Rather than make the caller
 * arrange the file to match the paint order, the parts are recognised here.
 *
 * Nested fragments and arrays are flattened on the way, so a `.map()` over
 * edges works exactly as it looks like it should.
 */
function splitChildren(children: ReactNode): {
  background: ReactNode[];
  overlay: ReactNode[];
  canvas: ReactNode[];
} {
  const background: ReactNode[] = [];
  const overlay: ReactNode[] = [];
  const canvas: ReactNode[] = [];

  const visit = (node: ReactNode) => {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === 'object' && 'type' in node) {
      const type = (node as { type: unknown }).type;
      // Matched on a static marker rather than on the function itself. Identity
      // is the obvious test and the fragile one: it fails the moment two copies
      // of the module exist, and it fails silently — an unrecognised edge would
      // land among the nodes, where it is not an SVG element and draws nothing.
      const slot =
        typeof type === 'function' ? (type as { slot?: FlowSlot }).slot : undefined;

      if (slot === 'background') {
        background.push(node);
        return;
      }
      if (slot === 'overlay') {
        overlay.push(node);
        return;
      }
      // A fragment is a wrapper the caller used for their own reasons, not a
      // layer — look through it rather than dropping its contents on the floor.
      if (type === Fragment) {
        visit((node as { props?: { children?: ReactNode } }).props?.children);
        return;
      }
    }
    canvas.push(node);
  };

  visit(children);
  return { background, overlay, canvas };
}

/* -------------------------------------------------------------------------- */
/* Background                                                                 */
/* -------------------------------------------------------------------------- */

export interface FlowBackgroundProps {
  /** The mark repeated across the canvas. */
  variant?: 'dots' | 'lines' | 'cross' | 'none';
  /** Points between marks. */
  gap?: number;
  /** How big each mark is drawn. */
  size?: number;
  /** Mark colour. Defaults to a muted theme token. */
  color?: string;
}

/**
 * The grid behind everything. It lives inside the transformed layer, so it
 * pans and scales with the graph — which is the whole point: a grid that
 * stayed put would say the canvas was not moving.
 */
function FlowBackground({
  variant = 'dots',
  gap = 24,
  size = 1.6,
  color,
}: FlowBackgroundProps) {
  const { box, translateX, translateY, zoom } = useFlow('Flow.Background');
  const token = useCSSVariable('--color-muted-foreground');
  const tint = color ?? (typeof token === 'string' ? token : '#737373');
  // A pattern is referenced by id, and two canvases on one screen would collide.
  const id = useRef(`panelui-flow-${Math.random().toString(36).slice(2, 7)}`).current;

  /*
   * The grid is a tile that follows the viewport in whole-cell steps.
   *
   * It is drawn inside the transformed layer, so panning and zooming it costs
   * nothing and the dots stay nailed to the canvas — a grid whose pattern is
   * re-tiled each frame visibly crawls instead of travelling. But a tile fixed
   * in graph space runs out the moment you pan past its edge, and it cannot
   * simply be made enormous: an SVG is one texture, and a texture has a size
   * the platform will not exceed, past which it draws nothing at all.
   *
   * So the tile moves with you, rounded to a whole number of cells. Rounding is
   * what makes the move invisible: shifted by an exact multiple of the grid
   * spacing, the tile is the same picture it was before.
   */
  const follow = useAnimatedStyle(() => {
    const left = -translateX.value / zoom.value;
    const top = -translateY.value / zoom.value;
    return {
      transform: [
        { translateX: Math.round(left / gap) * gap },
        { translateY: Math.round(top / gap) * gap },
      ],
    };
  });

  if (variant === 'none') return null;

  // Wide enough to cover the container at the furthest zoom out, with a screen
  // of slack either side so a fling never outruns it between frames.
  const width = clampCanvas(Math.max(box.width, 320) * GRID_SPAN);
  const height = clampCanvas(Math.max(box.height, 480) * GRID_SPAN);
  const left = -width / 2;
  const top = -height / 2;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, follow]}>
      <Svg
        pointerEvents="none"
        style={{ position: 'absolute', left, top }}
        width={width}
        height={height}
        viewBox={`${left} ${top} ${width} ${height}`}
      >
        <Defs>
          <Pattern
            id={id}
            x={0}
            y={0}
            width={gap}
            height={gap}
            patternUnits="userSpaceOnUse"
          >
            {variant === 'dots' ? (
              <Circle cx={gap / 2} cy={gap / 2} r={size} fill={tint} opacity={0.45} />
            ) : null}
            {variant === 'lines' ? (
              <Path
                d={`M0,0 L${gap},0 M0,0 L0,${gap}`}
                stroke={tint}
                strokeWidth={Math.max(size / 2, 0.4)}
                opacity={0.28}
              />
            ) : null}
            {variant === 'cross' ? (
              <Path
                d={`M${gap / 2 - size * 2},${gap / 2} L${gap / 2 + size * 2},${gap / 2} M${gap / 2},${gap / 2 - size * 2} L${gap / 2},${gap / 2 + size * 2}`}
                stroke={tint}
                strokeWidth={Math.max(size / 2, 0.4)}
                opacity={0.4}
              />
            ) : null}
          </Pattern>
        </Defs>
        <Rect x={left} y={top} width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
FlowBackground.displayName = 'Flow.Background';
FlowBackground.slot = 'background' as FlowSlot;

/* -------------------------------------------------------------------------- */
/* Node                                                                       */
/* -------------------------------------------------------------------------- */

export interface FlowNodeProps extends Omit<ViewProps, 'children'> {
  /** Identifies the node to edges and to `onNodeDragEnd`. Must be unique. */
  id: string;
  /** Where it starts, in graph coordinates. */
  position: FlowNodePosition;
  className?: string;
  /** Let a finger move it. */
  draggable?: boolean;
  /** Draw the selected ring. */
  selected?: boolean;
  /** Tapping the node — separate from dragging it. */
  onPress?: () => void;
  /** Spoken name. Defaults to the node's id. */
  accessibilityLabel?: string;
  children?: ReactNode;
}

/**
 * One box on the canvas. Its own content is whatever you put inside — a Frame
 * is the usual answer, since a node is a titled card of rows more often than
 * it is anything else.
 */
function FlowNode({
  id,
  position,
  className,
  draggable = true,
  selected = false,
  onPress,
  accessibilityLabel,
  children,
  ...props
}: FlowNodeProps) {
  const flow = useFlow('Flow.Node');
  const group = useContext(FlowGroupContext);
  const { rects, zoom, locked, origin, registerNode, unregisterNode, onNodeDragEnd } = flow;

  useEffect(() => {
    registerNode(id, group ?? undefined);
    return () => unregisterNode(id);
  }, [group, id, registerNode, unregisterNode]);

  // Writing on every render would fight the drag, snapping a node back to the
  // position it was first given. Only an actual change to the prop moves it.
  const lastPosition = useRef<FlowNodePosition | null>(null);
  useEffect(() => {
    const previous = lastPosition.current;
    if (previous && previous.x === position.x && previous.y === position.y) return;
    lastPosition.current = position;
    const existing = rects.value[id];
    rects.value = {
      ...rects.value,
      [id]: {
        x: position.x,
        y: position.y,
        width: existing?.width ?? 0,
        height: existing?.height ?? 0,
      },
    };
  }, [id, position, rects]);

  useEffect(() => {
    return () => {
      const { [id]: _removed, ...rest } = rects.value;
      rects.value = rest;
    };
  }, [id, rects]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      const existing = rects.value[id];
      if (existing && existing.width === width && existing.height === height) return;
      rects.value = {
        ...rects.value,
        [id]: {
          x: existing?.x ?? position.x,
          y: existing?.y ?? position.y,
          width,
          height,
        },
      };
    },
    [id, position.x, position.y, rects]
  );

  const dragEnd = useCallback(
    (x: number, y: number) => onNodeDragEnd?.(id, { x, y }),
    [id, onNodeDragEnd]
  );

  const start = useSharedValue({ x: 0, y: 0 });

  const pressRef = useRef(onPress);
  pressRef.current = onPress;
  const press = useCallback(() => pressRef.current?.(), []);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .enabled(draggable && !locked)
        .onBegin(() => {
          'worklet';
          const rect = rects.value[id];
          start.value = { x: rect?.x ?? 0, y: rect?.y ?? 0 };
        })
        .onUpdate((event) => {
          'worklet';
          const rect = rects.value[id];
          if (!rect) return;
          // Divided by the zoom, so the node keeps up with the finger rather
          // than with the graph coordinate the finger happens to be over.
          rects.value = {
            ...rects.value,
            [id]: {
              ...rect,
              x: start.value.x + event.translationX / zoom.value,
              y: start.value.y + event.translationY / zoom.value,
            },
          };
        })
        .onEnd(() => {
          'worklet';
          const rect = rects.value[id];
          if (rect) runOnJS(dragEnd)(rect.x, rect.y);
        }),
    [dragEnd, draggable, id, locked, rects, start, zoom]
  );

  // Raced with the drag rather than layered on top of it. A plain touch handler
  // would fire at the end of a drag too, so every rearrangement would also read
  // as a tap on whatever was moved.
  const gesture = useMemo(
    () =>
      onPress
        ? Gesture.Race(
            drag,
            Gesture.Tap().onEnd(() => {
              'worklet';
              runOnJS(press)();
            })
          )
        : drag,
    [drag, onPress, press]
  );

  const style = useAnimatedStyle(() => {
    const rect = rects.value[id];
    return {
      transform: [
        { translateX: (rect?.x ?? 0) + origin.x },
        { translateY: (rect?.y ?? 0) + origin.y },
      ],
    };
  });

  return (
    <FlowNodeContext.Provider value={id}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          onLayout={onLayout}
          style={[{ position: 'absolute', top: 0, left: 0 }, style]}
          className={cn(
            selected && 'rounded-3xl ring-2 ring-ring',
            className
          )}
          accessible
          accessibilityRole={onPress ? 'button' : 'none'}
          accessibilityLabel={accessibilityLabel ?? id}
          accessibilityState={{ selected }}
          {...props}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </FlowNodeContext.Provider>
  );
}
FlowNode.displayName = 'Flow.Node';

/* -------------------------------------------------------------------------- */
/* Handle                                                                     */
/* -------------------------------------------------------------------------- */

export interface FlowHandleProps {
  /** Names the handle to an edge, as `"nodeId.handleId"`. */
  id?: string;
  /** Which face it sits on. */
  position?: FlowSide;
  /**
   * `source` starts connections, `target` receives them, `both` does either.
   * A drag from a source can only land on a target, and the other way round.
   */
  type?: 'source' | 'target' | 'both';
  /** Where along the face, 0–1. For more than one handle on a side. */
  offset?: number;
  className?: string;
  /** Draw nothing. The handle still anchors edges and still accepts a drop. */
  hidden?: boolean;
}

/**
 * A port on a node — both the point an edge attaches to and the grip a new
 * connection is dragged from.
 *
 * Its position is worked out from the node's box and the face it names, so it
 * never has to measure itself. That matters: a handle that measured would be
 * one frame behind the node it sits on, and the edge would trail its own port.
 */
function FlowHandle({
  id = 'default',
  position = 'right',
  type = 'both',
  offset = 0.5,
  className,
  hidden = false,
}: FlowHandleProps) {
  const flow = useFlow('Flow.Handle');
  const node = useContext(FlowNodeContext);
  if (!node) {
    throw new Error('Flow.Handle must be used within a <Flow.Node>');
  }

  const { rects, zoom, connection, handles, locked, registerHandle, unregisterHandle } = flow;
  const key = `${node}.${id}`;

  useEffect(() => {
    registerHandle({ key, node, id, side: position, offset, type });
    return () => unregisterHandle(key);
  }, [id, key, node, offset, position, registerHandle, type, unregisterHandle]);

  const connectRef = useRef(flow.onConnect);
  connectRef.current = flow.onConnect;
  const validRef = useRef(flow.isValidConnection);
  validRef.current = flow.isValidConnection;

  const land = useCallback(
    (target: string, targetHandle: string | undefined) => {
      const payload: FlowConnection = {
        source: node,
        sourceHandle: id,
        target,
        targetHandle,
      };
      if (validRef.current && !validRef.current(payload)) return;
      connectRef.current?.(payload);
    },
    [id, node]
  );

  // A snapshot of what a drag can land on, rebuilt only when handles come and
  // go — the drop test runs on the UI thread and cannot read React state.
  const targets = useMemo(
    () =>
      handles
        .filter((entry) => entry.node !== node && entry.type !== 'source')
        .map((entry) => ({
          node: entry.node,
          id: entry.id,
          side: entry.side,
          offset: entry.offset,
        })),
    [handles, node]
  );

  const connect = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!locked && type !== 'target')
        .onBegin(() => {
          'worklet';
          const rect = rects.value[node];
          if (!rect) return;
          const anchor = anchorOf(rect, position, offset);
          connection.value = {
            active: 1,
            x1: anchor.x,
            y1: anchor.y,
            x2: anchor.x,
            y2: anchor.y,
          };
        })
        .onUpdate((event) => {
          'worklet';
          const current = connection.value;
          if (current.active === 0) return;
          connection.value = {
            ...current,
            x2: current.x1 + event.translationX / zoom.value,
            y2: current.y1 + event.translationY / zoom.value,
          };
        })
        .onEnd(() => {
          'worklet';
          const current = connection.value;
          connection.value = { active: 0, x1: 0, y1: 0, x2: 0, y2: 0 };
          if (current.active === 0) return;

          const drop = { x: current.x2, y: current.y2 };
          const reach = CONNECT_RADIUS / zoom.value;

          // Nearest handle wins. A finger is blunt, so the first thing inside
          // the radius is rarely the one that was meant.
          let bestNode: string | null = null;
          let bestHandle: string | undefined;
          let bestDistance = reach;

          for (let i = 0; i < targets.length; i += 1) {
            const entry = targets[i]!;
            const rect = rects.value[entry.node];
            if (!rect) continue;
            const anchor = anchorOf(rect, entry.side, entry.offset);
            const dx = anchor.x - drop.x;
            const dy = anchor.y - drop.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestNode = entry.node;
              bestHandle = entry.id;
            }
          }

          // Nothing close enough to a handle: dropping anywhere on a node is
          // the friendlier reading of the gesture on a small screen.
          if (bestNode === null) {
            const entries = Object.entries(rects.value);
            for (let i = 0; i < entries.length; i += 1) {
              const [candidate, rect] = entries[i]!;
              if (candidate === node) continue;
              if (
                drop.x >= rect.x &&
                drop.x <= rect.x + rect.width &&
                drop.y >= rect.y &&
                drop.y <= rect.y + rect.height
              ) {
                bestNode = candidate;
                bestHandle = undefined;
                break;
              }
            }
          }

          if (bestNode !== null) runOnJS(land)(bestNode, bestHandle);
        }),
    [connection, land, locked, node, offset, position, rects, targets, type, zoom]
  );

  if (hidden) return null;

  // Positioned as a percentage of the node it sits in, so it follows the node's
  // own size without either of them measuring the other.
  const along = `${offset * 100}%` as DimensionValue;
  const placement: ViewStyle =
    position === 'top'
      ? { top: -7, left: along, marginLeft: -7 }
      : position === 'bottom'
        ? { bottom: -7, left: along, marginLeft: -7 }
        : position === 'left'
          ? { left: -7, top: along, marginTop: -7 }
          : { right: -7, top: along, marginTop: -7 };

  return (
    <GestureDetector gesture={connect}>
      <View
        collapsable={false}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`${position} connection point`}
        style={placement}
        className={flowVariants().handle({ className })}
      />
    </GestureDetector>
  );
}
FlowHandle.displayName = 'Flow.Handle';

/* -------------------------------------------------------------------------- */
/* Edges                                                                      */
/* -------------------------------------------------------------------------- */

export interface FlowEdgeProps {
  /** Source, as `"nodeId"` or `"nodeId.handleId"`. */
  from: string;
  /** Target, same shape. */
  to: string;
  /** How the edge is routed. */
  variant?: FlowEdgeVariant;
  /** March the dashes along the edge, in the direction of travel. */
  animated?: boolean;
  /** Draw it broken rather than solid. */
  dashed?: boolean;
  /** Stroke colour. Defaults to the border token. */
  color?: string;
  /** Stroke width in graph points. */
  width?: number;
  /** Put an arrowhead on the target end. */
  arrow?: boolean;
  /** Seconds for one dash cycle. Lower is faster. */
  speed?: number;
  /** Override the face it leaves from. Otherwise worked out from the layout. */
  fromSide?: FlowSide;
  /** Override the face it arrives at. */
  toSide?: FlowSide;
  /** Corner radius for `smoothstep`. */
  radius?: number;
  /** How far the edge steps clear of a node before turning. */
  gap?: number;
  /** Curve strength for `bezier`. */
  curvature?: number;
}

/**
 * A line between two nodes. It names them rather than coordinates, and works
 * out its own geometry from wherever they currently are — including which face
 * to use, which is why a graph the user rearranges does not need re-specifying.
 *
 * It draws nothing where it is written. Every edge in a canvas has to end up
 * inside one `<Svg>`, under every node — an SVG element rendered among the
 * nodes is not in an SVG at all and silently draws nothing — so an edge
 * registers itself and the canvas paints it in the right layer. Which means an
 * edge can be written wherever it reads best: beside the nodes it joins, inside
 * a group, inside a `.map`, behind a condition.
 */
function FlowEdge(props: FlowEdgeProps) {
  const { registerEdge, unregisterEdge } = useFlow('Flow.Edge');
  const key = `${props.from}->${props.to}`;

  // Re-registered whenever any prop changes, so `animated` toggling or a
  // variant switch reaches the layer that draws it.
  const json = JSON.stringify(props);
  useEffect(() => {
    registerEdge(key, props);
    return () => unregisterEdge(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, json, registerEdge, unregisterEdge]);

  return null;
}

/** The part that actually draws an edge, inside the canvas's one `<Svg>`. */
function FlowEdgePath({
  from,
  to,
  variant = 'bezier',
  animated = false,
  dashed = false,
  color,
  width = 1.5,
  arrow = false,
  speed = 1.2,
  fromSide,
  toSide,
  radius = 8,
  gap = 20,
  curvature = 0.25,
}: FlowEdgeProps) {
  const { rects, handles, translateX, translateY, zoom } = useFlow('Flow.Edge');
  const token = useCSSVariable('--color-border');
  const tint = color ?? (typeof token === 'string' ? token : '#404040');

  const source = useMemo(() => resolveEnd(from, fromSide, handles), [from, fromSide, handles]);
  const target = useMemo(() => resolveEnd(to, toSide, handles), [handles, to, toSide]);

  const dash = dashed ? 6 : 0;
  const march = useSharedValue(0);

  useEffect(() => {
    if (!animated) {
      march.value = 0;
      return;
    }
    // One full dash cycle per repeat, so the pattern lands exactly where it
    // started and the loop has no visible seam.
    const cycle = dashed ? 12 : 24;
    march.value = 0;
    march.value = withRepeat(
      withTiming(-cycle, { duration: speed * 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [animated, dashed, march, speed]);

  const pathProps = useAnimatedProps(() => {
    const fromRect = rects.value[source.node];
    const toRect = rects.value[target.node];
    if (!fromRect || !toRect || fromRect.width === 0 || toRect.width === 0) {
      return { d: '', strokeDashoffset: 0, strokeWidth: width };
    }

    const auto = autoSides(fromRect, toRect);
    const sideA: FlowSide = source.side ?? auto.from;
    const sideB: FlowSide = target.side ?? auto.to;
    const a = anchorOf(fromRect, sideA, source.offset);
    const b = anchorOf(toRect, sideB, target.offset);

    // Graph coordinates to screen coordinates. The faces were chosen in graph
    // space, where they mean something; the drawing happens in screen space,
    // because that is the only space an SVG this size can cover.
    const z = zoom.value;
    const tx = translateX.value;
    const ty = translateY.value;
    const screenA = { x: tx + a.x * z, y: ty + a.y * z };
    const screenB = { x: tx + b.x * z, y: ty + b.y * z };

    return {
      // The step-out and the corner radius are graph-space measurements, so
      // they scale with everything else rather than growing as you zoom out.
      d: edgePath(variant, screenA, sideA, screenB, sideB, curvature, radius * z, gap * z),
      strokeDashoffset: march.value,
      strokeWidth: width * z,
    };
  });

  const arrowId = useRef(`panelui-arrow-${Math.random().toString(36).slice(2, 7)}`).current;

  // A <G> rather than a fragment: react-native-svg walks its children looking
  // for SVG elements, and a fragment is not one — its contents are dropped.
  return (
    <G>
      {arrow ? (
        <Defs>
          <Marker
            id={arrowId}
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={4}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <Path d="M1,1 L7,4 L1,7 Z" fill={tint} />
          </Marker>
        </Defs>
      ) : null}
      <AnimatedPath
        animatedProps={pathProps}
        fill="none"
        stroke={tint}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash ? `${dash} ${dash}` : undefined}
        markerEnd={arrow ? `url(#${arrowId})` : undefined}
      />
    </G>
  );
}
FlowEdge.displayName = 'Flow.Edge';

/**
 * Splits `"node"` or `"node.handle"` into the node and, when a handle was
 * named, the face and offset that handle registered.
 */
function resolveEnd(
  reference: string,
  explicit: FlowSide | undefined,
  handles: HandleEntry[]
): { node: string; side: FlowSide | undefined; offset: number } {
  const dot = reference.indexOf('.');
  if (dot === -1) {
    return { node: reference, side: explicit, offset: 0.5 };
  }
  const node = reference.slice(0, dot);
  const entry = handles.find((handle) => handle.key === reference);
  return {
    node,
    side: explicit ?? entry?.side,
    offset: entry?.offset ?? 0.5,
  };
}

/**
 * The one SVG every edge draws into, plus the line that trails a finger while
 * a connection is being drawn.
 *
 * One `<Svg>` rather than one per edge: each is a native view, and a graph with
 * forty edges would otherwise be forty overlapping full-canvas views for the
 * platform to composite.
 */
function FlowEdgeLayer() {
  const { connection, edges, translateX, translateY, zoom } = useFlow('Flow');
  const token = useCSSVariable('--color-ring');
  const tint = typeof token === 'string' ? token : '#737373';

  const lineProps = useAnimatedProps(() => {
    const current = connection.value;
    if (current.active === 0) return { d: '', opacity: 0 };
    const z = zoom.value;
    const tx = translateX.value;
    const ty = translateY.value;
    return {
      d:
        `M${tx + current.x1 * z},${ty + current.y1 * z} ` +
        `L${tx + current.x2 * z},${ty + current.y2 * z}`,
      opacity: 1,
    };
  });

  return (
    // Sized by the layout rather than by a measured number: an SVG gated on a
    // measurement that has not arrived renders nothing, and if the measurement
    // never arrives it renders nothing for ever.
    <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
      {edges.map((edge) => (
        <FlowEdgePath key={edge.key} {...edge.props} />
      ))}
      <AnimatedPath
        animatedProps={lineProps}
        fill="none"
        stroke={tint}
        strokeWidth={2}
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Group                                                                      */
/* -------------------------------------------------------------------------- */

export interface FlowGroupProps extends Omit<ViewProps, 'children'> {
  /** Identifies the group, the same way a node's id does. */
  id: string;
  /** Where the container sits. */
  position: FlowNodePosition;
  /** How big the container is. Children are positioned inside it. */
  size: { width: number; height: number };
  /** Caption drawn along the top edge. */
  label?: string;
  className?: string;
  /** Move the group, and everything in it, with a finger. */
  draggable?: boolean;
  children?: ReactNode;
}

/**
 * A container other nodes sit in and travel with.
 *
 * Dragging it offsets every child in the same worklet that moves the group, so
 * a group of twenty nodes costs one frame's work rather than twenty.
 */
function FlowGroup({
  id,
  position,
  size,
  label,
  className,
  draggable = true,
  children,
  ...props
}: FlowGroupProps) {
  const flow = useFlow('Flow.Group');
  const { rects, zoom, locked, origin, registerNode, unregisterNode, onNodeDragEnd } = flow;

  useEffect(() => {
    registerNode(id);
    return () => unregisterNode(id);
  }, [id, registerNode, unregisterNode]);

  useEffect(() => {
    rects.value = {
      ...rects.value,
      [id]: { x: position.x, y: position.y, width: size.width, height: size.height },
    };
    return () => {
      const { [id]: _removed, ...rest } = rects.value;
      rects.value = rest;
    };
  }, [id, position.x, position.y, rects, size.height, size.width]);

  // Which nodes travel with the group, captured when they register rather than
  // read per frame.
  const childIds = useMemo(() => collectNodeIds(children), [children]);

  const start = useSharedValue<Record<string, FlowNodePosition>>({});

  const dragEnd = useCallback(
    (x: number, y: number) => onNodeDragEnd?.(id, { x, y }),
    [id, onNodeDragEnd]
  );

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .enabled(draggable && !locked)
        .onBegin(() => {
          'worklet';
          const snapshot: Record<string, FlowNodePosition> = {};
          const group = rects.value[id];
          if (group) snapshot[id] = { x: group.x, y: group.y };
          for (let i = 0; i < childIds.length; i += 1) {
            const child = rects.value[childIds[i]!];
            if (child) snapshot[childIds[i]!] = { x: child.x, y: child.y };
          }
          start.value = snapshot;
        })
        .onUpdate((event) => {
          'worklet';
          const dx = event.translationX / zoom.value;
          const dy = event.translationY / zoom.value;
          const next = { ...rects.value };
          const ids = Object.keys(start.value);
          for (let i = 0; i < ids.length; i += 1) {
            const key = ids[i]!;
            const rect = next[key];
            const origin = start.value[key];
            if (!rect || !origin) continue;
            next[key] = { ...rect, x: origin.x + dx, y: origin.y + dy };
          }
          rects.value = next;
        })
        .onEnd(() => {
          'worklet';
          const rect = rects.value[id];
          if (rect) runOnJS(dragEnd)(rect.x, rect.y);
        }),
    [childIds, dragEnd, draggable, id, locked, rects, start, zoom]
  );

  const style = useAnimatedStyle(() => {
    const rect = rects.value[id];
    return {
      transform: [
        { translateX: (rect?.x ?? 0) + origin.x },
        { translateY: (rect?.y ?? 0) + origin.y },
      ],
    };
  });

  return (
    <FlowGroupContext.Provider value={id}>
      <GestureDetector gesture={drag}>
        <Animated.View
          collapsable={false}
          style={[
            { position: 'absolute', top: 0, left: 0, width: size.width, height: size.height },
            style,
          ]}
          className={cn(
            'rounded-2xl border border-dashed border-border bg-muted/25',
            className
          )}
          accessibilityRole="none"
          accessibilityLabel={label ?? id}
          {...props}
        >
          {label ? (
            <Text size="xs" muted className="px-3 pt-2 uppercase tracking-wider">
              {label}
            </Text>
          ) : null}
        </Animated.View>
      </GestureDetector>
      {/* Children are siblings of the container, not descendants of it: a node
          inside an absolutely-positioned box would be positioned against that
          box, and every graph coordinate would mean something different
          depending on which group it happened to be in. */}
      {children}
    </FlowGroupContext.Provider>
  );
}
FlowGroup.displayName = 'Flow.Group';

function collectNodeIds(children: ReactNode): string[] {
  const ids: string[] = [];
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    if (
      child &&
      typeof child === 'object' &&
      'props' in child &&
      typeof (child as { props?: { id?: unknown } }).props?.id === 'string'
    ) {
      ids.push((child as { props: { id: string } }).props.id);
    }
  }
  return ids;
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

export interface FlowControlsProps {
  className?: string;
  /** Show the zoom in and out buttons. */
  zoom?: boolean;
  /** Show the fit-to-graph button. */
  fit?: boolean;
  /** Show the lock, which freezes panning, zooming and dragging together. */
  lock?: boolean;
  /** How much one press of zoom in multiplies the scale by. */
  step?: number;
}

/**
 * The button stack in the corner. It sits outside the transformed layer, so it
 * stays put while the canvas moves under it.
 *
 * Worth having even where pinch works: on a phone, pinching to a specific
 * scale is imprecise, and framing the whole graph by hand is worse.
 */
function FlowControls({
  className,
  zoom: showZoom = true,
  fit = true,
  lock = true,
  step = 1.3,
}: FlowControlsProps) {
  const { zoomBy, fitView, locked, setLocked } = useFlow('Flow.Controls');
  const slots = flowVariants();

  return (
    <View className={slots.controls({ className })}>
      {showZoom ? (
        <>
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            className={slots.control()}
            onPress={() => zoomBy(step)}
          >
            <PlusIcon size={16} />
          </AnimatedPressable>
          <View className="h-px bg-border" />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            className={slots.control()}
            onPress={() => zoomBy(1 / step)}
          >
            <MinusIcon size={16} />
          </AnimatedPressable>
        </>
      ) : null}
      {fit ? (
        <>
          <View className="h-px bg-border" />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Fit the whole graph on screen"
            className={slots.control()}
            onPress={fitView}
          >
            <MaximizeIcon size={16} />
          </AnimatedPressable>
        </>
      ) : null}
      {lock ? (
        <>
          <View className="h-px bg-border" />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={locked ? 'Unlock the canvas' : 'Lock the canvas'}
            accessibilityState={{ selected: locked }}
            className={slots.control()}
            onPress={() => setLocked(!locked)}
          >
            {locked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
          </AnimatedPressable>
        </>
      ) : null}
    </View>
  );
}
FlowControls.displayName = 'Flow.Controls';
FlowControls.slot = 'overlay' as FlowSlot;

/* -------------------------------------------------------------------------- */
/* MiniMap                                                                    */
/* -------------------------------------------------------------------------- */

export interface FlowMiniMapProps {
  className?: string;
  /** Which corner it sits in. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Box size in screen points. */
  width?: number;
  height?: number;
  /** Colour of a node in the map. Defaults to the muted-foreground token. */
  nodeColor?: string;
}

const MINIMAP_CORNERS = {
  'top-left': 'left-4 top-4',
  'top-right': 'right-4 top-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-20 right-4',
} as const;

/**
 * An overview of the whole graph with the visible region marked on it — for a
 * canvas bigger than the screen, where panning alone loses you.
 *
 * The map's own scale is derived once per frame and shared by every node in it,
 * so N nodes cost one bounds calculation rather than N.
 */
function FlowMiniMap({
  className,
  position = 'bottom-right',
  width = 120,
  height = 84,
  nodeColor,
}: FlowMiniMapProps) {
  const { rects, nodeIds, translateX, translateY, zoom, size } = useFlow('Flow.MiniMap');
  const token = useCSSVariable('--color-muted-foreground');
  const tint = nodeColor ?? (typeof token === 'string' ? token : '#737373');
  const ringToken = useCSSVariable('--color-ring');
  const ring = typeof ringToken === 'string' ? ringToken : '#737373';

  const padding = 6;

  /** The graph's bounds and the scale that fits them in the box. Once a frame. */
  const fit = useDerivedValue(() => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    const all = Object.values(rects.value);
    for (let i = 0; i < all.length; i += 1) {
      const rect = all[i]!;
      if (rect.width === 0) continue;
      left = Math.min(left, rect.x);
      top = Math.min(top, rect.y);
      right = Math.max(right, rect.x + rect.width);
      bottom = Math.max(bottom, rect.y + rect.height);
    }

    if (!Number.isFinite(left)) {
      return { left: 0, top: 0, scale: 1 };
    }

    const graphWidth = Math.max(right - left, 1);
    const graphHeight = Math.max(bottom - top, 1);
    const scale = Math.min(
      (width - padding * 2) / graphWidth,
      (height - padding * 2) / graphHeight
    );
    return { left, top, scale };
  });

  const viewportProps = useAnimatedProps(() => {
    const { left, top, scale } = fit.value;
    const screen = size.value;
    if (screen.width === 0) return { x: 0, y: 0, width: 0, height: 0 };

    // The graph rectangle currently on screen, mapped into the map's space.
    const graphX = -translateX.value / zoom.value;
    const graphY = -translateY.value / zoom.value;
    return {
      x: padding + (graphX - left) * scale,
      y: padding + (graphY - top) * scale,
      width: (screen.width / zoom.value) * scale,
      height: (screen.height / zoom.value) * scale,
    };
  });

  return (
    <View
      pointerEvents="none"
      style={{ width, height }}
      className={cn(
        flowVariants().minimap(),
        MINIMAP_CORNERS[position],
        className
      )}
      accessibilityLabel="Graph overview"
    >
      <Svg width={width} height={height}>
        {nodeIds.map((id) => (
          <MiniMapNode key={id} id={id} rects={rects} fit={fit} padding={padding} color={tint} />
        ))}
        <AnimatedRect
          animatedProps={viewportProps}
          fill="none"
          stroke={ring}
          strokeWidth={1}
          rx={2}
        />
      </Svg>
    </View>
  );
}
FlowMiniMap.displayName = 'Flow.MiniMap';
FlowMiniMap.slot = 'overlay' as FlowSlot;

function MiniMapNode({
  id,
  rects,
  fit,
  padding,
  color,
}: {
  id: string;
  rects: SharedValue<Record<string, FlowRect>>;
  fit: SharedValue<{ left: number; top: number; scale: number }>;
  padding: number;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const rect = rects.value[id];
    if (!rect || rect.width === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const { left, top, scale } = fit.value;
    return {
      x: padding + (rect.x - left) * scale,
      y: padding + (rect.y - top) * scale,
      width: Math.max(rect.width * scale, 2),
      height: Math.max(rect.height * scale, 2),
    };
  });

  return <AnimatedRect animatedProps={props} fill={color} opacity={0.55} rx={1.5} />;
}

export const Flow = Object.assign(FlowRoot, {
  Background: FlowBackground,
  Node: FlowNode,
  Handle: FlowHandle,
  Edge: FlowEdge,
  Group: FlowGroup,
  Controls: FlowControls,
  MiniMap: FlowMiniMap,
});

export type { FlowSide, FlowRect, FlowPoint };
