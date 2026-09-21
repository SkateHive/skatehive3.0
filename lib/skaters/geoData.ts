/**
 * Lookup tables for turning the free-text `profile.location` string on a Hive
 * account into something we can group, filter and put on a map.
 *
 * Hive has no structured location field, so what people actually write ranges
 * from "BR" to "Cumaná Estado Sucre .Venezuela" to "Mordor". These tables were
 * built by reading every distinct location string in the Skatehive leaderboard
 * (531 of them) rather than guessed, so the long tail is deliberate.
 *
 * All keys must be pre-normalized with `normalizeKey` from ./geo.
 */

import { ISO_TO_NAME } from "@/lib/utils/countryData";

export type LatLng = readonly [number, number];

/**
 * Canonical country name -> centroid. Used as the map position for anyone whose
 * location resolves to a country but not to a city we know.
 *
 * Covers every name ISO_TO_NAME can produce (all 249 assigned alpha-2 codes),
 * because this table doubles as the registry of countries the app knows about:
 * `countryFromSlug` walks these keys, so a country missing here has no
 * /skaters/[country] page even when skaters resolve to it.
 */
export const COUNTRY_CENTROIDS: Record<string, LatLng> = {
  Afghanistan: [33.94, 67.71], "Åland Islands": [60.18, 19.92], Albania: [41.15, 20.17],
  Algeria: [28.03, 1.66], "American Samoa": [-14.27, -170.13], Andorra: [42.55, 1.6],
  Angola: [-11.2, 17.87], Anguilla: [18.22, -63.07], Antarctica: [-75.25, 0.07],
  "Antigua and Barbuda": [17.06, -61.8], Argentina: [-38.42, -63.62],
  Armenia: [40.07, 45.04], Aruba: [12.52, -69.97], Australia: [-25.27, 133.78],
  Austria: [47.52, 14.55], Azerbaijan: [40.14, 47.58], Bahamas: [25.03, -77.4],
  Bahrain: [25.93, 50.64], Bangladesh: [23.68, 90.36], Barbados: [13.19, -59.54],
  Belarus: [53.71, 27.95], Belgium: [50.5, 4.47], Belize: [17.19, -88.5],
  Benin: [9.31, 2.32], Bermuda: [32.32, -64.76], Bhutan: [27.51, 90.43],
  Bolivia: [-16.29, -63.59], "Bosnia and Herzegovina": [43.92, 17.68],
  Botswana: [-22.33, 24.68], "Bouvet Island": [-54.42, 3.36], Brazil: [-14.24, -51.93],
  "British Indian Ocean Territory": [-6.34, 71.88],
  "British Virgin Islands": [18.42, -64.64], Brunei: [4.54, 114.73],
  Bulgaria: [42.73, 25.49], "Burkina Faso": [12.24, -1.56], Burundi: [-3.37, 29.92],
  Cambodia: [12.57, 104.99], Cameroon: [7.37, 12.35], Canada: [56.13, -106.35],
  "Cape Verde": [16, -24.01], "Caribbean Netherlands": [12.18, -68.24],
  "Cayman Islands": [19.31, -81.25], "Central African Republic": [6.61, 20.94],
  Chad: [15.45, 18.73], Chile: [-35.68, -71.54], China: [35.86, 104.2],
  "Christmas Island": [-10.45, 105.69], "Cocos Islands": [-12.16, 96.87],
  Colombia: [4.57, -74.3], Comoros: [-11.88, 43.87], "Cook Islands": [-21.24, -159.78],
  "Costa Rica": [9.75, -83.75], "Côte d'Ivoire": [7.54, -5.55], Croatia: [45.1, 15.2],
  Cuba: [21.52, -77.78], "Curaçao": [12.17, -68.99], Cyprus: [35.13, 33.43],
  "Czech Republic": [49.82, 15.47], Denmark: [56.26, 9.5], Djibouti: [11.83, 42.59],
  Dominica: [15.41, -61.37], "Dominican Republic": [18.74, -70.16],
  "DR Congo": [-4.04, 21.76], Ecuador: [-1.83, -78.18], Egypt: [26.82, 30.8],
  "El Salvador": [13.79, -88.9], "Equatorial Guinea": [1.65, 10.27],
  Eritrea: [15.18, 39.78], Estonia: [58.6, 25.01], Eswatini: [-26.52, 31.47],
  Ethiopia: [9.15, 40.49], "Falkland Islands": [-51.8, -59.52],
  "Faroe Islands": [61.89, -6.91], Fiji: [-17.71, 178.07], Finland: [61.92, 25.75],
  France: [46.23, 2.21], "French Guiana": [3.93, -53.13],
  "French Polynesia": [-17.68, -149.41], "French Southern Territories": [-49.28, 69.35],
  Gabon: [-0.8, 11.61], Gambia: [13.44, -15.31], Georgia: [42.32, 43.36],
  Germany: [51.17, 10.45], Ghana: [7.95, -1.02], Gibraltar: [36.14, -5.35],
  Greece: [39.07, 21.82], Greenland: [71.71, -42.6], Grenada: [12.12, -61.68],
  Guadeloupe: [16.27, -61.55], Guam: [13.44, 144.79], Guatemala: [15.78, -90.23],
  Guernsey: [49.47, -2.59], Guinea: [9.95, -11.32], "Guinea-Bissau": [11.8, -15.18],
  Guyana: [4.86, -58.93], Haiti: [18.97, -72.29], "Heard Island": [-53.08, 73.5],
  Honduras: [15.2, -86.24], "Hong Kong": [22.32, 114.17], Hungary: [47.16, 19.5],
  Iceland: [64.96, -19.02], India: [20.59, 78.96], Indonesia: [-0.79, 113.92],
  Iran: [32.43, 53.69], Iraq: [33.22, 43.68], Ireland: [53.41, -8.24],
  "Isle of Man": [54.24, -4.55], Israel: [31.05, 34.85], Italy: [41.87, 12.57],
  Jamaica: [18.11, -77.3], Japan: [36.2, 138.25], Jersey: [49.21, -2.13],
  Jordan: [30.59, 36.24], Kazakhstan: [48.02, 66.92], Kenya: [-0.02, 37.91],
  Kiribati: [-3.37, -168.73], Kuwait: [29.31, 47.48], Kyrgyzstan: [41.2, 74.77],
  Laos: [19.86, 102.5], Latvia: [56.88, 24.6], Lebanon: [33.85, 35.86],
  Lesotho: [-29.61, 28.23], Liberia: [6.43, -9.43], Libya: [26.34, 17.23],
  Liechtenstein: [47.17, 9.55], Lithuania: [55.17, 23.88], Luxembourg: [49.82, 6.13],
  Macao: [22.2, 113.54], Madagascar: [-18.77, 46.87], Malawi: [-13.25, 34.3],
  Malaysia: [4.21, 101.98], Maldives: [3.2, 73.22], Mali: [17.57, -4],
  Malta: [35.94, 14.38], "Marshall Islands": [7.13, 171.18], Martinique: [14.64, -61.02],
  Mauritania: [21.01, -10.94], Mauritius: [-20.35, 57.55], Mayotte: [-12.83, 45.17],
  Mexico: [23.63, -102.55], Micronesia: [7.43, 150.55], Moldova: [47.41, 28.37],
  Monaco: [43.75, 7.41], Mongolia: [46.86, 103.85], Montenegro: [42.71, 19.37],
  Montserrat: [16.74, -62.19], Morocco: [31.79, -7.09], Mozambique: [-18.67, 35.53],
  Myanmar: [21.91, 95.96], Namibia: [-22.96, 18.49], Nauru: [-0.52, 166.93],
  Nepal: [28.39, 84.12], Netherlands: [52.13, 5.29], "New Caledonia": [-20.9, 165.62],
  "New Zealand": [-40.9, 174.89], Nicaragua: [12.87, -85.21], Niger: [17.61, 8.08],
  Nigeria: [9.08, 8.68], Niue: [-19.05, -169.87], "Norfolk Island": [-29.04, 167.95],
  "North Korea": [40.34, 127.51], "North Macedonia": [41.61, 21.75],
  "Northern Mariana Islands": [15.1, 145.67], Norway: [60.47, 8.47], Oman: [21.51, 55.92],
  Pakistan: [30.38, 69.35], Palau: [7.51, 134.58], Palestine: [31.95, 35.23],
  Panama: [8.54, -80.78], "Papua New Guinea": [-6.31, 143.96], Paraguay: [-23.44, -58.44],
  Peru: [-9.19, -75.02], Philippines: [12.88, 121.77], "Pitcairn Islands": [-24.7, -127.44],
  Poland: [51.92, 19.15], Portugal: [39.4, -8.22], "Puerto Rico": [18.22, -66.59],
  Qatar: [25.35, 51.18], "Republic of the Congo": [-0.23, 15.83],
  "Réunion": [-21.12, 55.54], Romania: [45.94, 24.97], Russia: [61.52, 105.32],
  Rwanda: [-1.94, 29.87], "Saint Barthélemy": [17.9, -62.83],
  "Saint Helena": [-15.96, -5.71], "Saint Kitts and Nevis": [17.36, -62.78],
  "Saint Lucia": [13.91, -60.98], "Saint Martin": [18.08, -63.05],
  "Saint Pierre and Miquelon": [46.94, -56.27], "Saint Vincent": [12.98, -61.29],
  Samoa: [-13.76, -172.1], "San Marino": [43.94, 12.46],
  "São Tomé and Príncipe": [0.19, 6.61], "Saudi Arabia": [23.89, 45.08],
  Senegal: [14.5, -14.45], Serbia: [44.02, 21.01], Seychelles: [-4.68, 55.49],
  "Sierra Leone": [8.46, -11.78], Singapore: [1.35, 103.82],
  "Sint Maarten": [18.04, -63.06], Slovakia: [48.67, 19.7], Slovenia: [46.15, 14.99],
  "Solomon Islands": [-9.65, 160.16], Somalia: [5.15, 46.2],
  "South Africa": [-30.56, 22.94], "South Georgia": [-54.43, -36.59],
  "South Korea": [35.91, 127.77], "South Sudan": [6.88, 31.31], Spain: [40.46, -3.75],
  "Sri Lanka": [7.87, 80.77], Sudan: [12.86, 30.22], Suriname: [3.92, -56.03],
  "Svalbard and Jan Mayen": [77.55, 23.67], Sweden: [60.13, 18.64],
  Switzerland: [46.82, 8.23], Syria: [34.8, 38.997], Taiwan: [23.7, 120.96],
  Tajikistan: [38.86, 71.28], Tanzania: [-6.37, 34.89], Thailand: [15.87, 100.99],
  "Timor-Leste": [-8.87, 125.73], Togo: [8.62, 0.82], Tokelau: [-9.2, -171.85],
  Tonga: [-21.18, -175.2], "Trinidad and Tobago": [10.69, -61.22], Tunisia: [33.89, 9.54],
  Turkey: [38.96, 35.24], Turkmenistan: [38.97, 59.56], "Turks and Caicos": [21.69, -71.8],
  Tuvalu: [-7.11, 177.65], "U.S. Minor Outlying Islands": [19.28, 166.6],
  "U.S. Virgin Islands": [18.34, -64.9], Uganda: [1.37, 32.29], Ukraine: [48.38, 31.17],
  "United Arab Emirates": [23.42, 53.85], "United Kingdom": [55.38, -3.44],
  "United States": [37.09, -95.71], Uruguay: [-32.52, -55.77], Uzbekistan: [41.38, 64.59],
  Vanuatu: [-15.38, 166.96], "Vatican City": [41.9, 12.45], Venezuela: [6.42, -66.59],
  Vietnam: [14.06, 108.28], "Wallis and Futuna": [-13.77, -177.16],
  "Western Sahara": [24.22, -12.89], Yemen: [15.55, 48.52], Zambia: [-13.13, 27.85],
  Zimbabwe: [-19.02, 29.15],
};

