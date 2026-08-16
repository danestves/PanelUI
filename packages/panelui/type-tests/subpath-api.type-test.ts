import { Meter, type MeterProps } from 'panelui-native/components/meter';
import { Planner, type PlannerProps } from 'panelui-native/components/planner';
import { useBreakpoint } from 'panelui-native/hooks/use-breakpoint';
import { PanelUIProvider, type PanelUIProviderProps } from 'panelui-native/provider';
import { AnimatedPressable } from 'panelui-native/primitives/animated-pressable';
import { Scrim, type ScrimProps } from 'panelui-native/primitives/scrim';
import { useTheme, type ThemeName } from 'panelui-native/theme';
import { cn } from 'panelui-native/utils/cn';
import { formatTime, type TimeValue } from 'panelui-native/utils/time';

const meter: typeof Meter = Meter;
const meterProps: MeterProps = { value: 50 };
const planner: typeof Planner = Planner;
const plannerProps: PlannerProps = { entries: [] };
const provider: typeof PanelUIProvider = PanelUIProvider;
const providerProps: PanelUIProviderProps = { children: null };
const pressable: typeof AnimatedPressable = AnimatedPressable;
const scrim: typeof Scrim = Scrim;
const scrimProps: ScrimProps = {};
const theme: ThemeName = 'system';
const time: TimeValue = { hour: 9, minute: 30 };

void [
  meter, meterProps, planner, plannerProps, provider, providerProps, pressable,
  scrim, scrimProps, theme, useBreakpoint, useTheme, cn('p-2'), formatTime(time),
];
