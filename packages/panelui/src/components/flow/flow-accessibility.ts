import type { FlowConnection, FlowNodePosition } from '.';
import type { FlowRect } from './flow-paths';

export const FLOW_MOVE_ACTIONS = [
  { name: 'flow-move-up', label: 'Move up', dx: 0, dy: -1 },
  { name: 'flow-move-right', label: 'Move right', dx: 1, dy: 0 },
  { name: 'flow-move-down', label: 'Move down', dx: 0, dy: 1 },
  { name: 'flow-move-left', label: 'Move left', dx: -1, dy: 0 },
] as const;

export const FLOW_DELETE_ACTION = { name: 'flow-delete', label: 'Delete node' } as const;

export interface FlowAccessibilityNode {
  id: string;
  label: string;
}

export interface FlowAccessibilityHandle {
  key: string;
  node: string;
  id: string;
  label: string;
  type: 'source' | 'target' | 'both';
}

export interface FlowConnectionAction {
  name: string;
  label: string;
  connection: FlowConnection;
}

/** Opaque, collision-free name for the native accessibility action map. */
export function flowConnectionActionName(
  source: { node: string; handle?: string },
  target: { node: string; handle?: string }
): string {
  return `flow-connect:${JSON.stringify([source, target])}`;
}

/** Keep pointer and assistive-technology movement inside the same group bounds. */
export function clampNodePosition(
  rect: FlowRect,
  bounds: FlowRect | undefined,
  position: FlowNodePosition
): FlowNodePosition {
  'worklet';
  if (!bounds) return position;

  return {
    x: Math.min(Math.max(position.x, bounds.x), bounds.x + bounds.width - rect.width),
    y: Math.min(Math.max(position.y, bounds.y), bounds.y + bounds.height - rect.height),
  };
}

export function moveNodePosition(
  rect: FlowRect,
  bounds: FlowRect | undefined,
  actionName: string,
  step: number
): FlowNodePosition | undefined {
  const action = FLOW_MOVE_ACTIONS.find((entry) => entry.name === actionName);
  if (!action) return undefined;

  return clampNodePosition(rect, bounds, {
    x: rect.x + action.dx * Math.max(1, step),
    y: rect.y + action.dy * Math.max(1, step),
  });
}

/** Build connection choices from the same registered nodes and handles used by drag hit-testing. */
export function getFlowConnectionActions(
  sourceNode: string,
  nodes: FlowAccessibilityNode[],
  handles: FlowAccessibilityHandle[]
): FlowConnectionAction[] {
  const sources = handles.filter(
    (handle) => handle.node === sourceNode && handle.type !== 'target'
  );
  if (sources.length === 0) return [];

  const actions: FlowConnectionAction[] = [];
  for (const source of sources) {
    for (const targetNode of nodes) {
      if (targetNode.id === sourceNode) continue;
      const targets = handles.filter(
        (handle) => handle.node === targetNode.id && handle.type !== 'source'
      );

      if (targets.length === 0) {
        actions.push({
          name: flowConnectionActionName(
            { node: source.node, handle: source.id },
            { node: targetNode.id }
          ),
          label: `Connect ${source.label} to ${targetNode.label}`,
          connection: {
            source: sourceNode,
            sourceHandle: source.id,
            target: targetNode.id,
          },
        });
        continue;
      }

      for (const target of targets) {
        actions.push({
          name: flowConnectionActionName(
            { node: source.node, handle: source.id },
            { node: target.node, handle: target.id }
          ),
          label: `Connect ${source.label} to ${targetNode.label}, ${target.label}`,
          connection: {
            source: sourceNode,
            sourceHandle: source.id,
            target: target.node,
            targetHandle: target.id,
          },
        });
      }
    }
  }
  return actions;
}
