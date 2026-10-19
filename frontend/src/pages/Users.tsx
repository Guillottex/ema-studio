import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, UserPlus, Pencil, Trash2, ShieldAlert, Search, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate, fmtRelative } from '../lib/format';
import { toast } from '../lib/toast';
import { Badge, Button, Empty, Field, IconButton, Input, Modal, PageHeader, PageLoader, Switch, clsx, confirmDialog } from '../components/ui';
import { ROLE_INFO, RolesCard, type RoleName, type RoleRow } from './parts/users-roles';

interface UserRow {
  id: string; email: string; name: string; active: boolean; last_login_at: string | null; created_at: string;
  role: RoleName; role_label: string; courses: number;
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';

export default function Users() {
  const { can, user: me } = useAuth();
  const allowed = can('users.manage');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users'), enabled: allowed });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleRow[]>('/users/roles'), enabled: allowed });
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [q, setQ] = useState('');

  if (!allowed) {
    return (
      <div className="py-10">
        <Empty icon={<ShieldAlert className="h-10 w-10" />} title="Acceso restringido">
          Solo los administradores pueden ver y gestionar usuarios. Si necesitás una cuenta nueva o cambiar tu rol, pedíselo a un administrador.
        </Empty>
      </div>
    );
  }

  const remove = async (u: UserRow) => {
    const ok = await confirmDialog({
      title: 'Eliminar usuario', danger: true, confirmText: 'Eliminar',
      message: <>¿Eliminar a <b>{u.name}</b> ({u.email})? Perderá el acceso de inmediato. Los cursos que creó se conservan.{u.courses > 0 && <> Tiene {u.courses} curso{u.courses === 1 ? '' : 's'} creados.</>} <br /><br />Si solo querés bloquear el acceso temporalmente, conviene desactivarlo.</>,
    });
    if (!ok) return;
    try {
      await api.del(`/users/${u.id}`);
      await qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario eliminado');
    } catch (e) { toast.error(e); }
  };

  const items = (data || []).filter((u) => {
    const t = q.trim().toLowerCase();
    return !t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t);
  });
  const activeCount = (data || []).filter((u) => u.active).length;

  return (
    <div>
      <PageHeader
        icon={<UsersIcon className="h-5 w-5" />}
        title="Usuarios"
        description={data ? `${data.length} usuario${data.length === 1 ? '' : 's'} · ${activeCount} activo${activeCount === 1 ? '' : 's'}` : 'Cuentas con acceso al Estudio e-learning.'}
        actions={<Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing('new')}>Nuevo usuario</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por nombre o email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card mb-6 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Nombre</th><th>Rol</th><th>Estado</th><th className="hidden md:table-cell">Último acceso</th><th className="hidden sm:table-cell text-right">Cursos creados</th><th className="w-24" /></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-500">No hay usuarios que coincidan.</td></tr>
              ) : items.map((u) => {
                const info = ROLE_INFO[u.role];
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={clsx('grid h-9 w-9 flex-none place-items-center rounded-full text-xs font-bold', u.active ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700')}>{initials(u.name)}</div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800 dark:text-slate-100">{u.name}{isMe && <span className="ml-1.5 text-xs font-normal text-slate-400">(vos)</span>}</div>
                          <div className="truncate text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', info?.color)}>{info?.icon}{u.role_label}</span></td>
                    <td>{u.active ? <Badge color="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    <td className="hidden whitespace-nowrap text-slate-500 md:table-cell" title={u.last_login_at ? fmtDate(u.last_login_at) : undefined}>{u.last_login_at ? fmtRelative(u.last_login_at) : 'Nunca'}</td>
                    <td className="hidden text-right tabular-nums text-slate-600 dark:text-slate-300 sm:table-cell">{u.courses}</td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <IconButton title="Editar" onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></IconButton>
                        <IconButton title={isMe ? 'No podés eliminar tu propio usuario' : 'Eliminar'} disabled={isMe} className="hover:!text-red-600" onClick={() => remove(u)}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {roles && <RolesCard roles={roles} />}

      {editing && <UserModal user={editing === 'new' ? null : editing} isMe={editing !== 'new' && editing.id === me?.id} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UserModal({ user, isMe, onClose }: { user: UserRow | null; isMe: boolean; onClose(): void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<RoleName>(user?.role || 'author');
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameOk = name.trim().length >= 2;
  const pwOk = user ? password.length === 0 || password.length >= 8 : password.length >= 8;
  const valid = emailOk && nameOk && pwOk;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      if (user) {
        const body: Record<string, unknown> = {};
        if (name.trim() !== user.name) body.name = name.trim();
        if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
        if (role !== user.role) body.role = role;
        if (active !== user.active) body.active = active;
        if (password) body.password = password;
        if (Object.keys(body).length) await api.patch(`/users/${user.id}`, body);
        toast.success('Usuario actualizado');
      } else {
        await api.post('/users', { name: name.trim(), email: email.trim(), password, role, active });
        toast.success('Usuario creado');
      }
      await qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="md" title={user ? 'Editar usuario' : 'Nuevo usuario'} description={user ? user.email : 'La persona podrá ingresar con este email y contraseña.'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={saving} onClick={save}>{user ? 'Guardar cambios' : 'Crear usuario'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }} autoComplete="off">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" error={touched && !nameOk ? 'Ingresá al menos 2 caracteres' : undefined}>
            <Input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
          </Field>
          <Field label="Email *" error={touched && !emailOk ? 'Email inválido' : undefined}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@empresa.com" autoComplete="off" />
          </Field>
        </div>
        <Field label={user ? 'Nueva contraseña' : 'Contraseña *'} hint={user ? 'Dejala vacía para mantener la actual. Mínimo 8 caracteres.' : 'Mínimo 8 caracteres.'}
          error={touched && !pwOk ? 'La contraseña debe tener al menos 8 caracteres' : undefined}>
          <div className="relative">
            <Input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="pr-10" />
            <button type="button" className="absolute right-1 top-0.5 icon-btn" title={showPw ? 'Ocultar' : 'Mostrar'} onClick={() => setShowPw((v) => !v)}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
        <Field label="Rol">
          <div className="grid gap-2">
            {(Object.keys(ROLE_INFO) as RoleName[]).map((r) => {
              const info = ROLE_INFO[r];
              const disabled = isMe && r !== 'admin';
              return (
                <label key={r} className={clsx('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors', role === r ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30 dark:bg-brand-900/20' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700', disabled && 'pointer-events-none opacity-50')}>
                  <input type="radio" name="role" className="mt-1 accent-brand-600" checked={role === r} disabled={disabled} onChange={() => setRole(r)} />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">{info.icon}{info.label}</div>
                    <div className="text-xs text-slate-500">{info.summary}</div>
                  </div>
                </label>
              );
            })}
          </div>
          {isMe && <p className="mt-1 text-[11.5px] text-slate-500">No podés quitarte el rol de administrador.</p>}
        </Field>
        <Switch checked={active} disabled={isMe} onChange={setActive} label="Usuario activo" hint={isMe ? 'No podés desactivar tu propia cuenta.' : 'Los usuarios inactivos no pueden iniciar sesión.'} />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