/**
 * Aliases -> canonical country name. Covers Portuguese/Spanish spellings,
 * demonyms people write instead of the country ("Nigerian", "cubano"), and the
 * misspellings that actually occur in the data ("veneziela", "Guatmala").
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  // Brazil
  brasil: "Brazil", brazil: "Brazil", br: "Brazil", bra: "Brazil", brasileiro: "Brazil",
  // Venezuela
  venezuela: "Venezuela", vzla: "Venezuela", vnzla: "Venezuela", veneziela: "Venezuela",
  venezolana: "Venezuela", venezolano: "Venezuela", ve: "Venezuela",
  // United States
  usa: "United States", "u s a": "United States", us: "United States",
  "united states": "United States", "united states of america": "United States",
  "estados unidos": "United States", eeuu: "United States", america: "United States",
  // United Kingdom
  uk: "United Kingdom", "united kingdom": "United Kingdom", gb: "United Kingdom",
  "great britain": "United Kingdom", england: "United Kingdom", scotland: "United Kingdom",
  wales: "United Kingdom", "northern ireland": "United Kingdom", britain: "United Kingdom",
  // Hispanophone / lusophone spellings
  mexico: "Mexico", mejico: "Mexico", espana: "Spain", espanha: "Spain", spain: "Spain",
  francia: "France", franca: "France", france: "France", alemania: "Germany",
  alemanha: "Germany", germany: "Germany", deutschland: "Germany", italia: "Italy",
  italy: "Italy", holanda: "Netherlands", "paises bajos": "Netherlands",
  "the netherlands": "Netherlands", netherlands: "Netherlands", nederland: "Netherlands",
  suiza: "Switzerland", suica: "Switzerland", switzerland: "Switzerland",
  ucrania: "Ukraine", ukraine: "Ukraine", grecia: "Greece", greece: "Greece",
  hellas: "Greece", peru: "Peru", colombia: "Colombia", argentina: "Argentina",
  arg: "Argentina", chile: "Chile", uruguay: "Uruguay", bolivia: "Bolivia",
  ecuador: "Ecuador", paraguay: "Paraguay", cuba: "Cuba", cubano: "Cuba",
  cubana: "Cuba", guatemala: "Guatemala", guatmala: "Guatemala", guatemaa: "Guatemala",
  portugal: "Portugal", canada: "Canada", "costa rica": "Costa Rica",
  // Africa
  nigeria: "Nigeria", nigerian: "Nigeria", naija: "Nigeria", ghana: "Ghana",
  ghanaian: "Ghana", kenya: "Kenya", uganda: "Uganda", ugandan: "Uganda",
  "south africa": "South Africa", tunisia: "Tunisia", tunisie: "Tunisia",
  tunis: "Tunisia", algeria: "Algeria", algerie: "Algeria", morocco: "Morocco",
  maroc: "Morocco", egypt: "Egypt", cameroon: "Cameroon", cameroun: "Cameroon",
  mozambique: "Mozambique", somalia: "Somalia", zimbabwe: "Zimbabwe", zambia: "Zambia",
  ethiopia: "Ethiopia", tanzania: "Tanzania", senegal: "Senegal", rwanda: "Rwanda",
  // Asia
  india: "India", bharat: "India", indian: "India", pakistan: "Pakistan",
  bangladesh: "Bangladesh", indonesia: "Indonesia", indonesian: "Indonesia",
  philippines: "Philippines", philipines: "Philippines", phillipine: "Philippines",
  phillipines: "Philippines", philipine: "Philippines", pilipinas: "Philippines",
  vietnam: "Vietnam", "viet nam": "Vietnam", vietnamese: "Vietnam",
  thailand: "Thailand", malaysia: "Malaysia", singapore: "Singapore",
  myanmar: "Myanmar", burma: "Myanmar", cambodia: "Cambodia", japan: "Japan",
  china: "China", "hong kong": "Hong Kong", "south korea": "South Korea",
  korea: "South Korea", israel: "Israel", turkey: "Turkey", turkiye: "Turkey",
  "sri lanka": "Sri Lanka", nepal: "Nepal", "united arab emirates": "United Arab Emirates",
  uae: "United Arab Emirates", "u a e": "United Arab Emirates", emirates: "United Arab Emirates",
  // Europe & Oceania leftovers
  austria: "Austria", belgium: "Belgium", bulgaria: "Bulgaria", croatia: "Croatia",
  hrvatska: "Croatia", romania: "Romania", russia: "Russia", belarus: "Belarus",
  poland: "Poland", polska: "Poland", slovenia: "Slovenia", slovakia: "Slovakia",
  serbia: "Serbia", hungary: "Hungary", "czech republic": "Czech Republic",
  czechia: "Czech Republic", sweden: "Sweden", norway: "Norway", denmark: "Denmark",
  finland: "Finland", iceland: "Iceland", ireland: "Ireland", australia: "Australia",
  "new zealand": "New Zealand", aotearoa: "New Zealand", bahamas: "Bahamas",
  "trinidad and tobago": "Trinidad and Tobago", jamaica: "Jamaica",
  "the land down under": "Australia", "down under": "Australia",
  "dominican republic": "Dominican Republic", "puerto rico": "Puerto Rico",
};

/**
 * Two-letter ISO code -> canonical country name, keyed lowercase because every
 * lookup in ./geo runs the input through `normalizeKey` first.
 *
 * Derived from ISO_TO_NAME rather than hand-listed. The country <Select> in the
 * profile editor stores exactly these codes and nothing else, so a hand-written
 * subset meant 157 of its 249 options resolved to no country at all: people
 * picked Angola, Cyprus or Cambodia in our own menu and landed in "location
 * unknown", off the map and off every country page. Deriving it makes that
 * coverage gap impossible to reintroduce.
 *
 * Every name this produces has a COUNTRY_CENTROIDS entry, which is what lets
 * `countryFromSlug` resolve the /skaters/[country] page the pills link to.
 */
