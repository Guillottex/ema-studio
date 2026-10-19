/**
 * Crea (o restablece) un usuario administrador.
 * Uso: node dist/create-admin.js <email> <contraseña> ["Nombre"]
 *  o con Docker: docker compose exec backend node dist/create-admin.js admin@empresa.com 'Clave123!' "Nombre"
 */
import { createAdmin, seedRoles } from '../seed/seed';
import { migrate } from '../migrate';
import { pool, waitForDb } from '../db';

(async () => {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: create-admin <email> <contraseña> ["Nombre"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres');
    process.exit(1);
  }
  await waitForDb();
  await migrate();
  await seedRoles();
  const u = await createAdmin(email, password, name || 'Administrador');
  console.log(`Administrador listo: ${u!.email}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
