export type Product = {
  id: string; name: string; nameEn: string | null; description: string; descriptionEn: string | null;
  category: string; categoryEn: string | null; priceIdr: number; available: boolean; active: boolean; version: number;
};
export type Building = { id: string; name: string; active: boolean; version: number };
export type Location = { id: string; buildingId: string; kind: "court" | "table"; name: string;
  tableNumber: number | null; active: boolean; version: number };
export type PublicCatalog = {
  orderingEnabled: boolean;
  products: Omit<Product, "active" | "version">[];
  locations: { id: string; kind: "court" | "table"; name: string; buildingName: string; tableNumber: number | null }[];
  qr: { status: "absent" | "valid" | "invalid"; courtId: string | null };
};
export type StaffCatalog = { products: Product[]; buildings: Building[]; locations: Location[] };
export type CatalogEntity = "product" | "building" | "location";
export type Language = "id" | "en";
export function formatIdr(amount: number | bigint | string) {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(typeof amount === "string" ? BigInt(amount) : amount)}`;
}
