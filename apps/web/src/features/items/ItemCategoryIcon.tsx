import { Backpack, Circle, FlaskConical, Gem, Package, ScrollText, Shield, Shirt, Skull, Sword, WandSparkles, Wrench, type LucideIcon } from "lucide-react";
import type { ItemCategory } from "./items.types";
import "./item-category-icon.css";

const icons: Record<ItemCategory, LucideIcon> = {
  armor: Shield, weapon: Sword, potion: FlaskConical, poison: Skull,
  staff: WandSparkles, ring: Circle, scroll: ScrollText, wand: WandSparkles,
  tool: Wrench, gear: Backpack, focus: Gem, clothing: Shirt, other: Package
};

export function ItemCategoryIcon({ category }: { category?: string }) {
  const Icon = Object.hasOwn(icons, category ?? "") ? icons[category as ItemCategory] : Package;
  return <span className="item-category-icon" data-category={category ?? "other"} aria-hidden="true"><Icon size={26} strokeWidth={1.7} /></span>;
}
