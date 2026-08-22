// Maps category names (lowercased) to the curated photo used on the landing
// page showcase + category tiles. Mirrors the original index.html maps.
export const CATEGORY_IMAGES: Record<string, string> = {
  "health & wellness": "/images/health-and-wellness.png",
  "professional services": "/images/profession-services.png",
  "repairs & maintenance": "/images/repairs-and-maintainance.png",
  "restaurants & food": "/images/resturants-and-food.png",
  "retail & shops": "/images/retail-and-shop.png",
  "salons & beauty": "/images/salons-and-beauty.png",
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "health & wellness": "Doctors, therapists and wellness pros for every need.",
  "professional services": "Accountants, legal and business experts on call.",
  "repairs & maintenance": "Handymen and technicians who fix it fast.",
  "restaurants & food": "Chefs, caterers and food vendors on demand.",
  "retail & shops": "Local boutiques and shops worth discovering.",
  "salons & beauty": "Stylists and beauty experts for your best look.",
};

export function categoryImage(name?: string | null): string | undefined {
  if (!name) return undefined;
  return CATEGORY_IMAGES[name.toLowerCase().trim()];
}

export function categoryDescription(name?: string | null): string {
  if (!name) return "Verified local pros near you.";
  return CATEGORY_DESCRIPTIONS[name.toLowerCase().trim()] || "Verified local pros near you.";
}
