import type { ReactNode } from "react";

export interface Demo {
  label: string;
  render: () => ReactNode;
  fullPage?: boolean;
  id?: string;
  description?: string;
  fullBleed?: boolean;
}

export type ComponentLayout = "sections" | "pager";

export interface ComponentEntry {
  slug: string;
  name: string;
  summary: string;
  layout?: ComponentLayout;
  demos: Demo[];
}
