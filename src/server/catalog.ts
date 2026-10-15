import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { building, catalogEvent, location, product } from "./db/schema";
import { requireEmployee } from "./employee";
import { HttpError } from "./http";
import { booleanField, checkKeys, idField, integerField, locationInput, productInput, textField } from "./catalog-input";
import type { CatalogEntity, PublicCatalog } from "../catalog/types";

export async function publicCatalog(court: string | null): Promise<PublicCatalog> {
  return getDb().transaction(async tx => {
    const products = await tx.select({ id: product.id, name: product.name, nameEn: product.nameEn,
      description: product.description, descriptionEn: product.descriptionEn, category: product.category,
      categoryEn: product.categoryEn, priceIdr: product.priceIdr, available: product.available })
      .from(product).where(eq(product.active, true)).orderBy(asc(product.category), asc(product.name), asc(product.id));
    const places = await tx.select({ id: location.id, name: location.name, kind: location.kind,
      tableNumber: location.tableNumber, buildingName: building.name }).from(location)
      .innerJoin(building, eq(location.buildingId, building.id))
      .where(and(eq(location.active, true), eq(building.active, true)))
      .orderBy(asc(building.name), asc(location.kind), asc(location.name), asc(location.id));
    const selected = court === null ? undefined : places.find(place => place.id === court && place.kind === "court");
    return { products, locations: places as PublicCatalog["locations"],
      qr: { status: court === null ? "absent" : selected ? "valid" : "invalid", courtId: selected?.id ?? null } };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function staffCatalog(headers: Headers) {
  const employee = await requireEmployee(headers);
  if (!employee.roles.some(role => role === "owner" || role === "preparation")) throw new HttpError(403, "FORBIDDEN");
  return getDb().transaction(async tx => ({
    products: await tx.select().from(product).orderBy(asc(product.category), asc(product.name)),
    buildings: employee.roles.includes("owner") ? await tx.select().from(building).orderBy(asc(building.name)) : [],
    locations: employee.roles.includes("owner") ? await tx.select().from(location).orderBy(asc(location.name)) : [],
  }), { isolationLevel: "repeatable read", accessMode: "read only" });
}

const productFields = ["name", "nameEn", "description", "descriptionEn", "category", "categoryEn", "priceIdr", "available", "active"];
export async function saveCatalog(headers: Headers, entity: CatalogEntity, input: Record<string, unknown>, create: boolean) {
  const employee = await requireEmployee(headers, true);
  const owner = employee.roles.includes("owner");
  if (!owner && !(entity === "product" && !create && employee.roles.includes("preparation"))) throw new HttpError(403, "FORBIDDEN");
  const id = idField(input.id);
  const version = create ? undefined : integerField(input, "version", 1);
  const allowed = entity === "product" ? owner ? productFields : ["available"] :
    entity === "building" ? ["name", "active"] : ["buildingId", "kind", "name", "tableNumber", "active"];
  checkKeys(input, ["id", ...(create ? [] : ["version"]), ...allowed]);
  const values = entity === "product" ? owner ? productInput(input) : { available: booleanField(input, "available") } :
    entity === "building" ? { name: textField(input, "name", 120), active: booleanField(input, "active") } : locationInput(input);
  try {
    return await getDb().transaction(async tx => {
      const table = entity === "product" ? product : entity === "building" ? building : location;
      const before = (await tx.select().from(table).where(eq(table.id, id)).for("update"))[0];
      if (create && before) throw new HttpError(409, "ALREADY_EXISTS");
      if (!create && !before) throw new HttpError(404, "NOT_FOUND");
      if (!create && before?.version !== version) throw new HttpError(409, "EDIT_CONFLICT");
      // Existing directory identities never move between buildings or change kind.
      if (entity === "location" && before && "buildingId" in before && "buildingId" in values &&
          (before.buildingId !== values.buildingId || before.kind !== values.kind)) throw new HttpError(400, "LOCATION_IDENTITY_FIXED");
      if (entity === "location" && "buildingId" in values) {
        const parent = await tx.select({ id: building.id }).from(building).where(eq(building.id, values.buildingId)).for("share");
        if (!parent.length) throw new HttpError(400, "INVALID_BUILDING");
      }
      // Each branch keeps the typed table's required fields explicit.
      let after;
      if (entity === "product") {
        after = create ? (await tx.insert(product).values({ id, ...productInput(input) }).returning())[0] :
          (await tx.update(product).set({ ...values, version: version! + 1, updatedAt: new Date() })
            .where(and(eq(product.id, id), eq(product.version, version!))).returning())[0];
      } else if (entity === "building") {
        const fields = { name: textField(input, "name", 120), active: booleanField(input, "active") };
        after = create ? (await tx.insert(building).values({ id, ...fields }).returning())[0] :
          (await tx.update(building).set({ ...fields, version: version! + 1, updatedAt: new Date() })
            .where(and(eq(building.id, id), eq(building.version, version!))).returning())[0];
      } else {
        const fields = locationInput(input);
        after = create ? (await tx.insert(location).values({ id, ...fields }).returning())[0] :
          (await tx.update(location).set({ ...fields, version: version! + 1, updatedAt: new Date() })
            .where(and(eq(location.id, id), eq(location.version, version!))).returning())[0];
      }
      if (!after) throw new HttpError(409, "EDIT_CONFLICT");
      await tx.insert(catalogEvent).values({ id: randomUUID(), actorId: employee.user.id, entity, entityId: id, before: before ?? null, after });
      return after;
    });
  } catch (error) {
    const code = postgresCode(error);
    if (code === "23505") throw new HttpError(409, "ALREADY_EXISTS");
    if (code === "23503" || code === "23514" || code === "22003") throw new HttpError(400, "INVALID_INPUT");
    throw error;
  }
}
function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? postgresCode(error.cause) : undefined;
}