export const ISO_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_TO_NAME).map(([code, name]) => [code.toLowerCase(), name])
);

/**
 * ISO codes that are also ordinary words, acronyms or region abbreviations.
 *
 * These are trusted only when the code is the WHOLE location string — which is
 * what the profile editor writes — and never as the trailing word of a phrase,
 * where "skate life is" would come back as Iceland and "LA" as Laos.
 *
 * Deliberately limited to codes the derived table above ADDED: the codes that
 * were already accepted before it (`at`, `be`, `do`, `in`, `it`, `ma`, `my`,
 * `no`, `se`) keep resolving exactly as they did, so widening the table cannot
 * regress a location that reads correctly today. Several of those are just as
 * word-like and worth guarding too, but that is a behaviour change for existing
 * profiles rather than coverage, so it is left for its own pass.
 */
export const AMBIGUOUS_ISO_CODES: ReadonlySet<string> = new Set([
  "ag", "ai", "al", "am", "as", "by", "im", "io", "is", "la",
  "me", "pa", "re", "sa", "so", "td", "to", "tv", "us",
]);

export interface CityEntry {
  /** Display name, properly cased and accented. */
  readonly name: string;
  readonly country: string;
  readonly coords: LatLng;
}

/**
 * City -> country + coords. Only cities that actually appear in Skatehive
 * profiles are listed; an unknown city just falls back to its country centroid,
 * so this table is a precision upgrade rather than a requirement.
 * Keys are normalized (lowercase, unaccented).
 */
