// Curated Nigerian cities used as quick location presets on the search page.
// Coordinates are approximate city-centre points (lat, lng).
export interface CityPreset {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const NIGERIAN_CITIES: CityPreset[] = [
  { id: "lagos", name: "Lagos", lat: 6.5244, lng: 3.3792 },
  { id: "abuja", name: "Abuja", lat: 9.0765, lng: 7.3986 },
  { id: "ibadan", name: "Ibadan", lat: 7.3775, lng: 3.947 },
  { id: "port-harcourt", name: "Port Harcourt", lat: 4.8156, lng: 7.0498 },
  { id: "kano", name: "Kano", lat: 12.0022, lng: 8.5919 },
  { id: "enugu", name: "Enugu", lat: 6.4555, lng: 7.5086 },
  { id: "kaduna", name: "Kaduna", lat: 10.5222, lng: 7.4383 },
  { id: "abenin", name: "Benin City", lat: 6.335, lng: 5.603 },
  { id: "ilorin", name: "Ilorin", lat: 8.4966, lng: 4.5421 },
  { id: "jos", name: "Jos", lat: 9.9284, lng: 8.9 },
  { id: "abeokuta", name: "Abeokuta", lat: 7.1475, lng: 3.361 },
  { id: "onitsha", name: "Onitsha", lat: 6.169, lng: 6.783 },
];
