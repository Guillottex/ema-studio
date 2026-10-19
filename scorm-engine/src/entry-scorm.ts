import { ScormConnection, LocalAPI, findAPI, toCMITimespan, parseCMITimespan } from './runtime/scorm12';
(window as any).EMAScorm = { ScormConnection, LocalAPI, findAPI, toCMITimespan, parseCMITimespan };
