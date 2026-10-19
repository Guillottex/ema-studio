/** Punto de entrada para frontend y backend (código fuente compartido). */
export * from './types';
export * from './themes';
export * from './layouts';
export * from './validate';
export * from './export';
export * from './registry';
export * from './assessment/grading';
export * from './assessment/factory';
export { renderInner, innerStyle, outerStyle, boxFor, stageMode, stageHeight, flowOrder, isBackdrop, breakpointFor, animationClasses, responsiveFontSize } from './render/stage';
export { ICON_NAMES, iconSvgString } from './render/icons';
export { NAV_TARGETS } from './registry/components/navigation';
export { toEmbedUrl } from './registry/components/media';
export { encodeSuspend, decodeSuspend, encodeRanges, decodeRanges, locationLabel, SUSPEND_LIMIT } from './runtime/tracking';
export { toCMITimespan, parseCMITimespan } from './runtime/scorm12';
