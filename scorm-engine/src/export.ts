import type { CourseDoc } from './types';
import { flattenScreens } from './types';
import { collectAssetRefs } from './validate';
import { FONTS, usedEmbeddedFonts } from './themes';

const IMAGE_EXT = /\.(jpe?g|png|gif|svg|webp)$/i;

export function xmlEscape(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function slugify(s: string): string {
  return (
    String(s || 'curso')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'curso'
  );
}

/** Identificador XML válido (NCName) */
export function xmlId(prefix: string, s: string): string {
  return `${prefix}-${String(s).replace(/[^A-Za-z0-9_.-]/g, '_')}`;
}

/** Archivos del motor (dist del scorm-engine) que se copian a cada paquete: origen → destino en el ZIP */
export const ENGINE_FILES: Record<string, string> = {
  'player.js': 'js/player.js',
  'player.css': 'css/player.css',
  'scorm12.js': 'scorm/scorm12.js',
};

export function fontFilesFor(fonts: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fonts) {
    for (const w of [400, 700]) out[`fonts/${f}-latin-${w}-normal.woff2`] = `assets/fonts/${f}-latin-${w}-normal.woff2`;
  }
  return out;
}

export function fontsCss(fonts: string[]): string {
  return fonts
    .map((f) => {
      const family = FONTS.find((x) => x.embedded === f)?.id || f;
      return [400, 700]
        .map((w) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url('../assets/fonts/${f}-latin-${w}-normal.woff2') format('woff2');}`)
        .join('\n');
    })
    .join('\n');
}

export function courseFonts(doc: CourseDoc): string[] {
  const ids = new Set<string>([doc.settings.theme.fonts.heading, doc.settings.theme.fonts.body]);
  flattenScreens(doc).forEach((f) => f.screen.components.forEach((c) => c.style?.fontFamily && ids.add(c.style.fontFamily)));
  return usedEmbeddedFonts([...ids]);
}

export interface PackagePlan {
  /** archivos de texto generados: ruta en ZIP → contenido */
  text: Record<string, string>;
  /** recursos de la biblioteca: ruta en ZIP → nombre interno del recurso */
  assets: Record<string, string>;
  /** archivos del motor: ruta en dist → ruta en ZIP */
  engine: Record<string, string>;
  fileName: string;
}

export function hasFinalQuiz(doc: CourseDoc): boolean {
  return flattenScreens(doc).some((f) => f.screen.components.some((c) => c.type === 'quiz' && c.props.isFinal));
}

export function masteryScore(doc: CourseDoc): number | null {
  const crit = doc.settings.completion?.criteria;
  if (crit !== 'quiz' && crit !== 'both') return null;
  for (const f of flattenScreens(doc)) {
    const q = f.screen.components.find((c) => c.type === 'quiz' && c.props.isFinal);
    if (q) return Math.max(0, Math.min(100, Number(q.props.passingScore) || 0));
  }
  return null;
}

export function buildManifest(doc: CourseDoc, files: string[]): string {
  const id = xmlId('EMA', doc.id);
  const mastery = masteryScore(doc);
  const title = xmlEscape(doc.title);
  const fileTags = files
    .filter((f) => f !== 'imsmanifest.xml')
    .sort()
    .map((f) => `      <file href="${xmlEscape(f)}"/>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="${xmlEscape(doc.version || '1.0')}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${id}-ORG">
    <organization identifier="${id}-ORG">
      <title>${title}</title>
      <item identifier="${id}-ITEM" identifierref="${id}-RES" isvisible="true">
        <title>${title}</title>${mastery !== null ? `\n        <adlcp:masteryscore>${mastery}</adlcp:masteryscore>` : ''}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${id}-RES" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileTags}
    </resource>
  </resources>
</manifest>
`;
}

export function buildIndexHtml(doc: CourseDoc, hasFonts: boolean): string {
  return `<!doctype html>
<html lang="${xmlEscape(doc.language || 'es')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="EMA Studio">
<title>${xmlEscape(doc.title)}</title>
${hasFonts ? '<link rel="stylesheet" href="css/fonts.css">\n' : ''}<link rel="stylesheet" href="css/player.css">
</head>
<body class="ema-body-page">
<div id="ema-app" class="ema-root ema-loading"><div class="ema-boot">Cargando curso…</div></div>
<noscript>Este curso requiere JavaScript habilitado.</noscript>
<script src="scorm/scorm12.js"></script>
<script src="js/course-data.js"></script>
<script src="js/player.js"></script>
<script src="js/boot.js"></script>
</body>
</html>
`;
}

export const BOOT_JS = `(function () {
  function boot() {
    var root = document.getElementById('ema-app');
    root.classList.remove('ema-loading');
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    var player = new EMAPlayer.Player(root, window.EMA_COURSE, {
      assetBase: 'media/',
      assetMap: window.EMA_ASSET_MAP || {},
      startScreen: params.get('screen') || undefined
    });
    window.EMA_PLAYER = player;
    player.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
`;

/**
 * Plan de archivos de un paquete SCORM 1.2.
 * El backend lo materializa en un ZIP (leyendo recursos de la biblioteca y archivos del motor).
 */
export function planScormPackage(doc: CourseDoc): PackagePlan {
  const clean: CourseDoc = JSON.parse(JSON.stringify(doc));
  delete clean.assets;
  const refs = [...collectAssetRefs(clean)];
  const assets: Record<string, string> = {};
  const assetMap: Record<string, string> = {};
  for (const name of refs) {
    const path = (IMAGE_EXT.test(name) ? 'images/' : 'media/') + name;
    assets[path] = name;
    assetMap[name] = path;
  }
  const fonts = courseFonts(clean);
  const engine: Record<string, string> = { ...ENGINE_FILES, ...fontFilesFor(fonts) };
  const text: Record<string, string> = {
    'index.html': buildIndexHtml(clean, fonts.length > 0),
    'js/course-data.js': `window.EMA_COURSE = ${JSON.stringify(clean).replace(/</g, '\\u003c')};\nwindow.EMA_ASSET_MAP = ${JSON.stringify(assetMap)};\n`,
    'js/boot.js': BOOT_JS,
  };
  if (fonts.length) text['css/fonts.css'] = fontsCss(fonts);
  const allFiles = [...Object.keys(text), ...Object.keys(assets), ...Object.values(engine)];
  text['imsmanifest.xml'] = buildManifest(clean, allFiles);
  return { text, assets, engine, fileName: `${slugify(doc.title)}-scorm12.zip` };
}
