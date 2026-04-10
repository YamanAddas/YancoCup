/**
 * Locale-aware data translations for teams, competitions, venues, and countries.
 *
 * Team names use FIFA/UEFA official translations.
 * Competition names follow broadcast conventions per language.
 * Venue names keep proper nouns but translate generic terms (Stadium, City).
 * Country names use standard Intl display names as baseline.
 */

import type { LangCode } from "./i18n";

// ─── Team Names (48 WC 2026 teams × 6 languages) ────────────────────────────
// Keys match team.id from teams.json

const TEAM_NAMES: Record<string, Record<LangCode, string>> = {
  // Group A
  mex: { en: "Mexico", ar: "المكسيك", es: "México", fr: "Mexique", de: "Mexiko", pt: "México" },
  kor: { en: "South Korea", ar: "كوريا الجنوبية", es: "Corea del Sur", fr: "Corée du Sud", de: "Südkorea", pt: "Coreia do Sul" },
  rsa: { en: "South Africa", ar: "جنوب أفريقيا", es: "Sudáfrica", fr: "Afrique du Sud", de: "Südafrika", pt: "África do Sul" },
  cze: { en: "Czechia", ar: "التشيك", es: "Chequia", fr: "Tchéquie", de: "Tschechien", pt: "Chéquia" },

  // Group B
  can: { en: "Canada", ar: "كندا", es: "Canadá", fr: "Canada", de: "Kanada", pt: "Canadá" },
  bih: { en: "Bosnia and Herzegovina", ar: "البوسنة والهرسك", es: "Bosnia y Herzegovina", fr: "Bosnie-Herzégovine", de: "Bosnien und Herzegowina", pt: "Bósnia e Herzegovina" },
  qat: { en: "Qatar", ar: "قطر", es: "Catar", fr: "Qatar", de: "Katar", pt: "Catar" },
  sui: { en: "Switzerland", ar: "سويسرا", es: "Suiza", fr: "Suisse", de: "Schweiz", pt: "Suíça" },

  // Group C
  bra: { en: "Brazil", ar: "البرازيل", es: "Brasil", fr: "Brésil", de: "Brasilien", pt: "Brasil" },
  mar: { en: "Morocco", ar: "المغرب", es: "Marruecos", fr: "Maroc", de: "Marokko", pt: "Marrocos" },
  hai: { en: "Haiti", ar: "هايتي", es: "Haití", fr: "Haïti", de: "Haiti", pt: "Haiti" },
  sco: { en: "Scotland", ar: "اسكتلندا", es: "Escocia", fr: "Écosse", de: "Schottland", pt: "Escócia" },

  // Group D
  usa: { en: "United States", ar: "الولايات المتحدة", es: "Estados Unidos", fr: "États-Unis", de: "Vereinigte Staaten", pt: "Estados Unidos" },
  par: { en: "Paraguay", ar: "باراغواي", es: "Paraguay", fr: "Paraguay", de: "Paraguay", pt: "Paraguai" },
  aus: { en: "Australia", ar: "أستراليا", es: "Australia", fr: "Australie", de: "Australien", pt: "Austrália" },
  tur: { en: "Turkiye", ar: "تركيا", es: "Turquía", fr: "Türkiye", de: "Türkei", pt: "Turquia" },

  // Group E
  ger: { en: "Germany", ar: "ألمانيا", es: "Alemania", fr: "Allemagne", de: "Deutschland", pt: "Alemanha" },
  ecu: { en: "Ecuador", ar: "الإكوادور", es: "Ecuador", fr: "Équateur", de: "Ecuador", pt: "Equador" },
  civ: { en: "Ivory Coast", ar: "ساحل العاج", es: "Costa de Marfil", fr: "Côte d'Ivoire", de: "Elfenbeinküste", pt: "Costa do Marfim" },
  cuw: { en: "Curacao", ar: "كوراساو", es: "Curazao", fr: "Curaçao", de: "Curaçao", pt: "Curaçao" },

  // Group F
  ned: { en: "Netherlands", ar: "هولندا", es: "Países Bajos", fr: "Pays-Bas", de: "Niederlande", pt: "Países Baixos" },
  jpn: { en: "Japan", ar: "اليابان", es: "Japón", fr: "Japon", de: "Japan", pt: "Japão" },
  swe: { en: "Sweden", ar: "السويد", es: "Suecia", fr: "Suède", de: "Schweden", pt: "Suécia" },
  tun: { en: "Tunisia", ar: "تونس", es: "Túnez", fr: "Tunisie", de: "Tunesien", pt: "Tunísia" },

  // Group G
  bel: { en: "Belgium", ar: "بلجيكا", es: "Bélgica", fr: "Belgique", de: "Belgien", pt: "Bélgica" },
  egy: { en: "Egypt", ar: "مصر", es: "Egipto", fr: "Égypte", de: "Ägypten", pt: "Egito" },
  irn: { en: "Iran", ar: "إيران", es: "Irán", fr: "Iran", de: "Iran", pt: "Irã" },
  nzl: { en: "New Zealand", ar: "نيوزيلندا", es: "Nueva Zelanda", fr: "Nouvelle-Zélande", de: "Neuseeland", pt: "Nova Zelândia" },

  // Group H
  esp: { en: "Spain", ar: "إسبانيا", es: "España", fr: "Espagne", de: "Spanien", pt: "Espanha" },
  uru: { en: "Uruguay", ar: "الأوروغواي", es: "Uruguay", fr: "Uruguay", de: "Uruguay", pt: "Uruguai" },
  ksa: { en: "Saudi Arabia", ar: "السعودية", es: "Arabia Saudita", fr: "Arabie saoudite", de: "Saudi-Arabien", pt: "Arábia Saudita" },
  cpv: { en: "Cape Verde", ar: "الرأس الأخضر", es: "Cabo Verde", fr: "Cap-Vert", de: "Kap Verde", pt: "Cabo Verde" },

  // Group I
  fra: { en: "France", ar: "فرنسا", es: "Francia", fr: "France", de: "Frankreich", pt: "França" },
  sen: { en: "Senegal", ar: "السنغال", es: "Senegal", fr: "Sénégal", de: "Senegal", pt: "Senegal" },
  irq: { en: "Iraq", ar: "العراق", es: "Irak", fr: "Irak", de: "Irak", pt: "Iraque" },
  nor: { en: "Norway", ar: "النرويج", es: "Noruega", fr: "Norvège", de: "Norwegen", pt: "Noruega" },

  // Group J
  arg: { en: "Argentina", ar: "الأرجنتين", es: "Argentina", fr: "Argentine", de: "Argentinien", pt: "Argentina" },
  alg: { en: "Algeria", ar: "الجزائر", es: "Argelia", fr: "Algérie", de: "Algerien", pt: "Argélia" },
  aut: { en: "Austria", ar: "النمسا", es: "Austria", fr: "Autriche", de: "Österreich", pt: "Áustria" },
  jor: { en: "Jordan", ar: "الأردن", es: "Jordania", fr: "Jordanie", de: "Jordanien", pt: "Jordânia" },

  // Group K
  por: { en: "Portugal", ar: "البرتغال", es: "Portugal", fr: "Portugal", de: "Portugal", pt: "Portugal" },
  cod: { en: "DR Congo", ar: "الكونغو الديمقراطية", es: "RD Congo", fr: "RD Congo", de: "DR Kongo", pt: "RD Congo" },
  uzb: { en: "Uzbekistan", ar: "أوزبكستان", es: "Uzbekistán", fr: "Ouzbékistan", de: "Usbekistan", pt: "Uzbequistão" },
  col: { en: "Colombia", ar: "كولومبيا", es: "Colombia", fr: "Colombie", de: "Kolumbien", pt: "Colômbia" },

  // Group L
  eng: { en: "England", ar: "إنجلترا", es: "Inglaterra", fr: "Angleterre", de: "England", pt: "Inglaterra" },
  cro: { en: "Croatia", ar: "كرواتيا", es: "Croacia", fr: "Croatie", de: "Kroatien", pt: "Croácia" },
  gha: { en: "Ghana", ar: "غانا", es: "Ghana", fr: "Ghana", de: "Ghana", pt: "Gana" },
  pan: { en: "Panama", ar: "بنما", es: "Panamá", fr: "Panama", de: "Panama", pt: "Panamá" },
};

