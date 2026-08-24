// Free geocoding via OpenStreetMap Nominatim (no API key), biased to Nigeria,
// with an in-memory cache and a local gazetteer fallback for places OSM hasn't
// indexed (small junctions, estates, wards). The frontend uses this to turn a
// typed place name into coordinates for the nearby-business search.

export interface GeoResult {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

interface CacheEntry {
  ts: number;
  results: GeoResult[];
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 60 * 24;

// Curated Nigerian locations used when Nominatim has no match. Coordinates are
// approximate centres — fine for a radius-based nearby search. Covers state
// capitals, major towns, and a set of Kaduna localities (the app's core region).
const GAZETTEER: GeoResult[] = [
  // State capitals
  { id: "loc:aba", name: "Aba", label: "Aba, Abia, Nigeria", lat: 5.1060, lng: 7.3660 },
  { id: "loc:aba-uka", name: "Umuahia", label: "Umuahia, Abia, Nigeria", lat: 5.5282, lng: 7.4910 },
  { id: "loc:yola", name: "Yola", label: "Yola, Adamawa, Nigeria", lat: 9.2058, lng: 12.4716 },
  { id: "loc:uyo", name: "Uyo", label: "Uyo, Akwa Ibom, Nigeria", lat: 5.0513, lng: 7.9336 },
  { id: "loc:awka", name: "Awka", label: "Awka, Anambra, Nigeria", lat: 6.2120, lng: 7.0711 },
  { id: "loc:bauchi", name: "Bauchi", label: "Bauchi, Bauchi, Nigeria", lat: 10.3067, lng: 9.8433 },
  { id: "loc:yenagoa", name: "Yenagoa", label: "Yenagoa, Bayelsa, Nigeria", lat: 4.9247, lng: 6.2643 },
  { id: "loc:makurdi", name: "Makurdi", label: "Makurdi, Benue, Nigeria", lat: 7.7350, lng: 8.5210 },
  { id: "loc:maiduguri", name: "Maiduguri", label: "Maiduguri, Borno, Nigeria", lat: 11.8460, lng: 13.1570 },
  { id: "loc:calabar", name: "Calabar", label: "Calabar, Cross River, Nigeria", lat: 4.9757, lng: 8.3410 },
  { id: "loc:asaba", name: "Asaba", label: "Asaba, Delta, Nigeria", lat: 6.1900, lng: 6.7300 },
  { id: "loc:abakaliki", name: "Abakaliki", label: "Abakaliki, Ebonyi, Nigeria", lat: 6.3270, lng: 8.1130 },
  { id: "loc:benin", name: "Benin City", label: "Benin City, Edo, Nigeria", lat: 6.3350, lng: 5.6030 },
  { id: "loc:ado", name: "Ado-Ekiti", label: "Ado-Ekiti, Ekiti, Nigeria", lat: 7.6165, lng: 5.2200 },
  { id: "loc:enugu", name: "Enugu", label: "Enugu, Enugu, Nigeria", lat: 6.4555, lng: 7.5086 },
  { id: "loc:gombe", name: "Gombe", label: "Gombe, Gombe, Nigeria", lat: 10.2900, lng: 11.1700 },
  { id: "loc:owerri", name: "Owerri", label: "Owerri, Imo, Nigeria", lat: 5.4840, lng: 7.0370 },
  { id: "loc:dutse", name: "Dutse", label: "Dutse, Jigawa, Nigeria", lat: 11.5400, lng: 9.6400 },
  { id: "loc:kaduna", name: "Kaduna", label: "Kaduna, Kaduna, Nigeria", lat: 10.5222, lng: 7.4383 },
  { id: "loc:kano", name: "Kano", label: "Kano, Kano, Nigeria", lat: 12.0022, lng: 8.5919 },
  { id: "loc:katsina", name: "Katsina", label: "Katsina, Katsina, Nigeria", lat: 12.9900, lng: 7.6000 },
  { id: "loc:b-kebbi", name: "Birnin Kebbi", label: "Birnin Kebbi, Kebbi, Nigeria", lat: 12.4500, lng: 4.1900 },
  { id: "loc:lokoja", name: "Lokoja", label: "Lokoja, Kogi, Nigeria", lat: 7.8010, lng: 6.7430 },
  { id: "loc:ilorin", name: "Ilorin", label: "Ilorin, Kwara, Nigeria", lat: 8.4966, lng: 4.5421 },
  { id: "loc:ikorodu", name: "Lagos", label: "Lagos, Lagos, Nigeria", lat: 6.5244, lng: 3.3792 },
  { id: "loc:lafia", name: "Lafia", label: "Lafia, Nasarawa, Nigeria", lat: 8.4920, lng: 8.5170 },
  { id: "loc:minna", name: "Minna", label: "Minna, Niger, Nigeria", lat: 9.6130, lng: 6.5560 },
  { id: "loc:abeokuta", name: "Abeokuta", label: "Abeokuta, Ogun, Nigeria", lat: 7.1475, lng: 3.3610 },
  { id: "loc:akure", name: "Akure", label: "Akure, Ondo, Nigeria", lat: 7.2570, lng: 5.1950 },
  { id: "loc:osogbo", name: "Osogbo", label: "Osogbo, Osun, Nigeria", lat: 7.7690, lng: 4.5790 },
  { id: "loc:ibadan", name: "Ibadan", label: "Ibadan, Oyo, Nigeria", lat: 7.3775, lng: 3.9470 },
  { id: "loc:jos", name: "Jos", label: "Jos, Plateau, Nigeria", lat: 9.9284, lng: 8.9000 },
  { id: "loc:ph", name: "Port Harcourt", label: "Port Harcourt, Rivers, Nigeria", lat: 4.8156, lng: 7.0498 },
  { id: "loc:sokoto", name: "Sokoto", label: "Sokoto, Sokoto, Nigeria", lat: 13.0600, lng: 5.2400 },
  { id: "loc:jalingo", name: "Jalingo", label: "Jalingo, Taraba, Nigeria", lat: 8.8900, lng: 11.3600 },
  { id: "loc:damaturu", name: "Damaturu", label: "Damaturu, Yobe, Nigeria", lat: 11.7400, lng: 11.9600 },
  { id: "loc:gusau", name: "Gusau", label: "Gusau, Zamfara, Nigeria", lat: 12.1600, lng: 6.6700 },
  { id: "loc:abuja", name: "Abuja", label: "Abuja, FCT, Nigeria", lat: 9.0765, lng: 7.3986 },
  // Extra major towns
  { id: "loc:zaria", name: "Zaria", label: "Zaria, Kaduna, Nigeria", lat: 11.0850, lng: 7.7230 },
  { id: "loc:kafanchan", name: "Kafanchan", label: "Kafanchan, Kaduna, Nigeria", lat: 9.5700, lng: 8.2700 },
  { id: "loc:onitsha", name: "Onitsha", label: "Onitsha, Anambra, Nigeria", lat: 6.1690, lng: 6.7830 },
  { id: "loc:aba-town", name: "Aba", label: "Aba, Abia, Nigeria", lat: 5.1060, lng: 7.3660 },
  // Kaduna localities (core region)
  { id: "loc:karji", name: "Karji", label: "Karji, Kaduna, Nigeria", lat: 10.5400, lng: 7.4400 },
  { id: "loc:karji-junction", name: "Karji Junction", label: "Karji Junction, Kaduna, Nigeria", lat: 10.5450, lng: 7.4450 },
  { id: "loc:babban-saura", name: "Babban Saura", label: "Babban Saura, Kaduna, Nigeria", lat: 10.5103, lng: 7.4726 },
  { id: "loc:babban-saura-pond", name: "Babban Saura Pond", label: "Babban Saura Pond, Kaduna, Nigeria", lat: 10.5080, lng: 7.4700 },
  { id: "loc:barnawa", name: "Barnawa", label: "Barnawa, Kaduna, Nigeria", lat: 10.4900, lng: 7.4500 },
  { id: "loc:sabon-gari", name: "Sabon Gari", label: "Sabon Gari, Kaduna, Nigeria", lat: 10.5300, lng: 7.4400 },
  { id: "loc:kawo", name: "Kawo", label: "Kawo, Kaduna, Nigeria", lat: 10.5350, lng: 7.4300 },
  { id: "loc:ugwan-sarki", name: "Ugwan Sarki", label: "Ugwan Sarki, Kaduna, Nigeria", lat: 10.5200, lng: 7.4600 },
];

function gazetteerMatches(q: string): GeoResult[] {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const termTokens = term.split(/\s+/).filter((t) => t.length >= 2);
  const out: GeoResult[] = [];
  for (const g of GAZETTEER) {
    const name = g.name.toLowerCase();
    const label = g.label.toLowerCase();
    const nameTokens = name.split(/[\s,]+/).filter((t) => t.length >= 2);
    const hit =
      name.includes(term) ||
      label.includes(term) ||
      termTokens.some((t) => name.includes(t) || nameTokens.includes(t));
    if (hit) out.push(g);
  }
  return out.slice(0, 8);
}

export async function geocode(query: string): Promise<GeoResult[]> {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.results;

  let results: GeoResult[] = [];
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=ng`;
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires an identifying User-Agent.
        "User-Agent": "nookly/1.0 (https://nookly.vercel.app)",
        Accept: "application/json",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{
        place_id: number;
        lat: string;
        lon: string;
        name?: string;
        display_name?: string;
      }>;
      results = data
        .map((d) => ({
          id: `osm:${d.place_id}`,
          name: d.name || d.display_name?.split(",")[0] || q,
          label: d.display_name || q,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    }
  } catch {
    // Upstream geocoder unavailable — fall through to the gazetteer.
  }

  // Merge gazetteer matches that aren't already represented by Nominatim.
  const seen = new Set(results.map((r) => `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`));
  for (const g of gazetteerMatches(q)) {
    const k = `${g.lat.toFixed(3)},${g.lng.toFixed(3)}`;
    if (!seen.has(k)) {
      results.push(g);
      seen.add(k);
    }
  }

  results = results.slice(0, 8);
  cache.set(key, { ts: Date.now(), results });
  return results;
}
