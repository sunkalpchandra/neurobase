import type { RegulatoryAgency } from "@/domain/enums";

export interface Place {
  city: string;
  region: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
  countryName: string;
  /** Relative frequency among company headquarters. */
  weight: number;
}

const NORTH_AMERICA: Place[] = [
  {
    city: "Boston",
    region: "Massachusetts",
    country: "US",
    countryName: "United States",
    weight: 6,
  },
  {
    city: "San Francisco",
    region: "California",
    country: "US",
    countryName: "United States",
    weight: 6,
  },
  {
    city: "Salt Lake City",
    region: "Utah",
    country: "US",
    countryName: "United States",
    weight: 3,
  },
  {
    city: "Pittsburgh",
    region: "Pennsylvania",
    country: "US",
    countryName: "United States",
    weight: 3,
  },
  { city: "Houston", region: "Texas", country: "US", countryName: "United States", weight: 2 },
  {
    city: "Minneapolis",
    region: "Minnesota",
    country: "US",
    countryName: "United States",
    weight: 3,
  },
  { city: "Seattle", region: "Washington", country: "US", countryName: "United States", weight: 3 },
  {
    city: "San Diego",
    region: "California",
    country: "US",
    countryName: "United States",
    weight: 3,
  },
  { city: "Austin", region: "Texas", country: "US", countryName: "United States", weight: 2 },
  { city: "New York", region: "New York", country: "US", countryName: "United States", weight: 3 },
  { city: "Cleveland", region: "Ohio", country: "US", countryName: "United States", weight: 2 },
  { city: "Atlanta", region: "Georgia", country: "US", countryName: "United States", weight: 2 },
  {
    city: "Durham",
    region: "North Carolina",
    country: "US",
    countryName: "United States",
    weight: 2,
  },
  { city: "Baltimore", region: "Maryland", country: "US", countryName: "United States", weight: 2 },
  { city: "Ann Arbor", region: "Michigan", country: "US", countryName: "United States", weight: 2 },
  {
    city: "Providence",
    region: "Rhode Island",
    country: "US",
    countryName: "United States",
    weight: 2,
  },
  {
    city: "Philadelphia",
    region: "Pennsylvania",
    country: "US",
    countryName: "United States",
    weight: 2,
  },
  { city: "Denver", region: "Colorado", country: "US", countryName: "United States", weight: 1 },
  { city: "Madison", region: "Wisconsin", country: "US", countryName: "United States", weight: 1 },
  { city: "Toronto", region: "Ontario", country: "CA", countryName: "Canada", weight: 3 },
  { city: "Montreal", region: "Quebec", country: "CA", countryName: "Canada", weight: 2 },
  {
    city: "Vancouver",
    region: "British Columbia",
    country: "CA",
    countryName: "Canada",
    weight: 2,
  },
  { city: "Calgary", region: "Alberta", country: "CA", countryName: "Canada", weight: 1 },
];

const EUROPE: Place[] = [
  { city: "London", region: null, country: "GB", countryName: "United Kingdom", weight: 4 },
  { city: "Cambridge", region: null, country: "GB", countryName: "United Kingdom", weight: 3 },
  { city: "Oxford", region: null, country: "GB", countryName: "United Kingdom", weight: 2 },
  { city: "Edinburgh", region: null, country: "GB", countryName: "United Kingdom", weight: 1 },
  { city: "Manchester", region: null, country: "GB", countryName: "United Kingdom", weight: 1 },
  { city: "Bristol", region: null, country: "GB", countryName: "United Kingdom", weight: 1 },
  { city: "Dublin", region: null, country: "IE", countryName: "Ireland", weight: 1 },
  { city: "Berlin", region: null, country: "DE", countryName: "Germany", weight: 3 },
  { city: "Munich", region: null, country: "DE", countryName: "Germany", weight: 2 },
  { city: "Freiburg", region: null, country: "DE", countryName: "Germany", weight: 2 },
  { city: "Hamburg", region: null, country: "DE", countryName: "Germany", weight: 1 },
  { city: "Tübingen", region: null, country: "DE", countryName: "Germany", weight: 1 },
  { city: "Lausanne", region: null, country: "CH", countryName: "Switzerland", weight: 3 },
  { city: "Zurich", region: null, country: "CH", countryName: "Switzerland", weight: 3 },
  { city: "Geneva", region: null, country: "CH", countryName: "Switzerland", weight: 1 },
  { city: "Basel", region: null, country: "CH", countryName: "Switzerland", weight: 1 },
  { city: "Utrecht", region: null, country: "NL", countryName: "Netherlands", weight: 2 },
  { city: "Eindhoven", region: null, country: "NL", countryName: "Netherlands", weight: 2 },
  { city: "Amsterdam", region: null, country: "NL", countryName: "Netherlands", weight: 1 },
  { city: "Nijmegen", region: null, country: "NL", countryName: "Netherlands", weight: 1 },
  { city: "Paris", region: null, country: "FR", countryName: "France", weight: 3 },
  { city: "Grenoble", region: null, country: "FR", countryName: "France", weight: 2 },
  { city: "Lyon", region: null, country: "FR", countryName: "France", weight: 1 },
  { city: "Leuven", region: null, country: "BE", countryName: "Belgium", weight: 2 },
  { city: "Ghent", region: null, country: "BE", countryName: "Belgium", weight: 1 },
  { city: "Stockholm", region: null, country: "SE", countryName: "Sweden", weight: 2 },
  { city: "Lund", region: null, country: "SE", countryName: "Sweden", weight: 1 },
  { city: "Copenhagen", region: null, country: "DK", countryName: "Denmark", weight: 2 },
  { city: "Aarhus", region: null, country: "DK", countryName: "Denmark", weight: 1 },
  { city: "Oslo", region: null, country: "NO", countryName: "Norway", weight: 1 },
  { city: "Helsinki", region: null, country: "FI", countryName: "Finland", weight: 1 },
  { city: "Vienna", region: null, country: "AT", countryName: "Austria", weight: 1 },
  { city: "Graz", region: null, country: "AT", countryName: "Austria", weight: 1 },
  { city: "Barcelona", region: null, country: "ES", countryName: "Spain", weight: 2 },
  { city: "Madrid", region: null, country: "ES", countryName: "Spain", weight: 1 },
  { city: "Milan", region: null, country: "IT", countryName: "Italy", weight: 2 },
  { city: "Pisa", region: null, country: "IT", countryName: "Italy", weight: 1 },
  { city: "Genoa", region: null, country: "IT", countryName: "Italy", weight: 1 },
];

