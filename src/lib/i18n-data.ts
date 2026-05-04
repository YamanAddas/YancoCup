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

  // ── Club Teams (for news tags, standings, match pages) ─────────────────────
  // Spain
  rma: { en: "Real Madrid", ar: "ريال مدريد", es: "Real Madrid", fr: "Real Madrid", de: "Real Madrid", pt: "Real Madrid" },
  bar: { en: "Barcelona", ar: "برشلونة", es: "Barcelona", fr: "Barcelone", de: "Barcelona", pt: "Barcelona" },
  atm: { en: "Atlético Madrid", ar: "أتلتيكو مدريد", es: "Atlético de Madrid", fr: "Atlético Madrid", de: "Atlético Madrid", pt: "Atlético de Madrid" },
  rso: { en: "Real Sociedad", ar: "ريال سوسيداد", es: "Real Sociedad", fr: "Real Sociedad", de: "Real Sociedad", pt: "Real Sociedad" },
  vil: { en: "Villarreal", ar: "فياريال", es: "Villarreal", fr: "Villarreal", de: "Villarreal", pt: "Villarreal" },
  bet: { en: "Real Betis", ar: "ريال بيتيس", es: "Real Betis", fr: "Real Betis", de: "Real Betis", pt: "Real Betis" },
  sev: { en: "Sevilla", ar: "إشبيلية", es: "Sevilla", fr: "Séville", de: "Sevilla", pt: "Sevilha" },
  atb: { en: "Athletic Bilbao", ar: "أتلتيك بيلباو", es: "Athletic Club", fr: "Athletic Bilbao", de: "Athletic Bilbao", pt: "Athletic Bilbao" },

  // England
  liv: { en: "Liverpool", ar: "ليفربول", es: "Liverpool", fr: "Liverpool", de: "Liverpool", pt: "Liverpool" },
  mci: { en: "Manchester City", ar: "مانشستر سيتي", es: "Manchester City", fr: "Manchester City", de: "Manchester City", pt: "Manchester City" },
  mun: { en: "Manchester United", ar: "مانشستر يونايتد", es: "Manchester United", fr: "Manchester United", de: "Manchester United", pt: "Manchester United" },
  che: { en: "Chelsea", ar: "تشيلسي", es: "Chelsea", fr: "Chelsea", de: "Chelsea", pt: "Chelsea" },
  ars: { en: "Arsenal", ar: "آرسنال", es: "Arsenal", fr: "Arsenal", de: "Arsenal", pt: "Arsenal" },
  tot: { en: "Tottenham Hotspur", ar: "توتنهام هوتسبير", es: "Tottenham Hotspur", fr: "Tottenham Hotspur", de: "Tottenham Hotspur", pt: "Tottenham Hotspur" },
  new: { en: "Newcastle United", ar: "نيوكاسل يونايتد", es: "Newcastle United", fr: "Newcastle United", de: "Newcastle United", pt: "Newcastle United" },
  avl: { en: "Aston Villa", ar: "أستون فيلا", es: "Aston Villa", fr: "Aston Villa", de: "Aston Villa", pt: "Aston Villa" },
  whu: { en: "West Ham United", ar: "وست هام يونايتد", es: "West Ham United", fr: "West Ham United", de: "West Ham United", pt: "West Ham United" },
  bha: { en: "Brighton", ar: "برايتون", es: "Brighton", fr: "Brighton", de: "Brighton", pt: "Brighton" },
  nfo: { en: "Nottingham Forest", ar: "نوتنغهام فورست", es: "Nottingham Forest", fr: "Nottingham Forest", de: "Nottingham Forest", pt: "Nottingham Forest" },
  ful: { en: "Fulham", ar: "فولهام", es: "Fulham", fr: "Fulham", de: "Fulham", pt: "Fulham" },
  wol: { en: "Wolverhampton", ar: "وولفرهامبتون", es: "Wolverhampton", fr: "Wolverhampton", de: "Wolverhampton", pt: "Wolverhampton" },
  eve: { en: "Everton", ar: "إيفرتون", es: "Everton", fr: "Everton", de: "Everton", pt: "Everton" },
  cry: { en: "Crystal Palace", ar: "كريستال بالاس", es: "Crystal Palace", fr: "Crystal Palace", de: "Crystal Palace", pt: "Crystal Palace" },
  bre: { en: "Brentford", ar: "برنتفورد", es: "Brentford", fr: "Brentford", de: "Brentford", pt: "Brentford" },
  bou: { en: "Bournemouth", ar: "بورنموث", es: "Bournemouth", fr: "Bournemouth", de: "Bournemouth", pt: "Bournemouth" },
  lee: { en: "Leeds United", ar: "ليدز يونايتد", es: "Leeds United", fr: "Leeds United", de: "Leeds United", pt: "Leeds United" },
  sun: { en: "Sunderland", ar: "سندرلاند", es: "Sunderland", fr: "Sunderland", de: "Sunderland", pt: "Sunderland" },
  lei: { en: "Leicester City", ar: "ليستر سيتي", es: "Leicester City", fr: "Leicester City", de: "Leicester City", pt: "Leicester City" },
  ips: { en: "Ipswich Town", ar: "إيبسويتش تاون", es: "Ipswich Town", fr: "Ipswich Town", de: "Ipswich Town", pt: "Ipswich Town" },
  sou: { en: "Southampton", ar: "ساوثهامبتون", es: "Southampton", fr: "Southampton", de: "Southampton", pt: "Southampton" },
  bur: { en: "Burnley", ar: "بيرنلي", es: "Burnley", fr: "Burnley", de: "Burnley", pt: "Burnley" },

  // Spain — remaining
  rea: { en: "Real Valladolid", ar: "بلد الوليد", es: "Real Valladolid", fr: "Real Valladolid", de: "Real Valladolid", pt: "Real Valladolid" },
  val: { en: "Valencia", ar: "فالنسيا", es: "Valencia", fr: "Valence", de: "Valencia", pt: "Valência" },
  cel: { en: "Celta Vigo", ar: "سيلتا فيغو", es: "Celta de Vigo", fr: "Celta Vigo", de: "Celta Vigo", pt: "Celta de Vigo" },
  get: { en: "Getafe", ar: "خيتافي", es: "Getafe", fr: "Getafe", de: "Getafe", pt: "Getafe" },
  osa: { en: "Osasuna", ar: "أوساسونا", es: "Osasuna", fr: "Osasuna", de: "Osasuna", pt: "Osasuna" },
  gir: { en: "Girona", ar: "جيرونا", es: "Girona", fr: "Gérone", de: "Girona", pt: "Girona" },
  ray: { en: "Rayo Vallecano", ar: "رايو فاييكانو", es: "Rayo Vallecano", fr: "Rayo Vallecano", de: "Rayo Vallecano", pt: "Rayo Vallecano" },
  rbs: { en: "Real Betis", ar: "ريال بيتيس", es: "Real Betis", fr: "Real Betis", de: "Real Betis", pt: "Real Betis" },
  mal: { en: "Mallorca", ar: "مايوركا", es: "Mallorca", fr: "Majorque", de: "Mallorca", pt: "Maiorca" },
  rde: { en: "Espanyol", ar: "إسبانيول", es: "Espanyol", fr: "Espanyol", de: "Espanyol", pt: "Espanyol" },
  ala: { en: "Alavés", ar: "ألافيس", es: "Alavés", fr: "Alavés", de: "Alavés", pt: "Alavés" },
  leg: { en: "Leganés", ar: "ليغانيس", es: "Leganés", fr: "Leganés", de: "Leganés", pt: "Leganés" },
  las: { en: "Las Palmas", ar: "لاس بالماس", es: "Las Palmas", fr: "Las Palmas", de: "Las Palmas", pt: "Las Palmas" },
  lte: { en: "Levante", ar: "ليفانتي", es: "Levante", fr: "Levante", de: "Levante", pt: "Levante" },
  elc: { en: "Elche", ar: "إلتشي", es: "Elche", fr: "Elche", de: "Elche", pt: "Elche" },
  ovi: { en: "Real Oviedo", ar: "ريال أوفييدو", es: "Real Oviedo", fr: "Real Oviedo", de: "Real Oviedo", pt: "Real Oviedo" },

  // Germany — remaining
  bay: { en: "Bayern Munich", ar: "بايرن ميونخ", es: "Bayern Múnich", fr: "Bayern Munich", de: "Bayern München", pt: "Bayern de Munique" },
  bvb: { en: "Borussia Dortmund", ar: "بوروسيا دورتموند", es: "Borussia Dortmund", fr: "Borussia Dortmund", de: "Borussia Dortmund", pt: "Borussia Dortmund" },
  rbl: { en: "RB Leipzig", ar: "آر بي لايبزيغ", es: "RB Leipzig", fr: "RB Leipzig", de: "RB Leipzig", pt: "RB Leipzig" },
  lev: { en: "Bayer Leverkusen", ar: "باير ليفركوزن", es: "Bayer Leverkusen", fr: "Bayer Leverkusen", de: "Bayer Leverkusen", pt: "Bayer Leverkusen" },
  sge: { en: "Eintracht Frankfurt", ar: "آينتراخت فرانكفورت", es: "Eintracht Frankfurt", fr: "Eintracht Francfort", de: "Eintracht Frankfurt", pt: "Eintracht Frankfurt" },
  fre: { en: "SC Freiburg", ar: "فرايبورغ", es: "SC Freiburg", fr: "SC Fribourg", de: "SC Freiburg", pt: "SC Freiburg" },
  stu: { en: "VfB Stuttgart", ar: "شتوتغارت", es: "VfB Stuttgart", fr: "VfB Stuttgart", de: "VfB Stuttgart", pt: "VfB Stuttgart" },
  wob: { en: "VfL Wolfsburg", ar: "فولفسبورغ", es: "VfL Wolfsburg", fr: "VfL Wolfsbourg", de: "VfL Wolfsburg", pt: "VfL Wolfsburg" },
  bmg: { en: "Borussia M'gladbach", ar: "بوروسيا مونشنغلادباخ", es: "Borussia M'gladbach", fr: "Borussia M'gladbach", de: "Borussia Mönchengladbach", pt: "Borussia M'gladbach" },
  tsg: { en: "TSG Hoffenheim", ar: "هوفنهايم", es: "TSG Hoffenheim", fr: "TSG Hoffenheim", de: "TSG Hoffenheim", pt: "TSG Hoffenheim" },
  m05: { en: "Mainz 05", ar: "ماينتس", es: "Mainz 05", fr: "Mayence", de: "Mainz 05", pt: "Mainz 05" },
  aue: { en: "Union Berlin", ar: "أونيون برلين", es: "Union Berlin", fr: "Union Berlin", de: "Union Berlin", pt: "Union Berlin" },
  her: { en: "Hertha BSC", ar: "هيرتا برلين", es: "Hertha BSC", fr: "Hertha Berlin", de: "Hertha BSC", pt: "Hertha BSC" },
  svw: { en: "Werder Bremen", ar: "فيردر بريمن", es: "Werder Bremen", fr: "Werder Brême", de: "Werder Bremen", pt: "Werder Bremen" },
  fca: { en: "FC Augsburg", ar: "أوغسبورغ", es: "FC Augsburg", fr: "FC Augsbourg", de: "FC Augsburg", pt: "FC Augsburg" },
  boc: { en: "VfL Bochum", ar: "بوخوم", es: "VfL Bochum", fr: "VfL Bochum", de: "VfL Bochum", pt: "VfL Bochum" },
  d98: { en: "Darmstadt 98", ar: "دارمشتات", es: "Darmstadt 98", fr: "Darmstadt 98", de: "Darmstadt 98", pt: "Darmstadt 98" },
  sch: { en: "FC Schalke 04", ar: "شالكه", es: "FC Schalke 04", fr: "FC Schalke 04", de: "FC Schalke 04", pt: "FC Schalke 04" },
  koe: { en: "FC Köln", ar: "كولن", es: "FC Colonia", fr: "FC Cologne", de: "1. FC Köln", pt: "FC Colónia" },
  hei: { en: "FC Heidenheim", ar: "هايدنهايم", es: "FC Heidenheim", fr: "FC Heidenheim", de: "1. FC Heidenheim", pt: "FC Heidenheim" },
  hol: { en: "Holstein Kiel", ar: "هولشتاين كيل", es: "Holstein Kiel", fr: "Holstein Kiel", de: "Holstein Kiel", pt: "Holstein Kiel" },
  stp: { en: "FC St. Pauli", ar: "سانت باولي", es: "FC St. Pauli", fr: "FC St. Pauli", de: "FC St. Pauli", pt: "FC St. Pauli" },
  hsv: { en: "Hamburger SV", ar: "هامبورغ", es: "Hamburgo SV", fr: "Hambourg SV", de: "Hamburger SV", pt: "Hamburgo" },

  // Italy — remaining
  juv: { en: "Juventus", ar: "يوفنتوس", es: "Juventus", fr: "Juventus", de: "Juventus", pt: "Juventus" },
  int: { en: "Inter Milan", ar: "إنتر ميلان", es: "Inter de Milán", fr: "Inter Milan", de: "Inter Mailand", pt: "Inter de Milão" },
  mil: { en: "AC Milan", ar: "إيه سي ميلان", es: "AC Milan", fr: "AC Milan", de: "AC Mailand", pt: "AC Milan" },
  nap: { en: "Napoli", ar: "نابولي", es: "Nápoles", fr: "Naples", de: "Neapel", pt: "Nápoles" },
  rom: { en: "AS Roma", ar: "أي أس روما", es: "AS Roma", fr: "AS Roma", de: "AS Rom", pt: "AS Roma" },
  laz: { en: "Lazio", ar: "لاتسيو", es: "Lazio", fr: "Lazio", de: "Lazio", pt: "Lazio" },
  ata: { en: "Atalanta", ar: "أتالانتا", es: "Atalanta", fr: "Atalanta", de: "Atalanta", pt: "Atalanta" },
  fio: { en: "Fiorentina", ar: "فيورنتينا", es: "Fiorentina", fr: "Fiorentina", de: "Fiorentina", pt: "Fiorentina" },
  tor: { en: "Torino", ar: "تورينو", es: "Torino", fr: "Turin", de: "Turin", pt: "Torino" },
  gen: { en: "Genoa", ar: "جنوى", es: "Génova", fr: "Gênes", de: "Genua", pt: "Génova" },
  bol: { en: "Bologna", ar: "بولونيا", es: "Bolonia", fr: "Bologne", de: "Bologna", pt: "Bolonha" },
  mnz: { en: "Monza", ar: "مونزا", es: "Monza", fr: "Monza", de: "Monza", pt: "Monza" },
  emp: { en: "Empoli", ar: "إمبولي", es: "Empoli", fr: "Empoli", de: "Empoli", pt: "Empoli" },
  cag: { en: "Cagliari", ar: "كالياري", es: "Cagliari", fr: "Cagliari", de: "Cagliari", pt: "Cagliari" },
  udi: { en: "Udinese", ar: "أودينيزي", es: "Udinese", fr: "Udinese", de: "Udinese", pt: "Udinese" },
  sas: { en: "Sassuolo", ar: "ساسولو", es: "Sassuolo", fr: "Sassuolo", de: "Sassuolo", pt: "Sassuolo" },
  lec: { en: "Lecce", ar: "ليتشي", es: "Lecce", fr: "Lecce", de: "Lecce", pt: "Lecce" },
  prm: { en: "Parma", ar: "بارما", es: "Parma", fr: "Parme", de: "Parma", pt: "Parma" },
  com: { en: "Como 1907", ar: "كومو", es: "Como 1907", fr: "Côme", de: "Como 1907", pt: "Como 1907" },
  ver: { en: "Hellas Verona", ar: "هيلاس فيرونا", es: "Hellas Verona", fr: "Hellas Vérone", de: "Hellas Verona", pt: "Hellas Verona" },
  ven: { en: "Venezia", ar: "فينيسيا", es: "Venezia", fr: "Venise", de: "Venedig", pt: "Venezia" },
  cre: { en: "Cremonese", ar: "كريمونيزي", es: "Cremonese", fr: "Cremonese", de: "Cremonese", pt: "Cremonese" },

  // France — remaining
  psg: { en: "Paris Saint-Germain", ar: "باريس سان جيرمان", es: "Paris Saint-Germain", fr: "Paris Saint-Germain", de: "Paris Saint-Germain", pt: "Paris Saint-Germain" },
  oly: { en: "Olympique Lyonnais", ar: "أولمبيك ليون", es: "Olympique de Lyon", fr: "Olympique Lyonnais", de: "Olympique Lyon", pt: "Olympique de Lyon" },
  om: { en: "Olympique Marseille", ar: "أولمبيك مارسيليا", es: "Olympique de Marsella", fr: "Olympique de Marseille", de: "Olympique Marseille", pt: "Olympique de Marselha" },
  mon: { en: "AS Monaco", ar: "أي أس موناكو", es: "AS Mónaco", fr: "AS Monaco", de: "AS Monaco", pt: "AS Mónaco" },
  lil: { en: "Lille", ar: "ليل", es: "Lille", fr: "Lille", de: "Lille", pt: "Lille" },
  ren: { en: "Stade Rennais", ar: "رين", es: "Stade Rennais", fr: "Stade Rennais", de: "Stade Rennes", pt: "Stade Rennais" },
  len: { en: "RC Lens", ar: "لانس", es: "RC Lens", fr: "RC Lens", de: "RC Lens", pt: "RC Lens" },
  nic: { en: "Nice", ar: "نيس", es: "Niza", fr: "OGC Nice", de: "Nizza", pt: "Nice" },
  str: { en: "Strasbourg", ar: "ستراسبورغ", es: "Estrasburgo", fr: "RC Strasbourg", de: "Straßburg", pt: "Estrasburgo" },
  nan: { en: "FC Nantes", ar: "نانت", es: "FC Nantes", fr: "FC Nantes", de: "FC Nantes", pt: "FC Nantes" },
  tou: { en: "Toulouse", ar: "تولوز", es: "Toulouse", fr: "Toulouse FC", de: "Toulouse", pt: "Toulouse" },
  rms: { en: "Stade de Reims", ar: "ريمس", es: "Stade de Reims", fr: "Stade de Reims", de: "Stade Reims", pt: "Stade de Reims" },
  aux: { en: "AJ Auxerre", ar: "أوكسير", es: "AJ Auxerre", fr: "AJ Auxerre", de: "AJ Auxerre", pt: "AJ Auxerre" },
  ste: { en: "Saint-Étienne", ar: "سانت إتيان", es: "Saint-Étienne", fr: "AS Saint-Étienne", de: "Saint-Étienne", pt: "Saint-Étienne" },
  ang: { en: "Angers", ar: "أنجيه", es: "Angers", fr: "Angers SCO", de: "Angers", pt: "Angers" },
  mtp: { en: "Montpellier", ar: "مونبلييه", es: "Montpellier", fr: "Montpellier HSC", de: "Montpellier", pt: "Montpellier" },
  hav: { en: "Le Havre", ar: "لوهافر", es: "Le Havre", fr: "Le Havre AC", de: "Le Havre", pt: "Le Havre" },
  bre2: { en: "Stade Brestois", ar: "بريست", es: "Stade Brestois", fr: "Stade Brestois", de: "Stade Brest", pt: "Stade Brestois" },
  mtz: { en: "FC Metz", ar: "ميتز", es: "FC Metz", fr: "FC Metz", de: "FC Metz", pt: "FC Metz" },
  fcl: { en: "FC Lorient", ar: "لوريان", es: "FC Lorient", fr: "FC Lorient", de: "FC Lorient", pt: "FC Lorient" },

  // Portugal
  ben: { en: "Benfica", ar: "بنفيكا", es: "Benfica", fr: "Benfica", de: "Benfica", pt: "Benfica" },
  fcp: { en: "FC Porto", ar: "بورتو", es: "FC Oporto", fr: "FC Porto", de: "FC Porto", pt: "FC Porto" },
  spo: { en: "Sporting CP", ar: "سبورتينغ لشبونة", es: "Sporting CP", fr: "Sporting CP", de: "Sporting Lissabon", pt: "Sporting CP" },

  // Netherlands
  aja: { en: "Ajax", ar: "أياكس", es: "Ajax", fr: "Ajax", de: "Ajax", pt: "Ajax" },
  psv: { en: "PSV Eindhoven", ar: "بي إس في آيندهوفن", es: "PSV Eindhoven", fr: "PSV Eindhoven", de: "PSV Eindhoven", pt: "PSV Eindhoven" },
  fey: { en: "Feyenoord", ar: "فاينورد", es: "Feyenoord", fr: "Feyenoord", de: "Feyenoord", pt: "Feyenoord" },

  // Additional clubs (cups / promoted / Serie B / Ligue 2 etc.)
  pfc: { en: "Paris FC", ar: "باريس إف سي", es: "Paris FC", fr: "Paris FC", de: "Paris FC", pt: "Paris FC" },
  pis: { en: "AC Pisa", ar: "بيزا", es: "AC Pisa", fr: "AC Pise", de: "AC Pisa", pt: "AC Pisa" },
  fcm: { en: "FC Metz", ar: "ميتز", es: "FC Metz", fr: "FC Metz", de: "FC Metz", pt: "FC Metz" },
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
// Reverse lookup: English name → key (built once, lazy)
let _nameToKey: Map<string, string> | null = null;
// API name aliases: football-data.org sometimes uses longer/different names
const API_NAME_ALIASES: Record<string, string> = {
  "wolverhampton wanderers fc": "wol",
  "wolverhampton wanderers": "wol",
  "west ham united fc": "whu",
  "west ham united": "whu",
  "west ham": "whu",
  "tottenham hotspur fc": "tot",
  "tottenham hotspur": "tot",
  "nottingham forest fc": "nfo",
  "nottingham forest": "nfo",
  "crystal palace fc": "cry",
  "afc bournemouth": "bou",
  "athletic club": "atb",
  "atletico de madrid": "atm",
  "atlético de madrid": "atm",
  "club atlético de madrid": "atm",
  "real sociedad de fútbol": "rso",
  "real betis balompié": "bet",
  "real betis": "bet",
  "rcd espanyol de barcelona": "rde",
  "borussia dortmund": "bvb",
  "bayer 04 leverkusen": "lev",
  "bayer leverkusen": "lev",
  "rb leipzig": "rbl",
  "eintracht frankfurt": "sge",
  "sc freiburg": "fre",
  "vfb stuttgart": "stu",
  "vfl wolfsburg": "wob",
  "borussia mönchengladbach": "bmg",
  "tsg 1899 hoffenheim": "tsg",
  "hoffenheim": "tsg",
  "tsg hoffenheim": "tsg",
  "1. fsv mainz 05": "m05",
  "1. fc union berlin": "aue",
  "sv werder bremen": "svw",
  "werder bremen": "svw",
  "fc augsburg": "fca",
  "augsburg": "fca",
  "1. fc heidenheim 1846": "hei",
  "holstein kiel": "hol",
  "fc st. pauli 1910": "stp",
  "fc st. pauli": "stp",
  "fc internazionale milano": "int",
  "inter milan": "int",
  "ac milan": "mil",
  "ssc napoli": "nap",
  "as roma": "rom",
  "roma": "rom",
  "ss lazio": "laz",
  "atalanta bc": "ata",
  "acf fiorentina": "fio",
  "torino fc": "tor",
  "genoa cfc": "gen",
  "bologna fc 1909": "bol",
  "us lecce": "lec",
  "parma calcio 1913": "prm",
  "us sassuolo calcio": "sas",
  "hellas verona fc": "ver",
  "olympique de marseille": "om",
  "olympique marseille": "om",
  "marseille": "om",
  "as monaco fc": "mon",
  "as monaco": "mon",
  "monaco": "mon",
  "ogc nice": "nic",
  "rc strasbourg alsace": "str",
  "stade brestois 29": "bre2",
  "sl benfica": "ben",
  "fc porto": "fcp",
  "sporting clube de portugal": "spo",
  "sporting cp": "spo",
  "afc ajax": "aja",

  // ── TLA aliases (football-data.org TLA → our TEAM_NAMES key) ──────────────
  // Only non-colliding TLAs — colliding ones (PAR, ESP, MAR, BRE, AJA, LEV)
  // must be resolved via full team name instead.
  // England
  "not": "nfo",           // Nottingham Forest
  "bur": "bur",           // Burnley
  // Spain
  "atl": "atm",           // Atlético Madrid
  "ath": "atb",           // Athletic Bilbao
  "elc": "elc",           // Elche
  "ovi": "ovi",           // Real Oviedo
  // Germany
  "vfb": "stu",           // VfB Stuttgart
  "b04": "lev",           // Bayer 04 Leverkusen
  "scf": "fre",           // SC Freiburg
  "unb": "aue",           // 1. FC Union Berlin
  "hsv": "hsv",           // Hamburger SV
  // Italy
  "acm": "mil",           // AC Milan
  "hve": "ver",           // Hellas Verona
  "usl": "lec",           // US Lecce
  "cre": "cre",           // US Cremonese
  // France
  "rcl": "len",           // RC Lens
  "asm": "mon",           // AS Monaco
  "lyo": "oly",           // Olympique Lyonnais
  "hac": "hav",           // Le Havre AC
  "fcl": "fcl",           // FC Lorient (if promoted)

  // ── Full API name aliases for collision-prone teams ───────────────────────
  "fc bayern münchen": "bay",
  "fc bayern munchen": "bay",
  "bayern münchen": "bay",
  "fc barcelona": "bar",
  "levante ud": "lte",
  "rcd espanyol": "rde",
  "espanyol": "rde",
  "hamburger sv": "hsv",
  "burnley fc": "bur",
  "burnley": "bur",
  "elche cf": "elc",
  "elche": "elc",
  "real oviedo": "ovi",
  "us cremonese": "cre",
  "cremonese": "cre",
  "fc metz": "mtz",
  "metz": "mtz",
  "olympique lyonnais": "oly",
  "olympique de marseille ": "om",
  "stade de reims": "rms",
  "aj auxerre": "aux",
  "le havre ac": "hav",
  "rc lens": "len",
  "losc lille": "lil",
  "lille osc": "lil",
  "vfb stuttgart 1893": "stu",
  "1. fc heidenheim": "hei",
  "union berlin": "aue",
  "fc union berlin": "aue",
  "valencia cf": "val",
  "valencia": "val",
  "real valladolid cf": "rea",
};

function getNameToKey(): Map<string, string> {
  if (!_nameToKey) {
    _nameToKey = new Map();
    for (const [key, val] of Object.entries(TEAM_NAMES)) {
      if (val.en) _nameToKey.set(val.en.toLowerCase(), key);
    }
    // Add API aliases
    for (const [alias, key] of Object.entries(API_NAME_ALIASES)) {
      _nameToKey.set(alias, key);
    }
  }
  return _nameToKey;
}

export function teamName(idOrName: string, lang: LangCode): string {
  const id = idOrName.toLowerCase();
  const entry = TEAM_NAMES[id];
  if (entry) return entry[lang] ?? entry.en ?? idOrName;
  // Try reverse lookup by English name (handles API full names like "Olympique Marseille")
  const keyByName = getNameToKey().get(id);
  if (keyByName) {
    const e = TEAM_NAMES[keyByName];
    if (e) return e[lang] ?? e.en ?? idOrName;
  }
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