// ─── Competition Names ───────────────────────────────────────────────────────
// Keys match CompetitionConfig.id

const COMPETITION_NAMES: Record<string, Record<LangCode, { name: string; shortName: string }>> = {
  WC: {
    en: { name: "FIFA World Cup 2026", shortName: "World Cup" },
    ar: { name: "كأس العالم 2026", shortName: "كأس العالم" },
    es: { name: "Copa Mundial de la FIFA 2026", shortName: "Mundial" },
    fr: { name: "Coupe du Monde FIFA 2026", shortName: "Coupe du Monde" },
    de: { name: "FIFA Weltmeisterschaft 2026", shortName: "WM" },
    pt: { name: "Copa do Mundo FIFA 2026", shortName: "Copa do Mundo" },
  },
  CL: {
    en: { name: "UEFA Champions League", shortName: "Champions League" },
    ar: { name: "دوري أبطال أوروبا", shortName: "دوري الأبطال" },
    es: { name: "Liga de Campeones de la UEFA", shortName: "Champions" },
    fr: { name: "Ligue des Champions UEFA", shortName: "Ligue des Champions" },
    de: { name: "UEFA Champions League", shortName: "Champions League" },
    pt: { name: "Liga dos Campeões da UEFA", shortName: "Liga dos Campeões" },
  },
  PL: {
    en: { name: "Premier League", shortName: "Premier League" },
    ar: { name: "الدوري الإنجليزي الممتاز", shortName: "الدوري الإنجليزي" },
    es: { name: "Premier League", shortName: "Premier League" },
    fr: { name: "Premier League", shortName: "Premier League" },
    de: { name: "Premier League", shortName: "Premier League" },
    pt: { name: "Premier League", shortName: "Premier League" },
  },
  PD: {
    en: { name: "La Liga", shortName: "La Liga" },
    ar: { name: "الدوري الإسباني", shortName: "الليغا" },
    es: { name: "La Liga", shortName: "La Liga" },
    fr: { name: "La Liga", shortName: "La Liga" },
    de: { name: "La Liga", shortName: "La Liga" },
    pt: { name: "La Liga", shortName: "La Liga" },
  },
  BL1: {
    en: { name: "Bundesliga", shortName: "Bundesliga" },
    ar: { name: "الدوري الألماني", shortName: "البوندسليغا" },
    es: { name: "Bundesliga", shortName: "Bundesliga" },
    fr: { name: "Bundesliga", shortName: "Bundesliga" },
    de: { name: "Bundesliga", shortName: "Bundesliga" },
    pt: { name: "Bundesliga", shortName: "Bundesliga" },
  },
  SA: {
    en: { name: "Serie A", shortName: "Serie A" },
    ar: { name: "الدوري الإيطالي", shortName: "سيري أ" },
    es: { name: "Serie A", shortName: "Serie A" },
    fr: { name: "Serie A", shortName: "Serie A" },
    de: { name: "Serie A", shortName: "Serie A" },
    pt: { name: "Serie A", shortName: "Serie A" },
  },
  FL1: {
    en: { name: "Ligue 1", shortName: "Ligue 1" },
    ar: { name: "الدوري الفرنسي", shortName: "ليغ 1" },
    es: { name: "Ligue 1", shortName: "Ligue 1" },
    fr: { name: "Ligue 1", shortName: "Ligue 1" },
    de: { name: "Ligue 1", shortName: "Ligue 1" },
    pt: { name: "Ligue 1", shortName: "Ligue 1" },
  },
  EL: {
    en: { name: "UEFA Europa League", shortName: "Europa League" },
    ar: { name: "الدوري الأوروبي", shortName: "الدوري الأوروبي" },
    es: { name: "Liga Europa de la UEFA", shortName: "Europa League" },
    fr: { name: "Ligue Europa UEFA", shortName: "Ligue Europa" },
    de: { name: "UEFA Europa League", shortName: "Europa League" },
    pt: { name: "Liga Europa da UEFA", shortName: "Liga Europa" },
  },
};

