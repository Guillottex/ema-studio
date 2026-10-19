import { h } from '../../render/dom';
import { icon } from '../../render/icons';
import type { ComponentDef, RenderCtx } from '../types';

function placeholder(label: string, ic: string) {
  return h('div', { class: 'ema-placeholder' }, icon(ic, 36), h('span', null, label));
}

export function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  let m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
  m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  if (/^https:\/\//.test(url)) return url;
  return null;
}

function lightbox(ctx: RenderCtx, src: string, caption?: string) {
  ctx.openDialog({ size: 'lg', node: h('figure', { class: 'ema-lightbox' }, h('img', { src, alt: caption || '' }), caption ? h('figcaption', null, caption) : null) });
}

export const mediaComponents: ComponentDef[] = [
  {
    type: 'image',
    label: 'Imagen',
    category: 'media',
    icon: 'image',
    defaultSize: { w: 480, h: 320 },
    defaultProps: () => ({ src: '', alt: '', fit: 'cover', caption: '', zoom: false }),
    defaultStyle: () => ({ borderRadius: 12 }),
    fields: [
      { key: 'src', label: 'Imagen', type: 'media', accept: 'image' },
      { key: 'alt', label: 'Texto alternativo (accesibilidad)', type: 'text' },
      { key: 'fit', label: 'Ajuste', type: 'select', options: [{ value: 'cover', label: 'Cubrir' }, { value: 'contain', label: 'Contener' }, { value: 'fill', label: 'Estirar' }] },
      { key: 'caption', label: 'Epígrafe', type: 'text' },
      { key: 'zoom', label: 'Ampliar al hacer clic', type: 'boolean' },
    ],
    flow: 'ratio',
    clickable: true,
    render(c, ctx) {
      if (!c.props.src) return placeholder('Seleccioná una imagen', 'image' as any);
      const src = ctx.asset(c.props.src);
      const img = h('img', { src, alt: c.props.alt || '', loading: 'lazy', decoding: 'async', style: { objectFit: c.props.fit || 'cover' } });
      const fig = h('figure', { class: 'ema-image' + (c.props.caption ? ' has-caption' : '') }, img, c.props.caption ? h('figcaption', null, c.props.caption) : null);
      if (c.props.zoom && ctx.mode === 'play') {
        fig.classList.add('ema-zoomable');
        fig.addEventListener('click', () => lightbox(ctx, src, c.props.caption));
      }
      return fig;
    },
  },
  {
    type: 'gallery',
    label: 'Galería',
    category: 'media',
    icon: 'images',
    defaultSize: { w: 900, h: 300 },
    defaultProps: () => ({ columns: 3, images: [{ src: '', caption: '' }, { src: '', caption: '' }, { src: '', caption: '' }] }),
    fields: [
      { key: 'columns', label: 'Columnas', type: 'number', min: 1, max: 6 },
      {
        key: 'images', label: 'Imágenes', type: 'list', itemLabel: 'caption',
        itemFields: [{ key: 'src', label: 'Imagen', type: 'media', accept: 'image' }, { key: 'caption', label: 'Epígrafe', type: 'text' }],
        newItem: () => ({ src: '', caption: '' }),
      },
    ],
    flow: 'auto',
    render(c, ctx) {
      const imgs = (c.props.images || []) as { src: string; caption: string }[];
      return h(
        'div',
        { class: 'ema-gallery', style: { gridTemplateColumns: `repeat(${c.props.columns || 3}, 1fr)` } },
        imgs.map((im) => {
          if (!im.src) return h('div', { class: 'ema-gallery-item' }, placeholder('Imagen', 'image'));
          const src = ctx.asset(im.src);
          const el = h('figure', { class: 'ema-gallery-item' }, h('img', { src, alt: im.caption || '', loading: 'lazy' }), im.caption ? h('figcaption', null, im.caption) : null);
          if (ctx.mode === 'play') el.addEventListener('click', () => lightbox(ctx, src, im.caption));
          return el;
        })
      );
    },
  },
  {
    type: 'video',
    label: 'Video MP4',
    category: 'media',
    icon: 'video',
    defaultSize: { w: 720, h: 405 },
    defaultProps: () => ({ src: '', poster: '', controls: true, autoplay: false, loop: false, muted: false, requireWatch: false }),
    defaultStyle: () => ({ borderRadius: 12 }),
    fields: [
      { key: 'src', label: 'Video (MP4)', type: 'media', accept: 'video' },
      { key: 'poster', label: 'Imagen de portada', type: 'media', accept: 'image' },
      { key: 'controls', label: 'Mostrar controles', type: 'boolean' },
      { key: 'autoplay', label: 'Reproducir automáticamente (silenciado)', type: 'boolean' },
      { key: 'loop', label: 'Repetir', type: 'boolean' },
      { key: 'muted', label: 'Silenciado', type: 'boolean' },
      { key: 'requireWatch', label: 'Debe verse completo (actividad)', type: 'boolean' },
    ],
    flow: 'ratio',
    trackable: (c) => !!c.props.requireWatch,
    render(c, ctx) {
      if (!c.props.src) return placeholder('Seleccioná un video MP4', 'video');
      const v = h('video', {
        class: 'ema-video',
        src: ctx.mode === 'play' ? ctx.asset(c.props.src) : ctx.asset(c.props.src) + '#t=0.1',
        poster: c.props.poster ? ctx.asset(c.props.poster) : undefined,
        controls: c.props.controls !== false,
        preload: ctx.mode === 'play' ? 'none' : 'metadata',
        playsinline: true,
        loop: !!c.props.loop,
        muted: !!(c.props.muted || c.props.autoplay),
      }) as HTMLVideoElement;
      if (ctx.mode === 'play') {
        ctx.registerMedia(c.id, v);
        if (c.props.autoplay) {
          v.preload = 'auto';
          v.autoplay = true;
        }
        v.addEventListener('ended', () => ctx.markComplete(c.id));
        if (!c.props.requireWatch) v.addEventListener('play', () => ctx.markComplete(c.id), { once: true });
      }
      return h('div', { class: 'ema-media-frame' }, v);
    },
  },
  {
    type: 'embed',
    label: 'Video YouTube/Vimeo',
    category: 'media',
    icon: 'youtube',
    defaultSize: { w: 720, h: 405 },
    defaultProps: () => ({ url: '', title: 'Video' }),
    defaultStyle: () => ({ borderRadius: 12 }),
    fields: [
      { key: 'url', label: 'URL de YouTube o Vimeo', type: 'text', placeholder: 'https://www.youtube.com/watch?v=...' },
      { key: 'title', label: 'Título (accesibilidad)', type: 'text' },
    ],
    flow: 'ratio',
    render(c, ctx) {
      const url = toEmbedUrl(c.props.url);
      if (!url) return placeholder('Pegá una URL de YouTube o Vimeo', 'youtube');
      if (ctx.mode === 'edit') {
        return h('div', { class: 'ema-embed-edit' }, icon('play', 42), h('span', null, c.props.url));
      }
      const frame = h('iframe', {
        class: 'ema-embed',
        title: c.props.title || 'Video',
        'data-src': url,
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
        allowfullscreen: true,
        loading: 'lazy',
      }) as HTMLIFrameElement;
      // carga diferida: el iframe se inicializa al entrar en pantalla
      const wrap = h('div', { class: 'ema-media-frame' }, frame);
      const load = () => { if (!frame.src) frame.src = frame.dataset.src!; };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { load(); io.disconnect(); } });
        setTimeout(() => io.observe(wrap), 0);
      } else load();
      ctx.registerMedia(c.id, frame);
      return wrap;
    },
  },
  {
    type: 'audio',
    label: 'Audio',
    category: 'media',
    icon: 'music',
    defaultSize: { w: 480, h: 90 },
    defaultProps: () => ({ src: '', title: 'Audio', autoplay: false, requireListen: false }),
    fields: [
      { key: 'src', label: 'Audio (MP3)', type: 'media', accept: 'audio' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'autoplay', label: 'Reproducir al entrar', type: 'boolean' },
      { key: 'requireListen', label: 'Debe escucharse completo (actividad)', type: 'boolean' },
    ],
    flow: 'auto',
    trackable: (c) => !!c.props.requireListen,
    render(c, ctx) {
      if (!c.props.src) return placeholder('Seleccioná un audio', 'music');
      const a = h('audio', { src: ctx.asset(c.props.src), controls: true, preload: 'none' }) as HTMLAudioElement;
      if (ctx.mode === 'play') {
        ctx.registerMedia(c.id, a);
        if (c.props.autoplay) setTimeout(() => a.play().catch(() => undefined), 300);
        a.addEventListener('ended', () => ctx.markComplete(c.id));
        if (!c.props.requireListen) a.addEventListener('play', () => ctx.markComplete(c.id), { once: true });
      }
      return h('div', { class: 'ema-audio' }, h('div', { class: 'ema-audio-head' }, icon('volume', 20), h('span', null, c.props.title || 'Audio')), a);
    },
  },
  {
    type: 'pdf',
    label: 'PDF',
    category: 'media',
    icon: 'file-text',
    defaultSize: { w: 720, h: 480 },
    defaultProps: () => ({ src: '', title: 'Documento PDF', display: 'embed' }),
    fields: [
      { key: 'src', label: 'Archivo PDF', type: 'media', accept: 'pdf' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'display', label: 'Mostrar como', type: 'select', options: [{ value: 'embed', label: 'Visor incrustado' }, { value: 'link', label: 'Tarjeta de descarga' }] },
    ],
    flow: 'auto',
    render(c, ctx) {
      if (!c.props.src) return placeholder('Seleccioná un PDF', 'file');
      const href = ctx.asset(c.props.src);
      const link = h('a', { class: 'ema-btn ema-btn-primary', href, target: '_blank', rel: 'noopener', download: '' }, icon('download', 18), 'Descargar');
      link.addEventListener('click', () => ctx.markComplete(c.id));
      if (c.props.display === 'link' || ctx.mode === 'edit') {
        return h('div', { class: 'ema-pdf-card' }, icon('file', 42), h('div', { class: 'ema-pdf-info' }, h('strong', null, c.props.title || 'PDF'), h('span', null, 'Documento PDF')), link);
      }
      ctx.markComplete(c.id);
      return h('div', { class: 'ema-pdf' }, h('object', { data: href, type: 'application/pdf' }, h('div', { class: 'ema-pdf-card' }, icon('file', 42), h('span', null, c.props.title), link)));
    },
  },
];