export const CITIES: Record<string, CityEntry> = {
  // Brazil
  "rio de janeiro": { name: "Rio de Janeiro", country: "Brazil", coords: [-22.91, -43.17] },
  "sao paulo": { name: "São Paulo", country: "Brazil", coords: [-23.55, -46.63] },
  "belo horizonte": { name: "Belo Horizonte", country: "Brazil", coords: [-19.92, -43.94] },
  niteroi: { name: "Niterói", country: "Brazil", coords: [-22.88, -43.1] },
  "juiz de fora": { name: "Juiz de Fora", country: "Brazil", coords: [-21.76, -43.35] },
  vitoria: { name: "Vitória", country: "Brazil", coords: [-20.32, -40.34] },
  "vila velha": { name: "Vila Velha", country: "Brazil", coords: [-20.33, -40.29] },
  buzios: { name: "Búzios", country: "Brazil", coords: [-22.75, -41.88] },
  trancoso: { name: "Trancoso", country: "Brazil", coords: [-16.59, -39.09] },
  manaus: { name: "Manaus", country: "Brazil", coords: [-3.12, -60.02] },
  itapevi: { name: "Itapevi", country: "Brazil", coords: [-23.55, -46.93] },
  bertioga: { name: "Bertioga", country: "Brazil", coords: [-23.85, -46.14] },
  boraceia: { name: "Boraceia", country: "Brazil", coords: [-23.79, -45.95] },
  pavuna: { name: "Pavuna", country: "Brazil", coords: [-22.81, -43.36] },
  "sao jose dos campos": { name: "São José dos Campos", country: "Brazil", coords: [-23.19, -45.89] },
  "santa cruz do sul": { name: "Santa Cruz do Sul", country: "Brazil", coords: [-29.72, -52.43] },
  // Venezuela
  caracas: { name: "Caracas", country: "Venezuela", coords: [10.48, -66.9] },
  maracaibo: { name: "Maracaibo", country: "Venezuela", coords: [10.65, -71.65] },
  maracay: { name: "Maracay", country: "Venezuela", coords: [10.25, -67.6] },
  maturin: { name: "Maturín", country: "Venezuela", coords: [9.75, -63.18] },
  cumana: { name: "Cumaná", country: "Venezuela", coords: [10.45, -64.18] },
  carupano: { name: "Carúpano", country: "Venezuela", coords: [10.67, -63.25] },
  "san cristobal": { name: "San Cristóbal", country: "Venezuela", coords: [7.77, -72.22] },
  porlamar: { name: "Porlamar", country: "Venezuela", coords: [10.95, -63.85] },
  "isla de margarita": { name: "Isla de Margarita", country: "Venezuela", coords: [11.0, -64.0] },
  "isla margarita": { name: "Isla de Margarita", country: "Venezuela", coords: [11.0, -64.0] },
  "el tigre": { name: "El Tigre", country: "Venezuela", coords: [8.89, -64.25] },
  guacara: { name: "Guacara", country: "Venezuela", coords: [10.23, -67.88] },
  guarenas: { name: "Guarenas", country: "Venezuela", coords: [10.47, -66.61] },
  "punta de mata": { name: "Punta de Mata", country: "Venezuela", coords: [9.73, -63.63] },
  caicara: { name: "Caicara", country: "Venezuela", coords: [7.63, -66.16] },
  "rio claro": { name: "Río Claro", country: "Venezuela", coords: [9.92, -69.4] },
  // Nigeria
  lagos: { name: "Lagos", country: "Nigeria", coords: [6.52, 3.38] },
  abuja: { name: "Abuja", country: "Nigeria", coords: [9.06, 7.49] },
  "port harcourt": { name: "Port Harcourt", country: "Nigeria", coords: [4.82, 7.04] },
  uyo: { name: "Uyo", country: "Nigeria", coords: [5.04, 7.91] },
  aba: { name: "Aba", country: "Nigeria", coords: [5.11, 7.37] },
  enugu: { name: "Enugu", country: "Nigeria", coords: [6.46, 7.55] },
  ibadan: { name: "Ibadan", country: "Nigeria", coords: [7.38, 3.9] },
  ilorin: { name: "Ilorin", country: "Nigeria", coords: [8.5, 4.55] },
  jos: { name: "Jos", country: "Nigeria", coords: [9.9, 8.86] },
  akure: { name: "Akure", country: "Nigeria", coords: [7.25, 5.19] },
  calabar: { name: "Calabar", country: "Nigeria", coords: [4.95, 8.32] },
  okigwe: { name: "Okigwe", country: "Nigeria", coords: [5.83, 7.35] },
  akwanga: { name: "Akwanga", country: "Nigeria", coords: [8.91, 8.4] },
  benin: { name: "Benin City", country: "Nigeria", coords: [6.34, 5.63] },
  "benin city": { name: "Benin City", country: "Nigeria", coords: [6.34, 5.63] },
  // Ghana, Kenya, South Africa, North Africa
  accra: { name: "Accra", country: "Ghana", coords: [5.6, -0.19] },
  tamale: { name: "Tamale", country: "Ghana", coords: [9.4, -0.84] },
  nairobi: { name: "Nairobi", country: "Kenya", coords: [-1.29, 36.82] },
  "cape town": { name: "Cape Town", country: "South Africa", coords: [-33.92, 18.42] },
  muizenberg: { name: "Muizenberg", country: "South Africa", coords: [-34.1, 18.47] },
  maputo: { name: "Maputo", country: "Mozambique", coords: [-25.97, 32.57] },
  sousse: { name: "Sousse", country: "Tunisia", coords: [35.83, 10.64] },
  sfax: { name: "Sfax", country: "Tunisia", coords: [34.74, 10.76] },
  rades: { name: "Radès", country: "Tunisia", coords: [36.77, 10.28] },
  mahdia: { name: "Mahdia", country: "Tunisia", coords: [35.5, 11.06] },
  // Greece
  athens: { name: "Athens", country: "Greece", coords: [37.98, 23.73] },
  thessaloniki: { name: "Thessaloniki", country: "Greece", coords: [40.64, 22.94] },
  ioannina: { name: "Ioannina", country: "Greece", coords: [39.67, 20.85] },
  katerini: { name: "Katerini", country: "Greece", coords: [40.27, 22.5] },
  preveza: { name: "Preveza", country: "Greece", coords: [38.96, 20.75] },
  agrinio: { name: "Agrinio", country: "Greece", coords: [38.62, 21.41] },
  lefkas: { name: "Lefkada", country: "Greece", coords: [38.83, 20.71] },
  // Europe
  london: { name: "London", country: "United Kingdom", coords: [51.51, -0.13] },
  ldn: { name: "London", country: "United Kingdom", coords: [51.51, -0.13] },
  edinburgh: { name: "Edinburgh", country: "United Kingdom", coords: [55.95, -3.19] },
  rotherham: { name: "Rotherham", country: "United Kingdom", coords: [53.43, -1.36] },
  essex: { name: "Essex", country: "United Kingdom", coords: [51.75, 0.48] },
  madrid: { name: "Madrid", country: "Spain", coords: [40.42, -3.7] },
  barcelona: { name: "Barcelona", country: "Spain", coords: [41.39, 2.17] },
  zaragoza: { name: "Zaragoza", country: "Spain", coords: [41.65, -0.89] },
  galicia: { name: "Galicia", country: "Spain", coords: [42.58, -8.13] },
  palma: { name: "Palma", country: "Spain", coords: [39.57, 2.65] },
  lisbon: { name: "Lisbon", country: "Portugal", coords: [38.72, -9.14] },
  lisboa: { name: "Lisbon", country: "Portugal", coords: [38.72, -9.14] },
  vienna: { name: "Vienna", country: "Austria", coords: [48.21, 16.37] },
  hamburg: { name: "Hamburg", country: "Germany", coords: [53.55, 9.99] },
  amsterdam: { name: "Amsterdam", country: "Netherlands", coords: [52.37, 4.9] },
  "the hague": { name: "The Hague", country: "Netherlands", coords: [52.08, 4.31] },
  ljubljana: { name: "Ljubljana", country: "Slovenia", coords: [46.06, 14.51] },
  fazana: { name: "Fažana", country: "Croatia", coords: [44.93, 13.8] },
  akureyri: { name: "Akureyri", country: "Iceland", coords: [65.68, -18.09] },
  yekaterinburg: { name: "Yekaterinburg", country: "Russia", coords: [56.84, 60.61] },
  // Americas
  montevideo: { name: "Montevideo", country: "Uruguay", coords: [-34.9, -56.16] },
  "buenos aires": { name: "Buenos Aires", country: "Argentina", coords: [-34.6, -58.38] },
  mendoza: { name: "Mendoza", country: "Argentina", coords: [-32.89, -68.84] },
  gualeguaychu: { name: "Gualeguaychú", country: "Argentina", coords: [-33.01, -58.51] },
  lima: { name: "Lima", country: "Peru", coords: [-12.05, -77.04] },
  callao: { name: "Callao", country: "Peru", coords: [-12.06, -77.13] },
  lobitos: { name: "Lobitos", country: "Peru", coords: [-4.45, -81.28] },
  bogota: { name: "Bogotá", country: "Colombia", coords: [4.71, -74.07] },
  medellin: { name: "Medellín", country: "Colombia", coords: [6.24, -75.57] },
  "santa cruz": { name: "Santa Cruz", country: "Bolivia", coords: [-17.78, -63.18] },
  guadalajara: { name: "Guadalajara", country: "Mexico", coords: [20.67, -103.35] },
  leon: { name: "León", country: "Mexico", coords: [21.12, -101.68] },
  "lerdo de tejada": { name: "Lerdo de Tejada", country: "Mexico", coords: [18.63, -95.51] },
  havana: { name: "Havana", country: "Cuba", coords: [23.11, -82.37] },
  habana: { name: "Havana", country: "Cuba", coords: [23.11, -82.37] },
  "santiago de cuba": { name: "Santiago de Cuba", country: "Cuba", coords: [20.02, -75.82] },
  camaguey: { name: "Camagüey", country: "Cuba", coords: [21.38, -77.92] },
  vancouver: { name: "Vancouver", country: "Canada", coords: [49.28, -123.12] },
  kelowna: { name: "Kelowna", country: "Canada", coords: [49.89, -119.5] },
  revelstoke: { name: "Revelstoke", country: "Canada", coords: [50.99, -118.2] },
  "british columbia": { name: "British Columbia", country: "Canada", coords: [53.73, -127.65] },
  ontario: { name: "Ontario", country: "Canada", coords: [51.25, -85.32] },
  alberta: { name: "Alberta", country: "Canada", coords: [53.93, -116.58] },
  // Asia & Pacific
  dhaka: { name: "Dhaka", country: "Bangladesh", coords: [23.81, 90.41] },
  lahore: { name: "Lahore", country: "Pakistan", coords: [31.55, 74.34] },
  islamabad: { name: "Islamabad", country: "Pakistan", coords: [33.68, 73.05] },
  haldwani: { name: "Haldwani", country: "India", coords: [29.22, 79.53] },
  almora: { name: "Almora", country: "India", coords: [29.6, 79.66] },
  aceh: { name: "Aceh", country: "Indonesia", coords: [4.7, 96.75] },
  lhokseumawe: { name: "Lhokseumawe", country: "Indonesia", coords: [5.18, 97.14] },
  bireuen: { name: "Bireuen", country: "Indonesia", coords: [5.2, 96.7] },
  "labuan bajo": { name: "Labuan Bajo", country: "Indonesia", coords: [-8.49, 119.88] },
  cebu: { name: "Cebu", country: "Philippines", coords: [10.32, 123.89] },
  dumaguete: { name: "Dumaguete", country: "Philippines", coords: [9.31, 123.31] },
  mabinay: { name: "Mabinay", country: "Philippines", coords: [9.73, 122.91] },
  mariveles: { name: "Mariveles", country: "Philippines", coords: [14.43, 120.49] },
  manticao: { name: "Manticao", country: "Philippines", coords: [8.4, 124.29] },
  minuwangoda: { name: "Minuwangoda", country: "Sri Lanka", coords: [7.17, 79.95] },
  "ho chi minh city": { name: "Ho Chi Minh City", country: "Vietnam", coords: [10.82, 106.63] },
  "siem reap": { name: "Siem Reap", country: "Cambodia", coords: [13.36, 103.86] },
  "nay pyi taw": { name: "Nay Pyi Taw", country: "Myanmar", coords: [19.75, 96.1] },
  shenzhen: { name: "Shenzhen", country: "China", coords: [22.54, 114.06] },
  osaka: { name: "Osaka", country: "Japan", coords: [34.69, 135.5] },
  istanbul: { name: "İstanbul", country: "Turkey", coords: [41.01, 28.98] },
  mugla: { name: "Muğla", country: "Turkey", coords: [37.22, 28.36] },
  "tel aviv": { name: "Tel Aviv", country: "Israel", coords: [32.09, 34.78] },
  telaviv: { name: "Tel Aviv", country: "Israel", coords: [32.09, 34.78] },
  dubai: { name: "Dubai", country: "United Arab Emirates", coords: [25.2, 55.27] },
  "abu dhabi": { name: "Abu Dhabi", country: "United Arab Emirates", coords: [24.45, 54.38] },
  jerusalem: { name: "Jerusalem", country: "Israel", coords: [31.77, 35.21] },
  auckland: { name: "Auckland", country: "New Zealand", coords: [-36.85, 174.76] },
  adelaide: { name: "Adelaide", country: "Australia", coords: [-34.93, 138.6] },
  "margaret river": { name: "Margaret River", country: "Australia", coords: [-33.95, 115.07] },
  "south australia": { name: "South Australia", country: "Australia", coords: [-30.0, 136.21] },
  "western australia": { name: "Western Australia", country: "Australia", coords: [-25.04, 117.79] },
  // United States
  "new york": { name: "New York", country: "United States", coords: [40.71, -74.01] },
  "los angeles": { name: "Los Angeles", country: "United States", coords: [34.05, -118.24] },
  "san diego": { name: "San Diego", country: "United States", coords: [32.72, -117.16] },
  "san francisco": { name: "San Francisco", country: "United States", coords: [37.77, -122.42] },
  seattle: { name: "Seattle", country: "United States", coords: [47.61, -122.33] },
  portland: { name: "Portland", country: "United States", coords: [45.52, -122.68] },
  potland: { name: "Portland", country: "United States", coords: [45.52, -122.68] },
  philadelphia: { name: "Philadelphia", country: "United States", coords: [39.95, -75.17] },
  chicago: { name: "Chicago", country: "United States", coords: [41.88, -87.63] },
  boston: { name: "Boston", country: "United States", coords: [42.36, -71.06] },
  miami: { name: "Miami", country: "United States", coords: [25.76, -80.19] },
  tampa: { name: "Tampa", country: "United States", coords: [27.95, -82.46] },
  sarasota: { name: "Sarasota", country: "United States", coords: [27.34, -82.53] },
  phoenix: { name: "Phoenix", country: "United States", coords: [33.45, -112.07] },
  tucson: { name: "Tucson", country: "United States", coords: [32.22, -110.97] },
  lansing: { name: "Lansing", country: "United States", coords: [42.73, -84.56] },
  cincinnati: { name: "Cincinnati", country: "United States", coords: [39.1, -84.51] },
  mckinney: { name: "McKinney", country: "United States", coords: [33.2, -96.62] },
  lenexa: { name: "Lenexa", country: "United States", coords: [38.95, -94.73] },
  minneapolis: { name: "Minneapolis", country: "United States", coords: [44.98, -93.27] },
  mpls: { name: "Minneapolis", country: "United States", coords: [44.98, -93.27] },
  atl: { name: "Atlanta", country: "United States", coords: [33.75, -84.39] },
  atlanta: { name: "Atlanta", country: "United States", coords: [33.75, -84.39] },
  okc: { name: "Oklahoma City", country: "United States", coords: [35.47, -97.52] },
  "asbury park": { name: "Asbury Park", country: "United States", coords: [40.22, -74.01] },
  "mojave desert": { name: "Mojave Desert", country: "United States", coords: [35.01, -115.47] },
  atx: { name: "Austin", country: "United States", coords: [30.27, -97.74] },
  austin: { name: "Austin", country: "United States", coords: [30.27, -97.74] },

  // States and provinces people write instead of a city. Same shape as a city:
  // a named place with a country and a point we can pin on the map.
  "akwa ibom": { name: "Akwa Ibom", country: "Nigeria", coords: [5.01, 7.86] },
  akwaibom: { name: "Akwa Ibom", country: "Nigeria", coords: [5.01, 7.86] },
  nasarawa: { name: "Nasarawa", country: "Nigeria", coords: [8.5, 8.2] },
  abia: { name: "Abia", country: "Nigeria", coords: [5.45, 7.52] },
  anambra: { name: "Anambra", country: "Nigeria", coords: [6.22, 6.94] },
  ogun: { name: "Ogun", country: "Nigeria", coords: [6.99, 3.47] },
  "cross river": { name: "Cross River", country: "Nigeria", coords: [5.87, 8.6] },
  crs: { name: "Cross River", country: "Nigeria", coords: [5.87, 8.6] },
  "rivers state": { name: "Rivers", country: "Nigeria", coords: [4.86, 6.86] },
  "delta state": { name: "Delta", country: "Nigeria", coords: [5.71, 5.93] },
  ikom: { name: "Ikom", country: "Nigeria", coords: [5.96, 8.71] },
  eliozu: { name: "Eliozu", country: "Nigeria", coords: [4.86, 7.03] },
  zulia: { name: "Zulia", country: "Venezuela", coords: [10.0, -72.0] },
  monagas: { name: "Monagas", country: "Venezuela", coords: [9.6, -63.2] },
  sucre: { name: "Sucre", country: "Venezuela", coords: [10.3, -63.7] },
  anzoategui: { name: "Anzoátegui", country: "Venezuela", coords: [9.0, -64.3] },
  aragua: { name: "Aragua", country: "Venezuela", coords: [10.2, -67.3] },
  carabobo: { name: "Carabobo", country: "Venezuela", coords: [10.2, -68.1] },
  "nueva esparta": { name: "Nueva Esparta", country: "Venezuela", coords: [11.0, -64.0] },
  "nva esparta": { name: "Nueva Esparta", country: "Venezuela", coords: [11.0, -64.0] },
  lara: { name: "Lara", country: "Venezuela", coords: [10.07, -69.32] },
  guanajuato: { name: "Guanajuato", country: "Mexico", coords: [21.02, -101.26] },
  "entre rios": { name: "Entre Ríos", country: "Argentina", coords: [-31.77, -59.25] },
  "negros oriental": { name: "Negros Oriental", country: "Philippines", coords: [9.63, 122.98] },
  dumagete: { name: "Dumaguete", country: "Philippines", coords: [9.31, 123.31] },
  bataan: { name: "Bataan", country: "Philippines", coords: [14.68, 120.48] },
  "misamis oriental": { name: "Misamis Oriental", country: "Philippines", coords: [8.5, 124.62] },
  "nusa tenggara timur": { name: "Nusa Tenggara Timur", country: "Indonesia", coords: [-8.66, 121.08] },
  uttrakhand: { name: "Uttarakhand", country: "India", coords: [30.07, 79.09] },
  uttarakhand: { name: "Uttarakhand", country: "India", coords: [30.07, 79.09] },
};

