// Maps category names (lowercased) to the curated photo used on the landing
// page showcase + category tiles. Keys MUST match the category `name` from the
// API (lowercased + trimmed). Categories without an entry fall back to a
// colored glyph tile. Existing image files are reused for the matching groups;
// add the remaining PNGs to /public/images to light up the rest.
export const CATEGORY_IMAGES: Record<string, string> = {
  "food & drink": "/images/restaurants-and-food.png",
  "beauty & salons": "/images/salons-and-beauty.png",
  "fitness & sports": "/images/fitness-and-sports.png",
  "health & wellness": "/images/health-and-wellness.png",
  "home services & repairs": "/images/repairs-and-maintenance.png",
  "automotive": "/images/automotive.png",
  "moving & logistics": "/images/moving-and-logistics.png",
  "real estate & property": "/images/real-estate-and-property.png",
  "retail & shops": "/images/retail-and-shop.png",
  "pets & vets": "/images/pets-and-vets.png",
  "professional & business": "/images/professional-services.png",
  "events & lifestyle": "/images/events-and-lifestyle.png",
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "food & drink": "Chefs, caterers and food vendors on demand.",
  "beauty & salons": "Stylists, barbers and spa pros for your best look.",
  "fitness & sports": "Gyms, trainers and coaches to keep you moving.",
  "health & wellness": "Doctors, therapists and wellness pros for every need.",
  "home services & repairs": "Handymen and technicians who fix it fast.",
  "automotive": "Mechanics, detailing and transport when you need wheels.",
  "moving & logistics": "Movers, haulers and delivery to get you there.",
  "real estate & property": "Agents and property pros for buying and letting.",
  "retail & shops": "Local boutiques and shops worth discovering.",
  "pets & vets": "Vets, groomers and sitters for your furry family.",
  "professional & business": "Legal, finance, education and IT experts on call.",
  "events & lifestyle": "Photographers, entertainers and travel experiences.",
};

export function categoryImage(name?: string | null): string | undefined {
  if (!name) return undefined;
  return CATEGORY_IMAGES[name.toLowerCase().trim()];
}

export function categoryDescription(name?: string | null): string {
  if (!name) return "Verified local pros near you.";
  return CATEGORY_DESCRIPTIONS[name.toLowerCase().trim()] || "Verified local pros near you.";
}