const ASIA_PACIFIC: Place[] = [
  { city: "Tel Aviv", region: null, country: "IL", countryName: "Israel", weight: 3 },
  { city: "Haifa", region: null, country: "IL", countryName: "Israel", weight: 2 },
  { city: "Jerusalem", region: null, country: "IL", countryName: "Israel", weight: 1 },
  { city: "Tokyo", region: null, country: "JP", countryName: "Japan", weight: 2 },
  { city: "Osaka", region: null, country: "JP", countryName: "Japan", weight: 1 },
  { city: "Kyoto", region: null, country: "JP", countryName: "Japan", weight: 1 },
  { city: "Seoul", region: null, country: "KR", countryName: "South Korea", weight: 2 },
  { city: "Daejeon", region: null, country: "KR", countryName: "South Korea", weight: 1 },
  { city: "Singapore", region: null, country: "SG", countryName: "Singapore", weight: 2 },
  { city: "Shanghai", region: null, country: "CN", countryName: "China", weight: 2 },
  { city: "Shenzhen", region: null, country: "CN", countryName: "China", weight: 2 },
  { city: "Beijing", region: null, country: "CN", countryName: "China", weight: 1 },
  { city: "Bengaluru", region: null, country: "IN", countryName: "India", weight: 2 },
  { city: "Hyderabad", region: null, country: "IN", countryName: "India", weight: 1 },
  { city: "Melbourne", region: "Victoria", country: "AU", countryName: "Australia", weight: 3 },
  { city: "Sydney", region: "New South Wales", country: "AU", countryName: "Australia", weight: 2 },
  { city: "Brisbane", region: "Queensland", country: "AU", countryName: "Australia", weight: 1 },
  { city: "Auckland", region: null, country: "NZ", countryName: "New Zealand", weight: 1 },
];

export const PLACES: readonly Place[] = [...NORTH_AMERICA, ...EUROPE, ...ASIA_PACIFIC];

/** Legal-entity suffix used for the third alias of companies and investors. */
export const LEGAL_SUFFIXES: Record<string, string> = {
  US: "Inc.",
  CA: "Inc.",
  GB: "Ltd",
  IE: "Ltd",
  DE: "GmbH",
  AT: "GmbH",
  CH: "AG",
  NL: "B.V.",
  BE: "NV",
  FR: "SAS",
  SE: "AB",
  DK: "A/S",
  NO: "AS",
  FI: "Oy",
  ES: "S.L.",
  IT: "S.r.l.",
  IL: "Ltd.",
  JP: "K.K.",
  KR: "Co., Ltd.",
  SG: "Pte. Ltd.",
  CN: "Co., Ltd.",
  IN: "Pvt. Ltd.",
  AU: "Pty Ltd",
  NZ: "Limited",
};

export function legalSuffix(country: string): string {
  return LEGAL_SUFFIXES[country] ?? "Ltd";
}

/** National regulator by headquarters country; EU members use notified bodies ("other"). */
export function homeAgency(country: string): RegulatoryAgency {
  switch (country) {
    case "US":
      return "FDA";
    case "GB":
      return "MHRA";
    case "JP":
      return "PMDA";
    case "CN":
      return "NMPA";
    case "CA":
      return "Health Canada";
    case "AU":
      return "TGA";
    default:
      return "other";
  }
}
