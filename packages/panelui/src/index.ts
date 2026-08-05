// Providers
export { PanelUIProvider, type PanelUIProviderProps } from './providers/panel-ui-provider';

// Theme
export {
  useTheme,
  useThemeMode,
  PANEL_THEMES,
  PANEL_THEME_NAMES,
  PANEL_EXTRA_THEMES,
  type ThemeName,
  type ThemeMode,
  type PanelTheme,
  type PanelThemeFamily,
} from './theme/use-theme';

// Primitives
export { Portal, PortalHost, PortalProvider } from './primitives/portal';
// The companion to Portal: the layer that makes the screen behind an overlay
// recede. Public so a custom overlay gets the same backdrop — and the same
// graceful fall back from blur to dim — as the built-in ones.
export { Scrim, hasBlur, type ScrimProps } from './primitives/scrim';
export { Text, type TextProps } from './primitives/text';
export { Collapse, type CollapseProps } from './primitives/collapse';
export {
  KeyboardAvoider,
  type KeyboardAvoiderProps,
} from './primitives/keyboard-avoider';
export {
  AnimatedPressable,
  type AnimatedPressableProps,
} from './primitives/animated-pressable';
export {
  ScrollProgress,
  useScrollProgress,
  type ScrollProgressProps,
  type ScrollProgressValue,
} from './primitives/scroll-progress';

// Native UI bridge
export { hasNativeUI } from './native';
export { hasHaptics, selectionTick } from './utils/haptics';

