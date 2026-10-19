import {
  AlertTriangle, Award, BarChart3, BookOpen, Briefcase, Calculator, Calendar, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, Clock, Download, FileText, Flag, Heart, HelpCircle, Home, Info, Lightbulb, Lock,
  Mail, Menu, MessageCircle, Pause, Play, Plus, Rocket, Search, Settings, Shield, Star, Table2, Target, ThumbsUp,
  Trophy, User, Users, Volume2, X, Zap, Eye, LogOut, RotateCcw, ArrowRight, MapPin, GraduationCap, HardHat,
  Wrench, Phone, Globe, Maximize2, Image, Video, Music, Youtube,
} from 'lucide';

type IconNode = [string, Record<string, any>, IconNode[]?];

/** Conjunto curado de íconos (lucide, licencia ISC) embebidos en el player para funcionar offline. */
export const ICONS: Record<string, any> = {
  'alert': AlertTriangle, award: Award, chart: BarChart3, book: BookOpen, briefcase: Briefcase,
  calculator: Calculator, calendar: Calendar, check: Check, 'check-circle': CheckCircle2, 'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, clock: Clock, download: Download, file: FileText,
  flag: Flag, heart: Heart, help: HelpCircle, home: Home, info: Info, lightbulb: Lightbulb, lock: Lock, mail: Mail,
  menu: Menu, message: MessageCircle, pause: Pause, play: Play, plus: Plus, rocket: Rocket, search: Search,
  settings: Settings, shield: Shield, star: Star, table: Table2, target: Target, 'thumbs-up': ThumbsUp,
  trophy: Trophy, user: User, users: Users, volume: Volume2, x: X, zap: Zap, eye: Eye, logout: LogOut,
  retry: RotateCcw, 'arrow-right': ArrowRight, pin: MapPin, graduation: GraduationCap, helmet: HardHat,
  wrench: Wrench, phone: Phone, globe: Globe, maximize: Maximize2, image: Image, video: Video, music: Music, youtube: Youtube,
};

export const ICON_NAMES = Object.keys(ICONS);

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(node: IconNode): SVGElement {
  const [tag, attrs, children] = node;
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  (children || []).forEach((c) => el.appendChild(build(c)));
  return el;
}

export function icon(name: string, size = 20, extraClass = ''): SVGElement {
  const node = (ICONS[name] || ICONS.info) as IconNode;
  const svg = build(node);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', ('ema-icon ' + extraClass).trim());
  return svg;
}

/** Versión string (para el editor / miniaturas) */
export function iconSvgString(name: string, size = 20): string {
  const node = (ICONS[name] || ICONS.info) as IconNode;
  const render = (n: IconNode): string => {
    const [tag, attrs, children] = n;
    const a = { ...attrs } as Record<string, any>;
    if (tag === 'svg') { a.width = size; a.height = size; }
    const attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${attrStr}>${(children || []).map(render).join('')}</${tag}>`;
  };
  return render(node);
}
