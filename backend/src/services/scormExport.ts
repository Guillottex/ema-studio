import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { planScormPackage, validateCourse, type CourseDoc, type PackagePlan, type ValidationReport, type Issue } from '@engine';
import { config, exportsDir } from '../config';
import { assetPath, assetExists } from './media';

export function engineFile(rel: string): string | null {
  const p = path.join(config.engineDist, rel);
  return fs.existsSync(p) ? p : null;
}

/** Valida el manifest generado y que todos los archivos referenciados existan. */
export function validatePlan(plan: PackagePlan): Issue[] {
  const issues: Issue[] = [];
  const manifest = plan.text['imsmanifest.xml'];
  const v = XMLValidator.validate(manifest);
  if (v !== true) {
    issues.push({ level: 'error', code: 'manifest.xml', message: `imsmanifest.xml mal formado: ${v.err.msg} (línea ${v.err.line})` });
    return issues;
  }
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' }).parse(manifest);
  const m = parsed.manifest;
  if (!m?.organizations?.organization) issues.push({ level: 'error', code: 'manifest.org', message: 'El manifest no tiene organización' });
  if (m?.metadata?.schemaversion !== 1.2 && m?.metadata?.schemaversion !== '1.2') issues.push({ level: 'error', code: 'manifest.schema', message: 'schemaversion debe ser 1.2' });
  const ids: string[] = [m['@identifier'], m.organizations?.organization?.['@identifier'], m.organizations?.organization?.item?.['@identifier'], m.resources?.resource?.['@identifier']];
  if (new Set(ids).size !== ids.length || ids.some((x) => !x)) issues.push({ level: 'error', code: 'manifest.ids', message: 'Identificadores del manifest faltantes o duplicados' });
  if (m.organizations?.organization?.item?.['@identifierref'] !== m.resources?.resource?.['@identifier']) issues.push({ level: 'error', code: 'manifest.ref', message: 'El ítem no referencia correctamente al recurso SCO' });
  if (m.resources?.resource?.['@adlcp:scormtype'] !== 'sco') issues.push({ level: 'error', code: 'manifest.sco', message: 'El recurso principal debe ser de tipo SCO' });
  const files = [].concat(m.resources?.resource?.file || []).map((f: any) => f['@href']);
  if (!files.includes('index.html')) issues.push({ level: 'error', code: 'manifest.index', message: 'index.html no está declarado en el manifest' });
  const available = new Set([...Object.keys(plan.text), ...Object.keys(plan.assets), ...Object.values(plan.engine)]);
  files.forEach((f: string) => { if (!available.has(f)) issues.push({ level: 'error', code: 'manifest.file', message: `El manifest referencia un archivo inexistente: ${f}` }); });
  for (const [src, dest] of Object.entries(plan.engine)) if (!engineFile(src)) issues.push({ level: 'error', code: 'engine.missing', message: `Falta el archivo del motor ${src} (destino ${dest}). Ejecutá el build del scorm-engine.` });
  for (const [dest, name] of Object.entries(plan.assets)) if (!assetPath(name)) issues.push({ level: 'error', code: 'asset.missing', message: `Recurso faltante: ${name} (${dest})` });
  return issues;
}

/** Validación completa: contenido del curso + paquete SCORM */
export function fullValidation(doc: CourseDoc): ValidationReport & { plan: PackagePlan } {
  const report = validateCourse(doc, assetExists);
  const plan = planScormPackage(doc);
  const pkgIssues = validatePlan(plan);
  // evitar duplicar "recurso faltante" ya reportado por el validador de curso
  const extra = pkgIssues.filter((i) => i.code !== 'asset.missing' || !report.issues.some((r) => r.code === 'asset.missing'));
  const issues = [...report.issues, ...extra];
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const lvl = (codes: string[]) => {
    const rel = pkgIssues.filter((i) => codes.some((c) => i.code.startsWith(c)));
    return rel.some((i) => i.level === 'error') ? 'error' : rel.length ? 'warning' : 'ok';
  };
  const checks = [
    { name: 'Manifest (imsmanifest.xml)', level: lvl(['manifest.']) as any, detail: lvl(['manifest.']) === 'ok' ? 'SCORM 1.2 válido' : 'Con errores' },
    { name: 'Archivos del paquete', level: lvl(['engine.', 'asset.']) as any, detail: `${Object.keys(plan.text).length + Object.keys(plan.assets).length + Object.keys(plan.engine).length} archivos` },
    ...report.checks,
  ];
  return { valid: errors === 0, errors, warnings, issues, checks, plan };
}

/** Lee el contenido de un archivo del paquete (para la previsualización sin generar ZIP). */
export function readPlanFile(plan: PackagePlan, rel: string): { body: Buffer | string; file?: string } | null {
  if (plan.text[rel] !== undefined) return { body: plan.text[rel] };
  if (plan.assets[rel]) {
    const p = assetPath(plan.assets[rel]);
    return p ? { body: '', file: p } : null;
  }
  const src = Object.entries(plan.engine).find(([, dest]) => dest === rel)?.[0];
  if (src) {
    const p = engineFile(src);
    return p ? { body: '', file: p } : null;
  }
  return null;
}

/** Genera el ZIP SCORM 1.2 en disco y devuelve su ruta y tamaño. */
export async function writeScormZip(plan: PackagePlan, exportId: string): Promise<{ filePath: string; size: number; files: number }> {
  fs.mkdirSync(exportsDir(), { recursive: true });
  const filePath = path.join(exportsDir(), `${exportId}.zip`);
  const out = fs.createWriteStream(filePath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  let files = 0;
  const done = new Promise<void>((resolve, reject) => {
    out.on('close', () => resolve());
    archive.on('error', reject);
    out.on('error', reject);
  });
  archive.pipe(out);
  // imsmanifest.xml en la raíz, primero
  archive.append(plan.text['imsmanifest.xml'], { name: 'imsmanifest.xml' });
  files++;
  // estructura de carpetas estándar del paquete (aunque alguna quede vacía)
  for (const dir of ['assets/', 'css/', 'js/', 'images/', 'media/', 'scorm/']) archive.append('', { name: dir });
  for (const [name, content] of Object.entries(plan.text)) {
    if (name === 'imsmanifest.xml') continue;
    archive.append(content, { name });
    files++;
  }
  for (const [src, dest] of Object.entries(plan.engine)) {
    archive.file(engineFile(src)!, { name: dest });
    files++;
  }
  for (const [dest, assetName] of Object.entries(plan.assets)) {
    const p = assetPath(assetName);
    // los videos/audios ya están comprimidos: se guardan sin recomprimir
    archive.file(p!, { name: dest, store: /\.(mp4|mp3|jpg|jpeg|png|webp|gif)$/i.test(dest) } as any);
    files++;
  }
  await archive.finalize();
  await done;
  return { filePath, size: fs.statSync(filePath).size, files };
}