/** US states and territories -> centroid. Codes only when not an ISO country code. */
export const US_STATES: Record<string, { readonly name: string; readonly coords: LatLng }> = {
  // Absent until now, so "Wilmington, DE" fell through to the ISO table and
  // came back Germany, and a New York skater had no state to resolve to.
  delaware: { name: "Delaware", coords: [39.32, -75.51] }, de: { name: "Delaware", coords: [39.32, -75.51] },
  "new york": { name: "New York", coords: [42.17, -74.95] }, ny: { name: "New York", coords: [42.17, -74.95] },
  "district of columbia": { name: "District of Columbia", coords: [38.9, -77.03] },
  dc: { name: "District of Columbia", coords: [38.9, -77.03] },
  alabama: { name: "Alabama", coords: [32.81, -86.79] }, alaska: { name: "Alaska", coords: [61.37, -152.4] },
  arizona: { name: "Arizona", coords: [33.73, -111.43] }, az: { name: "Arizona", coords: [33.73, -111.43] },
  arkansas: { name: "Arkansas", coords: [34.97, -92.37] }, california: { name: "California", coords: [36.12, -119.68] },
  colorado: { name: "Colorado", coords: [39.06, -105.31] }, connecticut: { name: "Connecticut", coords: [41.6, -72.76] },
  ct: { name: "Connecticut", coords: [41.6, -72.76] }, florida: { name: "Florida", coords: [27.77, -81.69] },
  fl: { name: "Florida", coords: [27.77, -81.69] }, georgia: { name: "Georgia", coords: [33.04, -83.64] },
  hawaii: { name: "Hawaii", coords: [21.09, -157.5] }, hi: { name: "Hawaii", coords: [21.09, -157.5] },
  idaho: { name: "Idaho", coords: [44.24, -114.48] }, illinois: { name: "Illinois", coords: [40.35, -88.99] },
  indiana: { name: "Indiana", coords: [39.85, -86.26] }, iowa: { name: "Iowa", coords: [42.01, -93.21] },
  kansas: { name: "Kansas", coords: [38.53, -96.73] }, ks: { name: "Kansas", coords: [38.53, -96.73] },
  kentucky: { name: "Kentucky", coords: [37.67, -84.67] }, louisiana: { name: "Louisiana", coords: [31.17, -91.87] },
  maine: { name: "Maine", coords: [44.69, -69.38] }, maryland: { name: "Maryland", coords: [39.06, -76.8] },
  massachusetts: { name: "Massachusetts", coords: [42.23, -71.53] }, michigan: { name: "Michigan", coords: [43.33, -84.54] },
  minnesota: { name: "Minnesota", coords: [45.69, -93.9] }, mississippi: { name: "Mississippi", coords: [32.74, -89.68] },
  missouri: { name: "Missouri", coords: [38.46, -92.29] }, montana: { name: "Montana", coords: [46.92, -110.45] },
  nebraska: { name: "Nebraska", coords: [41.13, -98.27] }, nevada: { name: "Nevada", coords: [38.31, -117.06] },
  "new hampshire": { name: "New Hampshire", coords: [43.45, -71.56] },
  "new jersey": { name: "New Jersey", coords: [40.3, -74.52] }, nj: { name: "New Jersey", coords: [40.3, -74.52] },
  "new mexico": { name: "New Mexico", coords: [34.84, -106.25] },
  "north carolina": { name: "North Carolina", coords: [35.63, -79.81] },
  "north dakota": { name: "North Dakota", coords: [47.53, -99.78] }, ohio: { name: "Ohio", coords: [40.39, -82.76] },
  oklahoma: { name: "Oklahoma", coords: [35.57, -96.93] }, oregon: { name: "Oregon", coords: [44.57, -122.07] },
  pennsylvania: { name: "Pennsylvania", coords: [40.59, -77.21] }, pa: { name: "Pennsylvania", coords: [40.59, -77.21] },
  "rhode island": { name: "Rhode Island", coords: [41.68, -71.51] },
  "south carolina": { name: "South Carolina", coords: [33.86, -80.95] },
  "south dakota": { name: "South Dakota", coords: [44.3, -99.44] }, tennessee: { name: "Tennessee", coords: [35.75, -86.69] },
  texas: { name: "Texas", coords: [31.05, -97.56] }, tx: { name: "Texas", coords: [31.05, -97.56] },
  utah: { name: "Utah", coords: [40.15, -111.86] }, vermont: { name: "Vermont", coords: [44.05, -72.71] },
  virginia: { name: "Virginia", coords: [37.77, -78.17] }, washington: { name: "Washington", coords: [47.4, -121.49] },
  wa: { name: "Washington", coords: [47.4, -121.49] },
  "west virginia": { name: "West Virginia", coords: [38.49, -80.95] },
  wisconsin: { name: "Wisconsin", coords: [44.27, -89.62] }, wyoming: { name: "Wyoming", coords: [42.76, -107.3] },
  "pacific northwest": { name: "Pacific Northwest", coords: [45.52, -122.68] },
  pnw: { name: "Pacific Northwest", coords: [45.52, -122.68] },
  // Every USPS code, including the ones that collide with an ISO country
  // code (ca/co/il/in/tn/ma/de/...). resolveLocation checks states before
  // bare ISO codes, so "Nashville, TN" is Tennessee and not Tunisia.
  al: { name: "Alabama", coords: [32.81, -86.79] },
  ak: { name: "Alaska", coords: [61.37, -152.4] },
  ar: { name: "Arkansas", coords: [34.97, -92.37] },
  ca: { name: "California", coords: [36.12, -119.68] },
  co: { name: "Colorado", coords: [39.06, -105.31] },
  ga: { name: "Georgia", coords: [33.04, -83.64] },
  id: { name: "Idaho", coords: [44.24, -114.48] },
  il: { name: "Illinois", coords: [40.35, -88.99] },
  in: { name: "Indiana", coords: [39.85, -86.26] },
  ia: { name: "Iowa", coords: [42.01, -93.21] },
  ky: { name: "Kentucky", coords: [37.67, -84.67] },
  la: { name: "Louisiana", coords: [31.17, -91.87] },
  me: { name: "Maine", coords: [44.69, -69.38] },
  md: { name: "Maryland", coords: [39.06, -76.8] },
  ma: { name: "Massachusetts", coords: [42.23, -71.53] },
  mi: { name: "Michigan", coords: [43.33, -84.54] },
  mn: { name: "Minnesota", coords: [45.69, -93.9] },
  ms: { name: "Mississippi", coords: [32.74, -89.68] },
  mo: { name: "Missouri", coords: [38.46, -92.29] },
  mt: { name: "Montana", coords: [46.92, -110.45] },
  ne: { name: "Nebraska", coords: [41.13, -98.27] },
  nv: { name: "Nevada", coords: [38.31, -117.06] },
  nh: { name: "New Hampshire", coords: [43.45, -71.56] },
  nm: { name: "New Mexico", coords: [34.84, -106.25] },
  nc: { name: "North Carolina", coords: [35.63, -79.81] },
  nd: { name: "North Dakota", coords: [47.53, -99.78] },
  oh: { name: "Ohio", coords: [40.39, -82.76] },
  ok: { name: "Oklahoma", coords: [35.57, -96.93] },
  or: { name: "Oregon", coords: [44.57, -122.07] },
  ri: { name: "Rhode Island", coords: [41.68, -71.51] },
  sc: { name: "South Carolina", coords: [33.86, -80.95] },
  sd: { name: "South Dakota", coords: [44.3, -99.44] },
  tn: { name: "Tennessee", coords: [35.75, -86.69] },
  ut: { name: "Utah", coords: [40.15, -111.86] },
  vt: { name: "Vermont", coords: [44.05, -72.71] },
  va: { name: "Virginia", coords: [37.77, -78.17] },
  wv: { name: "West Virginia", coords: [38.49, -80.95] },
  wi: { name: "Wisconsin", coords: [44.27, -89.62] },
  wy: { name: "Wyoming", coords: [42.76, -107.3] },
};

/**
 * Strings that look like a location but aren't one — "Moon", "Metaverse",
 * "Mordor", "pale blue dot". These get their own bucket in the UI instead of
 * being dumped into "unknown", because a directory of skaters should have room
 * for people who refuse to say where they are.
 */
export const NOWHERE_TOKENS: readonly string[] = [
  "earth", "planet earth", "mother earth", "world", "the world", "worldwide", "world wide",
  "mundo", "el mundo", "moon", "mars", "pluto", "universe", "local universe", "multiverse",
  "galaxy", "space", "hyperspace", "metaverse", "the metaverse", "cyberspace", "internet",
  "interwebz", "blockchain", "hive", "hiveworld", "web3", "everywhere", "nowhere", "unknown",
  "home", "somewhere", "anywhere", "here", "there", "kingdom", "mordor", "winterfell",
  "valinor", "biafra", "epikland", "landream", "funland", "adamland", "omnoi", "womo",
  "the street", "pale blue dot", "the melting pot", "antarctica", "asia", "africa", "europe",
  "eu", "south america", "sur america", "north america", "milky way",
];