// ─── Venue Names ─────────────────────────────────────────────────────────────
// Stadium proper names are kept; cities/countries translated

const VENUE_NAMES: Record<string, Record<LangCode, { name: string; city: string; country: string }>> = {
  guadalajara: {
    en: { name: "Estadio Akron", city: "Guadalajara", country: "Mexico" },
    ar: { name: "ملعب أكرون", city: "غوادالاخارا", country: "المكسيك" },
    es: { name: "Estadio Akron", city: "Guadalajara", country: "México" },
    fr: { name: "Estadio Akron", city: "Guadalajara", country: "Mexique" },
    de: { name: "Estadio Akron", city: "Guadalajara", country: "Mexiko" },
    pt: { name: "Estadio Akron", city: "Guadalajara", country: "México" },
  },
  toronto: {
    en: { name: "BMO Field", city: "Toronto", country: "Canada" },
    ar: { name: "ملعب بي إم أو", city: "تورونتو", country: "كندا" },
    es: { name: "BMO Field", city: "Toronto", country: "Canadá" },
    fr: { name: "BMO Field", city: "Toronto", country: "Canada" },
    de: { name: "BMO Field", city: "Toronto", country: "Kanada" },
    pt: { name: "BMO Field", city: "Toronto", country: "Canadá" },
  },
  la: {
    en: { name: "SoFi Stadium", city: "Los Angeles", country: "USA" },
    ar: { name: "ملعب سوفاي", city: "لوس أنجلوس", country: "الولايات المتحدة" },
    es: { name: "SoFi Stadium", city: "Los Ángeles", country: "EE. UU." },
    fr: { name: "SoFi Stadium", city: "Los Angeles", country: "États-Unis" },
    de: { name: "SoFi Stadium", city: "Los Angeles", country: "USA" },
    pt: { name: "SoFi Stadium", city: "Los Angeles", country: "EUA" },
  },
  sf: {
    en: { name: "Levi's Stadium", city: "San Francisco Bay Area", country: "USA" },
    ar: { name: "ملعب ليفايز", city: "منطقة خليج سان فرانسيسكو", country: "الولايات المتحدة" },
    es: { name: "Levi's Stadium", city: "Área de la Bahía de San Francisco", country: "EE. UU." },
    fr: { name: "Levi's Stadium", city: "Baie de San Francisco", country: "États-Unis" },
    de: { name: "Levi's Stadium", city: "San Francisco Bay Area", country: "USA" },
    pt: { name: "Levi's Stadium", city: "Área da Baía de São Francisco", country: "EUA" },
  },
  nyc: {
    en: { name: "MetLife Stadium", city: "New York / New Jersey", country: "USA" },
    ar: { name: "ملعب ميتلايف", city: "نيويورك / نيوجيرسي", country: "الولايات المتحدة" },
    es: { name: "MetLife Stadium", city: "Nueva York / Nueva Jersey", country: "EE. UU." },
    fr: { name: "MetLife Stadium", city: "New York / New Jersey", country: "États-Unis" },
    de: { name: "MetLife Stadium", city: "New York / New Jersey", country: "USA" },
    pt: { name: "MetLife Stadium", city: "Nova York / Nova Jersey", country: "EUA" },
  },
  boston: {
    en: { name: "Gillette Stadium", city: "Boston / Foxborough", country: "USA" },
    ar: { name: "ملعب جيليت", city: "بوسطن / فوكسبورو", country: "الولايات المتحدة" },
    es: { name: "Gillette Stadium", city: "Boston / Foxborough", country: "EE. UU." },
    fr: { name: "Gillette Stadium", city: "Boston / Foxborough", country: "États-Unis" },
    de: { name: "Gillette Stadium", city: "Boston / Foxborough", country: "USA" },
    pt: { name: "Gillette Stadium", city: "Boston / Foxborough", country: "EUA" },
  },
  vancouver: {
    en: { name: "BC Place", city: "Vancouver", country: "Canada" },
    ar: { name: "بي سي بلايس", city: "فانكوفر", country: "كندا" },
    es: { name: "BC Place", city: "Vancouver", country: "Canadá" },
    fr: { name: "BC Place", city: "Vancouver", country: "Canada" },
    de: { name: "BC Place", city: "Vancouver", country: "Kanada" },
    pt: { name: "BC Place", city: "Vancouver", country: "Canadá" },
  },
  houston: {
    en: { name: "NRG Stadium", city: "Houston", country: "USA" },
    ar: { name: "ملعب إن آر جي", city: "هيوستن", country: "الولايات المتحدة" },
    es: { name: "NRG Stadium", city: "Houston", country: "EE. UU." },
    fr: { name: "NRG Stadium", city: "Houston", country: "États-Unis" },
    de: { name: "NRG Stadium", city: "Houston", country: "USA" },
    pt: { name: "NRG Stadium", city: "Houston", country: "EUA" },
  },
  dallas: {
    en: { name: "AT&T Stadium", city: "Dallas", country: "USA" },
    ar: { name: "ملعب إيه تي أند تي", city: "دالاس", country: "الولايات المتحدة" },
    es: { name: "AT&T Stadium", city: "Dallas", country: "EE. UU." },
    fr: { name: "AT&T Stadium", city: "Dallas", country: "États-Unis" },
    de: { name: "AT&T Stadium", city: "Dallas", country: "USA" },
    pt: { name: "AT&T Stadium", city: "Dallas", country: "EUA" },
  },
  philadelphia: {
    en: { name: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
    ar: { name: "ملعب لينكولن فاينانشال", city: "فيلادلفيا", country: "الولايات المتحدة" },
    es: { name: "Lincoln Financial Field", city: "Filadelfia", country: "EE. UU." },
    fr: { name: "Lincoln Financial Field", city: "Philadelphie", country: "États-Unis" },
    de: { name: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
    pt: { name: "Lincoln Financial Field", city: "Filadélfia", country: "EUA" },
  },
  atlanta: {
    en: { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
    ar: { name: "ملعب مرسيدس بنز", city: "أتلانتا", country: "الولايات المتحدة" },
    es: { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "EE. UU." },
    fr: { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "États-Unis" },
    de: { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
    pt: { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "EUA" },
  },
  seattle: {
    en: { name: "Lumen Field", city: "Seattle", country: "USA" },
    ar: { name: "ملعب لومين", city: "سياتل", country: "الولايات المتحدة" },
    es: { name: "Lumen Field", city: "Seattle", country: "EE. UU." },
    fr: { name: "Lumen Field", city: "Seattle", country: "États-Unis" },
    de: { name: "Lumen Field", city: "Seattle", country: "USA" },
    pt: { name: "Lumen Field", city: "Seattle", country: "EUA" },
  },
  miami: {
    en: { name: "Hard Rock Stadium", city: "Miami", country: "USA" },
    ar: { name: "ملعب هارد روك", city: "ميامي", country: "الولايات المتحدة" },
    es: { name: "Hard Rock Stadium", city: "Miami", country: "EE. UU." },
    fr: { name: "Hard Rock Stadium", city: "Miami", country: "États-Unis" },
    de: { name: "Hard Rock Stadium", city: "Miami", country: "USA" },
    pt: { name: "Hard Rock Stadium", city: "Miami", country: "EUA" },
  },
  kc: {
    en: { name: "GEHA Field at Arrowhead Stadium", city: "Kansas City", country: "USA" },
    ar: { name: "ملعب أروهيد", city: "كانساس سيتي", country: "الولايات المتحدة" },
    es: { name: "GEHA Field at Arrowhead Stadium", city: "Kansas City", country: "EE. UU." },
    fr: { name: "GEHA Field at Arrowhead Stadium", city: "Kansas City", country: "États-Unis" },
    de: { name: "GEHA Field at Arrowhead Stadium", city: "Kansas City", country: "USA" },
    pt: { name: "GEHA Field at Arrowhead Stadium", city: "Kansas City", country: "EUA" },
  },
  mexico: {
    en: { name: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
    ar: { name: "ملعب أزتيكا", city: "مكسيكو سيتي", country: "المكسيك" },
    es: { name: "Estadio Azteca", city: "Ciudad de México", country: "México" },
    fr: { name: "Estadio Azteca", city: "Mexico", country: "Mexique" },
    de: { name: "Estadio Azteca", city: "Mexiko-Stadt", country: "Mexiko" },
    pt: { name: "Estadio Azteca", city: "Cidade do México", country: "México" },
  },
  monterrey: {
    en: { name: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
    ar: { name: "ملعب بي بي في أيه", city: "مونتيري", country: "المكسيك" },
    es: { name: "Estadio BBVA", city: "Monterrey", country: "México" },
    fr: { name: "Estadio BBVA", city: "Monterrey", country: "Mexique" },
    de: { name: "Estadio BBVA", city: "Monterrey", country: "Mexiko" },
    pt: { name: "Estadio BBVA", city: "Monterrey", country: "México" },
  },
};

// ─── Country Names (for broadcaster page + general use) ──────────────────────
// Keys match isoCode from broadcasters.json

const COUNTRY_NAMES: Record<string, Record<LangCode, string>> = {
  us: { en: "United States", ar: "الولايات المتحدة", es: "Estados Unidos", fr: "États-Unis", de: "Vereinigte Staaten", pt: "Estados Unidos" },
  gb: { en: "United Kingdom", ar: "المملكة المتحدة", es: "Reino Unido", fr: "Royaume-Uni", de: "Vereinigtes Königreich", pt: "Reino Unido" },
  ca: { en: "Canada", ar: "كندا", es: "Canadá", fr: "Canada", de: "Kanada", pt: "Canadá" },
  mx: { en: "Mexico", ar: "المكسيك", es: "México", fr: "Mexique", de: "Mexiko", pt: "México" },
  de: { en: "Germany", ar: "ألمانيا", es: "Alemania", fr: "Allemagne", de: "Deutschland", pt: "Alemanha" },
  fr: { en: "France", ar: "فرنسا", es: "Francia", fr: "France", de: "Frankreich", pt: "França" },
  es: { en: "Spain", ar: "إسبانيا", es: "España", fr: "Espagne", de: "Spanien", pt: "Espanha" },
  it: { en: "Italy", ar: "إيطاليا", es: "Italia", fr: "Italie", de: "Italien", pt: "Itália" },
  nl: { en: "Netherlands", ar: "هولندا", es: "Países Bajos", fr: "Pays-Bas", de: "Niederlande", pt: "Países Baixos" },
  pt: { en: "Portugal", ar: "البرتغال", es: "Portugal", fr: "Portugal", de: "Portugal", pt: "Portugal" },
  br: { en: "Brazil", ar: "البرازيل", es: "Brasil", fr: "Brésil", de: "Brasilien", pt: "Brasil" },
  sa: { en: "Saudi Arabia", ar: "السعودية", es: "Arabia Saudita", fr: "Arabie saoudite", de: "Saudi-Arabien", pt: "Arábia Saudita" },
  jo: { en: "Jordan", ar: "الأردن", es: "Jordania", fr: "Jordanie", de: "Jordanien", pt: "Jordânia" },
  ae: { en: "UAE", ar: "الإمارات", es: "EAU", fr: "EAU", de: "VAE", pt: "EAU" },
  au: { en: "Australia", ar: "أستراليا", es: "Australia", fr: "Australie", de: "Australien", pt: "Austrália" },
  jp: { en: "Japan", ar: "اليابان", es: "Japón", fr: "Japon", de: "Japan", pt: "Japão" },
  kr: { en: "South Korea", ar: "كوريا الجنوبية", es: "Corea del Sur", fr: "Corée du Sud", de: "Südkorea", pt: "Coreia do Sul" },
  tr: { en: "Turkey", ar: "تركيا", es: "Turquía", fr: "Türkiye", de: "Türkei", pt: "Turquia" },
};

// ─── Confederation Names ─────────────────────────────────────────────────────

const CONFEDERATION_NAMES: Record<string, Record<LangCode, string>> = {
  UEFA: { en: "UEFA", ar: "الاتحاد الأوروبي", es: "UEFA", fr: "UEFA", de: "UEFA", pt: "UEFA" },
  CONMEBOL: { en: "CONMEBOL", ar: "اتحاد أمريكا الجنوبية", es: "CONMEBOL", fr: "CONMEBOL", de: "CONMEBOL", pt: "CONMEBOL" },
  CONCACAF: { en: "CONCACAF", ar: "الكونكاكاف", es: "CONCACAF", fr: "CONCACAF", de: "CONCACAF", pt: "CONCACAF" },
  CAF: { en: "CAF", ar: "الاتحاد الأفريقي", es: "CAF", fr: "CAF", de: "CAF", pt: "CAF" },
  AFC: { en: "AFC", ar: "الاتحاد الآسيوي", es: "AFC", fr: "AFC", de: "AFC", pt: "AFC" },
  OFC: { en: "OFC", ar: "اتحاد أوقيانوسيا", es: "OFC", fr: "OFC", de: "OFC", pt: "OFC" },
};

// ─── Lookup Functions ────────────────────────────────────────────────────────

/**
 * Get a translated team name. Falls back to English, then to the raw id.
 * Also handles API team names (from football-data.org) that aren't in our static list.
 */
export function teamName(idOrName: string, lang: LangCode): string {
  const id = idOrName.toLowerCase();
  const entry = TEAM_NAMES[id];
  if (entry) return entry[lang] ?? entry.en ?? idOrName;
  // For API teams not in our 48-team list, return the name as-is
  return idOrName;
}

/**
 * Get translated competition name/shortName.
 */
export function competitionName(compId: string, lang: LangCode): { name: string; shortName: string } {
  const entry = COMPETITION_NAMES[compId.toUpperCase()];
  if (entry) return entry[lang] ?? entry.en;
  return { name: compId, shortName: compId };
}

/**
 * Get translated venue info (name, city, country).
 */
export function venueName(venueId: string, lang: LangCode): { name: string; city: string; country: string } {
  const entry = VENUE_NAMES[venueId];
  if (entry) return entry[lang] ?? entry.en;
  return { name: venueId, city: "", country: "" };
}

/**
 * Get a translated country name by ISO code.
 */
export function countryName(isoCode: string, lang: LangCode): string {
  const entry = COUNTRY_NAMES[isoCode.toLowerCase()];
  if (entry) return entry[lang] ?? entry.en ?? isoCode;
  return isoCode;
}

/**
 * Get a translated confederation name.
 */
export function confederationName(confId: string, lang: LangCode): string {
  const entry = CONFEDERATION_NAMES[confId];
  if (entry) return entry[lang] ?? entry.en ?? confId;
  return confId;
}

/**
 * Try to match a team name (in any language) back to a team id.
 * Useful for search/filter features.
 */
export function findTeamByName(query: string): string | undefined {
  const q = query.toLowerCase().trim();
  for (const [id, names] of Object.entries(TEAM_NAMES)) {
    for (const name of Object.values(names)) {
      if (name.toLowerCase().includes(q)) return id;
    }
  }
  return undefined;
}