// Components
export {
  Accordion,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionIndicatorProps,
  type AccordionContentProps,
  type AccordionVariant,
  type AccordionSelectionMode,
} from './components/accordion';
export {
  Alert,
  type AlertProps,
  type AlertIndicatorProps,
} from './components/alert';
export {
  Avatar,
  type AvatarProps,
  type AvatarBadgeProps,
} from './components/avatar';
export {
  Attachment,
  type AttachmentProps,
  type AttachmentGroupProps,
  type AttachmentMediaProps,
  type AttachmentContentProps,
  type AttachmentTitleProps,
  type AttachmentDescriptionProps,
  type AttachmentActionsProps,
  type AttachmentActionProps,
  type AttachmentState,
} from './components/attachment';
export {
  AreaChart,
  useAreaChart,
  type AreaChartProps,
  type AreaChartHandle,
  type AreaChartGridProps,
  type AreaChartHeaderProps,
  type AreaChartAreaProps,
  type AreaChartXAxisProps,
  type AreaChartYAxisProps,
  type AreaChartTooltipProps,
  type AreaChartLegendProps,
  type AreaChartDatum,
  type AreaChartStatus,
} from './components/area-chart';
export { Badge, type BadgeProps } from './components/badge';
export {
  BarChart,
  useBarChart,
  type BarChartProps,
  type BarChartHandle,
  type BarChartHeaderProps,
  type BarChartGridProps,
  type BarChartBarProps,
  type BarChartXAxisProps,
  type BarChartYAxisProps,
  type BarChartTooltipProps,
  type BarChartLegendProps,
  type BarChartDatum,
  type BarChartStatus,
  type BarChartOrientation,
} from './components/bar-chart';
export {
  BottomSheet,
  type BottomSheetProps,
  type BottomSheetContentProps,
  type BottomSheetHeaderProps,
  type BottomSheetBodyProps,
  type BottomSheetFooterProps,
} from './components/bottom-sheet';
export {
  Breadcrumb,
  type BreadcrumbProps,
  type BreadcrumbListProps,
  type BreadcrumbItemProps,
  type BreadcrumbLinkProps,
  type BreadcrumbPageProps,
  type BreadcrumbSeparatorProps,
  type BreadcrumbEllipsisProps,
} from './components/breadcrumb';
export { Button, type ButtonProps } from './components/button';
export {
  ToggleButton,
  ToggleButtonGroup,
  useToggleButton,
  type ToggleButtonProps,
  type ToggleButtonGroupProps,
  type ToggleButtonLabelProps,
  type ToggleButtonSize,
  type ToggleButtonVariant,
  type ToggleSelectionMode,
} from './components/toggle-button';
export {
  DatePicker,
  type DatePickerProps,
  type DatePickerMode,
} from './components/date-picker';
export {
  Dialog,
  type DialogProps,
  type DialogContentProps,
} from './components/dialog';
export {
  Soundwave,
  type SoundwaveProps,
  type SoundwaveState,
  type SoundwaveVariant,
} from './components/soundwave';
export {
  Direction,
  useDirection,
  useDirectionSign,
  type DirectionProps,
  type DirectionValue,
} from './components/direction';
export {
  Flow,
  type FlowProps,
  type FlowNodeProps,
  type FlowHandleProps,
  type FlowEdgeProps,
  type FlowGroupProps,
  type FlowBackgroundProps,
  type FlowControlsProps,
  type FlowMiniMapProps,
  type FlowConnection,
  type FlowViewport,
  type FlowNodePosition,
  type FlowEdgeVariant,
  type FlowSide,
  type FlowRect,
  type FlowPoint,
} from './components/flow';
export {
  Frame,
  type FrameProps,
  type FrameRootProps,
  type FramePanelProps,
  type FrameRowProps,
  type FrameSectionProps,
  type FrameHeaderProps,
  type FrameActionProps,
  type FrameMediaProps,
  type FrameContentProps,
  type FrameActionsProps,
  type FrameVariant,
} from './components/frame';
export {
  HeatmapChart,
  useHeatmapChart,
  buildHeatmapCalendar,
  type HeatmapChartProps,
  type HeatmapCellsProps,
  type HeatmapSeparatorProps,
  type HeatmapXAxisProps,
  type HeatmapYAxisProps,
  type HeatmapTooltipProps,
  type HeatmapLegendProps,
  type HeatmapColumn,
  type HeatmapBin,
  type HeatmapCell,
  type HeatmapLayout,
} from './components/heatmap-chart';
export {
  Map,
  useMap,
  hasMapLibre,
  CARTO_SOURCE,
  type MapProps,
  type MapHandle,
  type MapMarkerProps,
  type MapLabelProps,
  type MapPopupProps,
  type MapControlsProps,
  type MapControlsPosition,
  type MapRouteProps,
  type MapArcProps,
  type MapGeoJSONProps,
  type MapClusterProps,
  type MapHeatmapProps,
  type MapUserLocationProps,
  type BasemapSource,
  type BasemapTokens,
  type LngLat,
  type LngLatBounds,
  type ViewState,
} from './components/map';
export {
  RadarChart,
  useRadarChart,
  type RadarChartProps,
  type RadarChartHandle,
  type RadarChartHeaderProps,
  type RadarChartGridProps,
  type RadarChartAxisProps,
  type RadarChartSeriesProps,
  type RadarChartLegendProps,
  type RadarChartDatum,
  type RadarChartStatus,
} from './components/radar-chart';
export {
  Select,
  type SelectProps,
  type SelectItemProps,
  type SelectGroupProps,
  type SelectPresentation,
} from './components/select';
export {
  SectionRail,
  type SectionRailProps,
  type SectionRailTriggerProps,
  type SectionRailBarProps,
  type SectionRailContentProps,
  type SectionRailItemProps,
  type SectionRailPlacement,
  type SectionRailAlign,
} from './components/section-rail';
export {
  Tabs,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
} from './components/tabs';
export {
  Table,
  type TableProps,
  type TableFrameProps,
  type TableHeaderProps,
  type TableBodyProps,
  type TableFooterProps,
  type TableRowProps,
  type TableHeadProps,
  type TableCellProps,
  type TableCaptionProps,
  type TableEmptyProps,
  type TableColumn,
  type TableSortDirection,
} from './components/table';
export {
  Carousel,
  useCarouselState,
  type CarouselProps,
  type CarouselHandle,
  type CarouselContentProps,
  type CarouselItemProps,
  type CarouselCaptionProps,
  type CarouselDotsProps,
  type CarouselArrowProps,
  type CarouselControlsProps,
  type CarouselVariant,
  type CarouselOrientation,
  type CarouselAlign,
} from './components/carousel';
export {
  Calendar,
  type CalendarProps,
  type CalendarHeaderProps,
  type CalendarNavProps,
  type CalendarMode,
  type CalendarCaptionLayout,
  type CalendarDisabled,
  type CalendarSelection,
  type DateRange,
} from './components/calendar';
export { Card, type CardProps } from './components/card';
export { Checkbox, type CheckboxProps } from './components/checkbox';
export {
  Chip,
  useChip,
  type ChipProps,
  type ChipLabelProps,
  type ChipVariant,
  type ChipSize,
} from './components/chip';
export {
  ColorPicker,
  type ColorPickerProps,
  type ColorPickerFieldProps,
  type ColorPickerAreaProps,
  type ColorPickerWheelProps,
  type ColorPickerChannelProps,
  type ColorPickerChannel,
  type ColorPickerHueProps,
  type ColorPickerBrightnessProps,
  type ColorPickerAlphaProps,
  type ColorPickerPreviewProps,
  type ColorPickerSwatchesProps,
  type ColorPickerSize,
} from './components/color-picker';
export {
  Combobox,
  type ComboboxProps,
  type ComboboxItemProps,
  type ComboboxGroupProps,
  type ComboboxMode,
  type ComboboxSelection,
  type ComboboxPresentation,
} from './components/combobox';
export {
  Drawer,
  type DrawerProps,
  type DrawerTriggerProps,
  type DrawerContentProps,
  type DrawerHeaderProps,
  type DrawerBodyProps,
  type DrawerFooterProps,
  type DrawerCloseProps,
  type DrawerSide,
  type DrawerSize,
  type DrawerCloseSide,
} from './components/drawer';
export {
  EmptyState,
  type EmptyStateProps,
  type EmptyStateMediaProps,
} from './components/empty-state';
export {
  Field,
  type FieldProps,
  type FieldContentProps,
  type FieldLabelProps,
  type FieldDescriptionProps,
  type FieldErrorProps,
  type FieldSetProps,
  type FieldLegendProps,
  type FieldGroupProps,
  type FieldSeparatorProps,
  type FieldTitleProps,
} from './components/field';
export {
  Form,
  useForm,
  useField,
  type FormProps,
  type FormFieldProps,
  type FormApi,
  type FieldErrors,
  type FieldTouched,
  type FieldState,
  type UseFormOptions,
  type Validator,
  type FormFieldRenderProps,
  type UseFieldOptions,
} from './components/form';
export { Input, type InputProps } from './components/input';
export {
  InputGroup,
  type InputGroupProps,
  type InputGroupInputProps,
  type InputGroupDecoratorProps,
} from './components/input-group';
export {
  NumberInput,
  type NumberInputProps,
} from './components/number-input';
export { OtpInput, type OtpInputProps } from './components/otp-input';
export {
  Panelside,
  usePanelside,
  type PanelsideProps,
  type PanelsidePanelProps,
  type PanelsideHeaderProps,
  type PanelsideSearchProps,
  type PanelsideContentProps,
  type PanelsideGroupProps,
  type PanelsideGroupLabelProps,
  type PanelsideItemProps,
  type PanelsideActionProps,
  type PanelsideFooterProps,
  type PanelsideCtaProps,
  type PanelsideSceneProps,
  type PanelsideTriggerProps,
  type PanelsideMode,
  type PanelsideSwipeFrom,
  type PanelsideItemSize,
  type PanelsideCtaSize,
  type UsePanelsideResult,
} from './components/panelside';
export {
  Pagination,
  paginationRange,
  type PaginationProps,
  type PaginationItemProps,
  type PaginationPreviousProps,
  type PaginationNextProps,
  type PaginationEllipsisProps,
  type PaginationSummaryProps,
  type PaginationStatusProps,
  type PaginationVariant,
  type PaginationSize,
  type PaginationItemValue,
} from './components/pagination';
export {
  PieChart,
  usePieChart,
  type PieChartProps,
  type PieChartHandle,
  type PieChartHeaderProps,
  type PieChartSlicesProps,
  type PieChartCenterProps,
  type PieChartLegendProps,
  type PieChartSkeletonProps,
  type PieChartStatus,
  type PieDatum,
} from './components/pie-chart';
export { Textarea, type TextareaProps } from './components/textarea';
export {
  Item,
  type ItemProps,
  type ItemGroupProps,
  type ItemSeparatorProps,
  type ItemMediaProps,
  type ItemContentProps,
  type ItemTitleProps,
  type ItemDescriptionProps,
  type ItemActionsProps,
  type ItemHeaderProps,
  type ItemFooterProps,
} from './components/item';
export {
  Kpi,
  type KpiProps,
  type KpiHeaderProps,
  type KpiIconProps,
  type KpiTitleProps,
  type KpiStatProps,
  type KpiActionsProps,
  type KpiContentProps,
  type KpiValueProps,
  type KpiTrendProps,
  type KpiSparklineProps,
  type KpiProgressProps,
  type KpiFooterProps,
  type KpiSeparatorProps,
  type KpiGroupProps,
  type KpiGroupOrientation,
  type KpiGoodDirection,
  type KpiTone,
} from './components/kpi';
export { Label, type LabelProps, type LabelTextProps } from './components/label';
export {
  LineChart,
  useLineChart,
  type LineChartProps,
  type LineChartHandle,
  type LineChartHeaderProps,
  type LineChartGridProps,
  type LineChartLineProps,
  type LineChartAreaProps,
  type LineChartSkeletonProps,
  type LineChartXAxisProps,
  type LineChartYAxisProps,
  type LineChartTooltipProps,
  type LineChartLegendProps,
  type LineChartDatum,
  type LineChartStatus,
  type LineChartCurve,
} from './components/line-chart';
export {
  Loader,
  type LoaderProps,
  type LoaderVariant,
  type LoaderSize,
} from './components/loader';
export {
  Marker,
  type MarkerProps,
  type MarkerIconProps,
  type MarkerContentProps,
} from './components/marker';
export {
  Menu,
  type MenuProps,
  type MenuTriggerProps,
  type MenuContentProps,
  type MenuBackgroundProps,
  type MenuLabelProps,
  type MenuItemProps,
  type MenuCheckboxItemProps,
  type MenuRadioGroupProps,
  type MenuRadioItemProps,
  type MenuSeparatorProps,
  type MenuSubProps,
  type MenuSubTriggerProps,
  type MenuSubContentProps,
  type MenuItemVariant,
  type MenuRadioIndicator,
} from './components/menu';
export {
  MessageScroller,
  useMessageScroller,
  useMessageScrollerVisibility,
  type MessageScrollerProps,
  type MessageScrollerViewportProps,
  type MessageScrollerContentProps,
  type MessageScrollerItemProps,
  type MessageScrollerButtonProps,
  type MessageScrollerPosition,
} from './components/message-scroller';
export {
  Message,
  type MessageProps,
  type MessageGroupProps,
  type MessageAvatarProps,
  type MessageContentProps,
  type MessageHeaderProps,
  type MessageBubbleProps,
  type MessageBubbleContentProps,
  type MessageFooterProps,
  type MessageActionsProps,
} from './components/message';
export {
  Popover,
  type PopoverProps,
  type PopoverTriggerProps,
  type PopoverContentProps,
  type PopoverArrowProps,
  type PopoverCloseProps,
  type PopoverPlacement,
  type PopoverAlign,
  type PopoverPresentation,
} from './components/popover';
export {
  Post,
  type PostProps,
  type PostHeaderProps,
  type PostAuthorProps,
  type PostActionProps,
  type PostCommunityProps,
  type PostTitleProps,
  type PostBodyProps,
  type PostMediaProps,
  type PostFooterProps,
  type PostStatProps,
  type PostVotesProps,
  type PostVote,
} from './components/post';
export { Progress, type ProgressProps } from './components/progress';
export {
  RadioGroup,
  type RadioGroupProps,
  type RadioGroupItemProps,
} from './components/radio-group';
export {
  Rating,
  type RatingProps,
  type RatingColor,
  type RatingSize,
} from './components/rating';
export {
  RingChart,
  useRingChart,
  type RingChartProps,
  type RingChartHandle,
  type RingChartRingProps,
  type RingChartCenterProps,
  type RingChartLegendProps,
  type RingDatum,
} from './components/ring-chart';
export {
  ScatterChart,
  useScatterChart,
  type ScatterChartProps,
  type ScatterChartHandle,
  type ScatterChartHeaderProps,
  type ScatterChartGridProps,
  type ScatterChartPointsProps,
  type ScatterChartSkeletonProps,
  type ScatterChartXAxisProps,
  type ScatterChartYAxisProps,
  type ScatterChartTooltipProps,
  type ScatterChartLegendProps,
  type ScatterChartDatum,
  type ScatterChartPoint,
  type ScatterChartStatus,
} from './components/scatter-chart';
export {
  ScrollFade,
  type ScrollFadeProps,
} from './components/scroll-fade';
export { Separator, type SeparatorProps } from './components/separator';
export {
  Signature,
  hasSignatureFileSystem,
  hasSignatureRaster,
  type SignatureProps,
  type SignatureHandle,
  type SignatureFile,
  type SignatureSaveOptions,
  type SignatureToolbarProps,
  type SignatureButtonProps,
} from './components/signature';
export { Shimmer, type ShimmerProps } from './components/shimmer';
export {
  Reasoning,
  type ReasoningProps,
  type ReasoningTriggerProps,
  type ReasoningContentProps,
} from './components/reasoning';
export {
  Response,
  type ResponseProps,
  type ResponseComponents,
  type ResponseBlock,
  type ResponseInline,
} from './components/response';
export {
  Sources,
  type SourcesProps,
  type SourcesTriggerProps,
  type SourcesContentProps,
  type SourcesSourceProps,
} from './components/sources';
export {
  Task,
  type TaskProps,
  type TaskTriggerProps,
  type TaskContentProps,
  type TaskItemProps,
  type TaskFileProps,
  type TaskStatus,
} from './components/task';
export {
  CodeBlock,
  resolveLanguage,
  type CodeBlockProps,
  type CodeBlockHeaderProps,
  type CodeBlockFilenameProps,
  type CodeBlockLanguageProps,
  type CodeBlockActionsProps,
  type CodeBlockCopyButtonProps,
  type CodeLanguage,
  type Token,
  type TokenKind,
} from './components/code-block';
export {
  Plan,
  type PlanProps,
  type PlanHeaderProps,
  type PlanIconProps,
  type PlanTitleProps,
  type PlanDescriptionProps,
  type PlanActionProps,
  type PlanProgressProps,
  type PlanTriggerProps,
  type PlanContentProps,
  type PlanStepsProps,
  type PlanStepProps,
  type PlanStepStatus,
  type PlanStepCounts,
  type PlanFooterProps,
} from './components/plan';
export {
  ScrollText,
  type ScrollTextProps,
  type ScrollTextEffect,
  type ScrollTextSplit,
} from './components/scroll-text';
export {
  TextAnimation,
  type TextAnimationProps,
  type TextAnimationTypingProps,
  type TextAnimationRotatingProps,
  type TextAnimationCountingProps,
  type TextAnimationSlidingProps,
  type TextAnimationScrollingProps,
} from './components/text-animation';
export {
  ScrollCanvas,
  type ScrollCanvasProps,
  type ScrollCanvasEffect,
} from './components/scroll-canvas';
export {
  ThinkingOrb,
  type ThinkingOrbProps,
  type ThinkingOrbState,
} from './components/thinking-orb';
export { Skeleton, type SkeletonProps } from './components/skeleton';
export { Slider, type SliderProps } from './components/slider';
export { Spinner, type SpinnerProps } from './components/spinner';
export {
  Steps,
  type StepsProps,
  type StepsItemProps,
  type StepsTriggerProps,
  type StepsIndicatorProps,
  type StepsSeparatorProps,
  type StepState,
  type StepsOrientation,
} from './components/steps';
export { Surface, type SurfaceProps } from './components/surface';
export {
  Swipe,
  type SwipeProps,
  type SwipePanelProps,
  type SwipeActionProps,
  type SwipeActionColor,
  type SwipeOpenSide,
  type SwipeHandle,
} from './components/swipe';
export { Switch, type SwitchProps } from './components/switch';
export {
  TimePicker,
  type TimePickerProps,
  type TimePickerLayout,
  type TimePickerPresentation,
} from './components/time-picker';
export {
  Timeline,
  type TimelineProps,
  type TimelineItemProps,
  type TimelineIndicatorProps,
  type TimelineStatProps,
  type TimelineVariant,
  type TimelineTone,
} from './components/timeline';
export {
  Toast,
  ToastViewport,
  toast,
  useToast,
  type ToastProps,
  type ToastOptions,
  type ToastItem,
  type ToastVariant,
  type ToastPlacement,
  type ToastHandle,
  type ToastIndicatorProps,
  type ToastCloseProps,
} from './components/toast';
export {
  Tooltip,
  type TooltipProps,
  type TooltipTriggerProps,
  type TooltipContentProps,
  type TooltipArrowProps,
  type TooltipTitleProps,
  type TooltipDescriptionProps,
  type TooltipPlacement,
  type TooltipAlign,
  type TooltipOpenOn,
  type TooltipVariant,
} from './components/tooltip';
export {
  Typography,
  type TypographyProps,
  type TypographyType,
  type TypographyHeadingProps,
  type TypographyParagraphProps,
  type TypographyCodeProps,
} from './components/typography';

