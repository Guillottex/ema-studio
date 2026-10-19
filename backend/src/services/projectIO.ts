import fs from 'node:fs';
import { collectAssetRefs, SCHEMA_VERSION, type CourseDoc, type ProjectAsset } from '@engine';
import { query } from '../db';
import { HttpError } from '../middleware/error';
import { assembleCourse, createCourseFromDoc } from './courseTree';
import { assetPath, storeMedia } from './media';

/** Exporta el proyecto editable (.json), opcionalmente con los recursos embebidos en base64. */
export async function exportProject(courseId: string, includeMedia = true): Promise<CourseDoc & { exportedAt: string; generator: string }> {
  const doc = await assembleCourse(courseId);
  const refs = [...collectAssetRefs(doc)];
  const assets: Record<string, ProjectAsset> = {};
  if (includeMedia && refs.length) {
    const rows = await query(`SELECT stored_name, name, mime, size FROM media WHERE stored_name = ANY($1)`, [refs]);
    for (const r of rows) {
      const p = assetPath(r.stored_name);
      if (!p) continue;
      assets[r.stored_name] = { name: r.name, mime: r.mime, size: Number(r.size), data: fs.readFileSync(p).toString('base64') };
    }
  }
  return { ...doc, assets: includeMedia ? assets : undefined, exportedAt: new Date().toISOString(), generator: 'EMA Studio' };
}

export function assertCourseDoc(doc: any): asserts doc is CourseDoc {
  if (!doc || typeof doc !== 'object') throw new HttpError(400, 'El archivo no es un proyecto válido');
  if (!Array.isArray(doc.modules)) throw new HttpError(400, 'El proyecto no tiene la estructura de módulos esperada');
  if (doc.schemaVersion && doc.schemaVersion > SCHEMA_VERSION) throw new HttpError(400, `El proyecto fue creado con una versión más nueva del esquema (${doc.schemaVersion})`);
  for (const m of doc.modules) {
    if (!m || !Array.isArray(m.lessons)) throw new HttpError(400, 'Módulo inválido en el proyecto');
    for (const l of m.lessons) {
      if (!l || !Array.isArray(l.screens)) throw new HttpError(400, 'Lección inválida en el proyecto');
      for (const s of l.screens) {
        if (!s || !Array.isArray(s.components)) throw new HttpError(400, 'Pantalla inválida en el proyecto');
        for (const c of s.components) if (!c || typeof c.type !== 'string' || !c.layout?.desktop) throw new HttpError(400, 'Componente inválido en el proyecto');
      }
    }
  }
}

/** Importa un proyecto .json como curso nuevo. Restaura recursos embebidos y reescribe referencias si cambian de nombre. */
export async function importProject(raw: any, userId: string, title?: string): Promise<{ courseId: string; restoredAssets: number; missingAssets: string[] }> {
  assertCourseDoc(raw);
  const doc = raw as CourseDoc;
  const rename = new Map<string, string>();
  let restored = 0;
  for (const [key, a] of Object.entries(doc.assets || {})) {
    if (!a?.data) continue;
    const ext = key.split('.').pop() || '';
    const row = await storeMedia(a.name && a.name.endsWith('.' + ext) ? a.name : `${a.name || 'recurso'}.${ext}`, Buffer.from(a.data, 'base64'), userId);
    if (row.stored_name !== key) rename.set(key, row.stored_name);
    restored++;
  }
  delete doc.assets;
  let json = JSON.stringify(doc);
  for (const [from, to] of rename) json = json.split(`asset:${from}`).join(`asset:${to}`);
  const finalDoc: CourseDoc = JSON.parse(json);
  const missing = [...collectAssetRefs(finalDoc)].filter((n) => !assetPath(n));
  const courseId = await createCourseFromDoc(finalDoc, { userId, title: title || finalDoc.title, status: 'draft' });
  return { courseId, restoredAssets: restored, missingAssets: missing };
}
