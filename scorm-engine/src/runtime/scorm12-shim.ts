/**
 * En el paquete SCORM, el adaptador de la API vive en scorm/scorm12.js (cargado antes que el player).
 * Este módulo lo toma de window.EMAScorm. El build del player reemplaza './scorm12' por este shim.
 */
import type * as S from './scorm12';
const mod = (window as any).EMAScorm as typeof S;
if (!mod) throw new Error('EMA: falta scorm/scorm12.js');
export const ScormConnection = mod.ScormConnection;
export const LocalAPI = mod.LocalAPI;
export const findAPI = mod.findAPI;
export const toCMITimespan = mod.toCMITimespan;
export const parseCMITimespan = mod.parseCMITimespan;
export type Scorm12API = S.Scorm12API;
