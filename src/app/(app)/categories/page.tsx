import { listCategories } from "@/server/queries/lookups";
import { CategoriesClient } from "@/features/categories/categories-client";

export default async function CategoriesPage() {
  const categories = await listCategories(true);
  return <CategoriesClient categories={categories} />;
}
