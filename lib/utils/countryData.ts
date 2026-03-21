/**
 * Complete ISO 3166-1 alpha-2 country code mappings
 * Covers all 249 officially assigned country codes
 */

export const ISO_TO_NAME: Record<string, string> = {
  // A
  AD: "Andorra", AE: "United Arab Emirates", AF: "Afghanistan", AG: "Antigua and Barbuda",
  AI: "Anguilla", AL: "Albania", AM: "Armenia", AO: "Angola", AQ: "Antarctica",
  AR: "Argentina", AS: "American Samoa", AT: "Austria", AU: "Australia", AW: "Aruba",
  AX: "Åland Islands", AZ: "Azerbaijan",
  
  // B
  BA: "Bosnia and Herzegovina", BB: "Barbados", BD: "Bangladesh", BE: "Belgium",
  BF: "Burkina Faso", BG: "Bulgaria", BH: "Bahrain", BI: "Burundi", BJ: "Benin",
  BL: "Saint Barthélemy", BM: "Bermuda", BN: "Brunei", BO: "Bolivia", BQ: "Caribbean Netherlands",
  BR: "Brazil", BS: "Bahamas", BT: "Bhutan", BV: "Bouvet Island", BW: "Botswana",
  BY: "Belarus", BZ: "Belize",
  
  // C
  CA: "Canada", CC: "Cocos Islands", CD: "DR Congo", CF: "Central African Republic",
  CG: "Republic of the Congo", CH: "Switzerland", CI: "Côte d'Ivoire", CK: "Cook Islands",
  CL: "Chile", CM: "Cameroon", CN: "China", CO: "Colombia", CR: "Costa Rica",
  CU: "Cuba", CV: "Cape Verde", CW: "Curaçao", CX: "Christmas Island", CY: "Cyprus",
  CZ: "Czech Republic",
  
  // D
  DE: "Germany", DJ: "Djibouti", DK: "Denmark", DM: "Dominica", DO: "Dominican Republic",
  DZ: "Algeria",
  
  // E
  EC: "Ecuador", EE: "Estonia", EG: "Egypt", EH: "Western Sahara", ER: "Eritrea",
  ES: "Spain", ET: "Ethiopia",
  
  // F
  FI: "Finland", FJ: "Fiji", FK: "Falkland Islands", FM: "Micronesia", FO: "Faroe Islands",
  FR: "France",
  
  // G
  GA: "Gabon", GB: "United Kingdom", GD: "Grenada", GE: "Georgia", GF: "French Guiana",
  GG: "Guernsey", GH: "Ghana", GI: "Gibraltar", GL: "Greenland", GM: "Gambia",
  GN: "Guinea", GP: "Guadeloupe", GQ: "Equatorial Guinea", GR: "Greece",
  GS: "South Georgia", GT: "Guatemala", GU: "Guam", GW: "Guinea-Bissau", GY: "Guyana",
  
  // H
  HK: "Hong Kong", HM: "Heard Island", HN: "Honduras", HR: "Croatia", HT: "Haiti",
  HU: "Hungary",
  
  // I
  ID: "Indonesia", IE: "Ireland", IL: "Israel", IM: "Isle of Man", IN: "India",
  IO: "British Indian Ocean Territory", IQ: "Iraq", IR: "Iran", IS: "Iceland", IT: "Italy",
  
  // J
  JE: "Jersey", JM: "Jamaica", JO: "Jordan", JP: "Japan",
  
  // K
  KE: "Kenya", KG: "Kyrgyzstan", KH: "Cambodia", KI: "Kiribati", KM: "Comoros",
  KN: "Saint Kitts and Nevis", KP: "North Korea", KR: "South Korea", KW: "Kuwait",
  KY: "Cayman Islands", KZ: "Kazakhstan",
  
  // L
  LA: "Laos", LB: "Lebanon", LC: "Saint Lucia", LI: "Liechtenstein", LK: "Sri Lanka",
  LR: "Liberia", LS: "Lesotho", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia",
  LY: "Libya",
  
  // M
  MA: "Morocco", MC: "Monaco", MD: "Moldova", ME: "Montenegro", MF: "Saint Martin",
  MG: "Madagascar", MH: "Marshall Islands", MK: "North Macedonia", ML: "Mali", MM: "Myanmar",
  MN: "Mongolia", MO: "Macao", MP: "Northern Mariana Islands", MQ: "Martinique",
  MR: "Mauritania", MS: "Montserrat", MT: "Malta", MU: "Mauritius", MV: "Maldives",
  MW: "Malawi", MX: "Mexico", MY: "Malaysia", MZ: "Mozambique",
  
  // N
  NA: "Namibia", NC: "New Caledonia", NE: "Niger", NF: "Norfolk Island", NG: "Nigeria",
  NI: "Nicaragua", NL: "Netherlands", NO: "Norway", NP: "Nepal", NR: "Nauru",
  NU: "Niue", NZ: "New Zealand",
  
  // O
  OM: "Oman",
  
  // P
  PA: "Panama", PE: "Peru", PF: "French Polynesia", PG: "Papua New Guinea", PH: "Philippines",
  PK: "Pakistan", PL: "Poland", PM: "Saint Pierre and Miquelon", PN: "Pitcairn Islands",
  PR: "Puerto Rico", PS: "Palestine", PT: "Portugal", PW: "Palau", PY: "Paraguay",
  
  // Q
  QA: "Qatar",
  
  // R
  RE: "Réunion", RO: "Romania", RS: "Serbia", RU: "Russia", RW: "Rwanda",
  
  // S
  SA: "Saudi Arabia", SB: "Solomon Islands", SC: "Seychelles", SD: "Sudan", SE: "Sweden",
  SG: "Singapore", SH: "Saint Helena", SI: "Slovenia", SJ: "Svalbard and Jan Mayen",
  SK: "Slovakia", SL: "Sierra Leone", SM: "San Marino", SN: "Senegal", SO: "Somalia",
  SR: "Suriname", SS: "South Sudan", ST: "São Tomé and Príncipe", SV: "El Salvador",
  SX: "Sint Maarten", SY: "Syria", SZ: "Eswatini",
  
  // T
  TC: "Turks and Caicos", TD: "Chad", TF: "French Southern Territories", TG: "Togo",
  TH: "Thailand", TJ: "Tajikistan", TK: "Tokelau", TL: "Timor-Leste", TM: "Turkmenistan",
  TN: "Tunisia", TO: "Tonga", TR: "Turkey", TT: "Trinidad and Tobago", TV: "Tuvalu",
  TW: "Taiwan", TZ: "Tanzania",
  
  // U
  UA: "Ukraine", UG: "Uganda", UM: "U.S. Minor Outlying Islands", US: "United States",
  UY: "Uruguay", UZ: "Uzbekistan",
  
  // V
  VA: "Vatican City", VC: "Saint Vincent", VE: "Venezuela", VG: "British Virgin Islands",
  VI: "U.S. Virgin Islands", VN: "Vietnam", VU: "Vanuatu",
  
  // W
  WF: "Wallis and Futuna", WS: "Samoa",
  
  // Y
  YE: "Yemen", YT: "Mayotte",
  
  // Z
  ZA: "South Africa", ZM: "Zambia", ZW: "Zimbabwe",
};

