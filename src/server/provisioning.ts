import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { readConfig } from "./config";
import { isRole, type Role } from "./roles";
import { user, account, employeeRole } from "./db/schema";
import { assertDatabaseEnvironment } from "../../scripts/database-safety";

export async function provisionEmployee(pool: Pool, input: { email: string; name: string; password: string; roles: Role[] }) {
  if (readConfig().environment === "production") throw new Error("Production provisioning is not supported");
  await assertDatabaseEnvironment(pool);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !input.name.trim() ||
      input.password.length < 12 || input.password.length > 128 || !input.roles.length || input.roles.some(role => !isRole(role))) {
    throw new Error("Invalid employee input; use valid email/name, password length 12–128 and known roles");
  }
  const password = await hashPassword(input.password);
  const id = randomUUID();
  await drizzle(pool).transaction(async tx => {
    await tx.insert(user).values({ id, email, name: input.name.trim(), enabled: true });
    await tx.insert(account).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password });
    await tx.insert(employeeRole).values([...new Set(input.roles)].map(role => ({ userId: id, role })));
  });
  return id;
}
export async function disableEmployee(pool: Pool, id: string) {
  if (readConfig().environment === "production") throw new Error("Production employee administration is not supported");
  await assertDatabaseEnvironment(pool);
  const updated = await drizzle(pool).update(user).set({ enabled: false }).where(eq(user.id, id)).returning({ id: user.id });
  if (!updated.length) throw new Error("Employee not found");
  // The database trigger deletes all sessions in the same transaction.
}