// Icons
export {
  AlertTriangleIcon,
  AppleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  BellIcon,
  BookmarkIcon,
  CalendarIcon,
  CardIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleIcon,
  ClockIcon,
  CompassIcon,
  CopyIcon,
  CrosshairIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  FacebookIcon,
  FileIcon,
  GoogleIcon,
  HeartIcon,
  IconColorProvider,
  InfoIcon,
  ImageIcon,
  KeyboardIcon,
  LinkIcon,
  ListChecksIcon,
  LockIcon,
  MaximizeIcon,
  MenuIcon,
  MessageCircleIcon,
  MicIcon,
  MinusIcon,
  MoonIcon,
  PackageIcon,
  PaperclipIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  PlusSquareIcon,
  ReceiptIcon,
  RepeatIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SearchIcon,
  SendIcon,
  ShareNodesIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
  UnlockIcon,
  XIcon,
  useIconColor,
  type IconProps,
  type ToggleIconProps,
  type BadgeCheckIconProps,
} from './icons';

// Hooks
export * from './hooks';

// Utils
export { cn } from './utils/cn';
export {
  formatColor,
  hsvToCss,
  hsvToHex,
  hsvToHsl,
  hsvToRgb,
  isValidColor,
  parseColor,
  rgbToHsv,
  type ColorFormat,
  type HsvaColor,
} from './utils/color';
export {
  clampTime,
  compareTime,
  displayHour,
  formatTime,
  isSameTime,
  isTimeInRange,
  meridiemLabels,
  minutesToTime,
  roundToStep,
  timeFromDate,
  timeToDate,
  timeToMinutes,
  timesOfDay,
  type HourCycle,
  type TimeValue,
} from './utils/time';