/**
 * Generate flag emoji from ISO code
 * Uses Unicode Regional Indicator Symbols (🇦-🇿)
 */
export function isoToFlag(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (code.length !== 2) return "🌍";
  
  // Convert each letter to regional indicator symbol
  // A=🇦 (0x1F1E6), B=🇧 (0x1F1E7), etc
  const codePoints = [...code].map(char => 
    0x1F1E6 + char.charCodeAt(0) - 65
  );
  
  return String.fromCodePoint(...codePoints);
}

/**
 * Normalize country input to full name
 * Handles: ISO codes, full names, common variations
 */
export function normalizeCountry(input: string): string {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  
  // If it's a valid 2-letter ISO code, return full name
  if (upper.length === 2 && ISO_TO_NAME[upper]) {
    return ISO_TO_NAME[upper];
  }
  
  // Common aliases
  const aliases: Record<string, string> = {
    "USA": "United States",
    "UK": "United Kingdom",
    "UAE": "United Arab Emirates",
  };
  
  if (aliases[upper]) {
    return aliases[upper];
  }
  
  // Return as-is (might be full name already)
  return trimmed;
}

/**
 * Get flag emoji for a country (handles ISO codes and full names)
 */
export function getCountryFlag(country?: string): string {
  if (!country) return "🌍";
  
  const trimmed = country.trim();
  const upper = trimmed.toUpperCase();
  
  // If it's a 2-letter code, generate flag directly
  if (upper.length === 2 && ISO_TO_NAME[upper]) {
    return isoToFlag(upper);
  }
  
  // Try to find ISO code from full name (reverse lookup)
  const isoCode = Object.entries(ISO_TO_NAME).find(
    ([_, name]) => name.toLowerCase() === trimmed.toLowerCase()
  )?.[0];
  
  if (isoCode) {
    return isoToFlag(isoCode);
  }
  
  // Common aliases
  const aliasFlags: Record<string, string> = {
    "USA": "🇺🇸",
    "UK": "🇬🇧",
    "UAE": "🇦🇪",
  };
  
  return aliasFlags[upper] || "🌍";
}
