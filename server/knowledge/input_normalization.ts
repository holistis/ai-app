/**
 * INPUT NORMALIZATION LAYER
 *
 * Laag die ruwe patiëntinput verwerkt vóórdat de correlatie engine wordt aangeroepen.
 *
 * Pipeline:
 *   raw input (strings)
 *     → 1. SYNONYM MAPPING    (variaties → standaard termen)
 *     → 2. SYMPTOM CLUSTERING (standaard termen → clusters)
 *     → 3. CONFIDENCE SCORING (clusters → gewogen scores)
 *     → output: NormalizedInput (klaar voor correlatie engine)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type StandardSymptom =
  | "vermoeidheid"
  | "slaapproblemen"
  | "chronische stress"
  | "buikklachten"
  | "brain fog"
  | "stemmingswisselingen"
  | "angst"
  | "gewichtstoename"
  | "gewichtsverlies"
  | "ontsteking"
  | "gewrichtspijn"
  | "spierpijn"
  | "spiertrekkingen"
  | "hoofdpijn"
  | "haaruitval"
  | "huidproblemen"
  | "kouwelijkheid"
  | "hartkloppingen"
  | "constipatie"
  | "diarree"
  | "opgeblazen gevoel"
  | "misselijkheid"
  | "tintelingen"
  | "concentratieproblemen"
  | "geheugenklachten"
  | "depressieve gevoelens"
  | "prikkelbaarheid"
  | "suikerdrang"
  | "zoutdrang"
  | "lage weerstand"
  | "frequente infecties"
  | "trage genezing"
  | "zwelling"
  | "weinig beweging"
  | "voedselovergevoeligheden"
  | "droge huid"
  | "kortademigheid"
  | "energiepiek s-avonds"
  | "middagdip"
  | "buikvet";

export type SymptomCluster =
  | "vermoeidheid_cluster"
  | "darm_cluster"
  | "hormonale_cluster"
  | "zenuwstelsel_cluster"
  | "cognitief_cluster"
  | "immuun_cluster"
  | "mineraal_cluster"
  | "lymfe_cluster";



export interface ClusterScore {
  cluster: SymptomCluster;
  score: number;        // 0.0 – 1.0 (gewogen gemiddelde van symptoom confidences in cluster)
  symptoms: StandardSymptom[];
}

export interface NormalizedSymptom {
  standard: StandardSymptom;
  raw: string;          // originele invoer van patiënt
  confidence: number;   // 0.0 – 1.0
  confidence_tag?: 'high' | 'low';  // 'high' (>= threshold) of 'low' (< threshold)
}

export interface NormalizedInput {
  symptoms: NormalizedSymptom[];  // ALLE symptomen (high + low confidence)
  high_confidence_symptoms: NormalizedSymptom[];  // gefilterde subset (confidence >= threshold)
  low_confidence_symptoms: NormalizedSymptom[];   // ruwe signalen (confidence < threshold)
  clusters: ClusterScore[];       // clusters gebaseerd op high_confidence_symptoms
  total_confidence: number;       // gemiddelde confidence over high_confidence_symptoms
  unrecognized: string[];         // input die niet gemapt kon worden
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SYNONYM MAP
//    Sleutel: lowercase variant die in patiëntinput kan voorkomen (NL + EN)
//    Waarde: standaard term uit StandardSymptom
// ─────────────────────────────────────────────────────────────────────────────

const SYNONYM_MAP: Record<string, StandardSymptom> = {
  // vermoeidheid
  "moe": "vermoeidheid",
  "vermoeid": "vermoeidheid",
  "uitgeput": "vermoeidheid",
  "geen energie": "vermoeidheid",
  "energieloos": "vermoeidheid",
  "altijd moe": "vermoeidheid",
  "chronische vermoeidheid": "vermoeidheid",
  "fatigue": "vermoeidheid",
  "tired": "vermoeidheid",
  "exhausted": "vermoeidheid",
  "uitputting": "vermoeidheid",
  "laag energieniveau": "vermoeidheid",

  // slaapproblemen
  "slechte slaap": "slaapproblemen",
  "niet goed slapen": "slaapproblemen",
  "slecht slapen": "slaapproblemen",
  "insomnia": "slaapproblemen",
  "slapeloosheid": "slaapproblemen",
  "moeite met inslapen": "slaapproblemen",
  "wakker worden s nachts": "slaapproblemen",
  "onrustige slaap": "slaapproblemen",
  "poor sleep": "slaapproblemen",
  "niet uitgerust wakker": "slaapproblemen",

  // chronische stress
  "stress": "chronische stress",
  "veel stress": "chronische stress",
  "langdurige stress": "chronische stress",
  "chronisch gestrest": "chronische stress",
  "overspannen": "chronische stress",
  "overbelast": "chronische stress",
  "burnout": "chronische stress",
  "burn-out": "chronische stress",
  "constant gestrest": "chronische stress",

  // buikklachten
  "buikpijn": "buikklachten",
  "maagpijn": "buikklachten",
  "darmklachten": "buikklachten",
  "spijsverteringsproblemen": "buikklachten",
  "maagklachten": "buikklachten",
  "prikkelbare darm": "buikklachten",
  "ibs": "buikklachten",
  "irritable bowel": "buikklachten",
  "gut issues": "buikklachten",
  "stomach pain": "buikklachten",

  // brain fog
  "wazig hoofd": "brain fog",
  "hoofd in de mist": "brain fog",
  "niet helder kunnen denken": "brain fog",
  "mentale mist": "brain fog",
  "foggy brain": "brain fog",
  "mental fog": "brain fog",
  "hersenmist": "brain fog",
  "wazig denken": "brain fog",

  // stemmingswisselingen
  "wisselende stemming": "stemmingswisselingen",
  "stemmingswisseling": "stemmingswisselingen",
  "emotioneel labiel": "stemmingswisselingen",
  "humeurwisselingen": "stemmingswisselingen",
  "mood swings": "stemmingswisselingen",
  "snel van stemming wisselen": "stemmingswisselingen",

  // angst
  "angstig": "angst",
  "angstgevoelens": "angst",
  "paniekaanvallen": "angst",
  "piekeren": "angst",
  "anxiety": "angst",
  "nerveus": "angst",
  "zenuwachtig": "angst",
  "onrustig gevoel": "angst",

  // gewichtstoename
  "dikker worden": "gewichtstoename",
  "aankomen": "gewichtstoename",
  "gewicht aankomen": "gewichtstoename",
  "weight gain": "gewichtstoename",
  "zwaarder worden": "gewichtstoename",

  // gewichtsverlies
  "afvallen": "gewichtsverlies",
  "gewicht verliezen": "gewichtsverlies",
  "weight loss": "gewichtsverlies",
  "dunner worden": "gewichtsverlies",

  // ontsteking
  "ontstoken": "ontsteking",
  "inflammation": "ontsteking",
  "chronische ontsteking": "ontsteking",
  "roodheid": "ontsteking",
  "zwelling en pijn": "ontsteking",

  // gewrichtspijn
  "pijnlijke gewrichten": "gewrichtspijn",
  "stijve gewrichten": "gewrichtspijn",
  "joint pain": "gewrichtspijn",
  "artritis": "gewrichtspijn",
  "reuma": "gewrichtspijn",
  "gewrichten doen pijn": "gewrichtspijn",

  // spierpijn
  "spierpijnen": "spierpijn",
  "pijnlijke spieren": "spierpijn",
  "muscle pain": "spierpijn",
  "fibromyalgie": "spierpijn",
  "spierstijfheid": "spierpijn",

  // spiertrekkingen
  "spierkramp": "spiertrekkingen",
  "krampen": "spiertrekkingen",
  "muscle cramps": "spiertrekkingen",
  "restless legs": "spiertrekkingen",
  "onrustige benen": "spiertrekkingen",
  "trillen": "spiertrekkingen",

  // hoofdpijn
  "migraine": "hoofdpijn",
  "headache": "hoofdpijn",
  "pijn in het hoofd": "hoofdpijn",
  "spanningshoofdpijn": "hoofdpijn",

  // haaruitval
  "haar verlies": "haaruitval",
  "hair loss": "haaruitval",
  "kaalheid": "haaruitval",
  "dunner wordend haar": "haaruitval",

  // huidproblemen
  "huiduitslag": "huidproblemen",
  "eczeem": "huidproblemen",
  "psoriasis": "huidproblemen",
  "acne": "huidproblemen",
  "skin problems": "huidproblemen",
  "jeuk": "huidproblemen",
  "droge huid": "droge huid",

  // kouwelijkheid
  "het altijd koud hebben": "kouwelijkheid",
  "snel koud": "kouwelijkheid",
  "cold intolerance": "kouwelijkheid",
  "koude handen en voeten": "kouwelijkheid",

  // hartkloppingen
  "bonkend hart": "hartkloppingen",
  "palpitations": "hartkloppingen",
  "hart slaat over": "hartkloppingen",
  "snelle hartslag": "hartkloppingen",

  // constipatie
  "verstopping": "constipatie",
  "moeilijke stoelgang": "constipatie",
  "constipation": "constipatie",
  "niet kunnen poepen": "constipatie",

  // diarree
  "dunne ontlasting": "diarree",
  "diarrhea": "diarree",
  "waterige ontlasting": "diarree",
  "losse ontlasting": "diarree",

  // opgeblazen gevoel
  "opgeblazen": "opgeblazen gevoel",
  "bloating": "opgeblazen gevoel",
  "vol gevoel": "opgeblazen gevoel",
  "buik opgeblazen": "opgeblazen gevoel",
  "winderigheid": "opgeblazen gevoel",
  "gas": "opgeblazen gevoel",

  // misselijkheid
  "misselijk": "misselijkheid",
  "nausea": "misselijkheid",
  "walging": "misselijkheid",

  // tintelingen
  "tintelende handen": "tintelingen",
  "tintelende voeten": "tintelingen",
  "gevoelloosheid": "tintelingen",
  "numbness": "tintelingen",
  "tingling": "tintelingen",
  "doof gevoel": "tintelingen",

  // concentratieproblemen
  "moeite met concentreren": "concentratieproblemen",
  "concentration problems": "concentratieproblemen",
  "afgeleid": "concentratieproblemen",
  "kan me niet focussen": "concentratieproblemen",
  "adhd": "concentratieproblemen",

  // geheugenklachten
  "vergeetachtig": "geheugenklachten",
  "slecht geheugen": "geheugenklachten",
  "memory problems": "geheugenklachten",
  "dingen vergeten": "geheugenklachten",

  // depressieve gevoelens
  "depressief": "depressieve gevoelens",
  "somber": "depressieve gevoelens",
  "depression": "depressieve gevoelens",
  "neerslachtig": "depressieve gevoelens",
  "geen zin in dingen": "depressieve gevoelens",
  "leeg gevoel": "depressieve gevoelens",

  // prikkelbaarheid
  "prikkelbaar": "prikkelbaarheid",
  "snel geïrriteerd": "prikkelbaarheid",
  "irritable": "prikkelbaarheid",
  "kort lontje": "prikkelbaarheid",

  // suikerdrang
  "trek in suiker": "suikerdrang",
  "zoetigheid willen": "suikerdrang",
  "sugar cravings": "suikerdrang",
  "behoefte aan snoep": "suikerdrang",
  "chocolade drang": "suikerdrang",

  // zoutdrang
  "trek in zout": "zoutdrang",
  "salt cravings": "zoutdrang",
  "behoefte aan chips": "zoutdrang",

  // lage weerstand
  "snel ziek": "lage weerstand",
  "low immunity": "lage weerstand",
  "zwak immuunsysteem": "lage weerstand",
  "vatbaar voor infecties": "lage weerstand",

  // frequente infecties
  "vaak verkouden": "frequente infecties",
  "frequent infections": "frequente infecties",
  "steeds ziek": "frequente infecties",
  "herpes": "frequente infecties",

  // trage genezing
  "wonden genezen langzaam": "trage genezing",
  "slow healing": "trage genezing",
  "lang ziek blijven": "trage genezing",

  // zwelling
  "gezwollen": "zwelling",
  "oedeem": "zwelling",
  "swelling": "zwelling",
  "dikke enkels": "zwelling",

  // weinig beweging
  "zittend werk": "weinig beweging",
  "sedentair": "weinig beweging",
  "weinig sport": "weinig beweging",
  "nauwelijks bewegen": "weinig beweging",
  "sedentary": "weinig beweging",

  // voedselovergevoeligheden
  "voedselintolerantie": "voedselovergevoeligheden",
  "food sensitivity": "voedselovergevoeligheden",
  "allergisch voor voeding": "voedselovergevoeligheden",
  "gluten intolerantie": "voedselovergevoeligheden",
  "lactose intolerantie": "voedselovergevoeligheden",

  // kortademigheid
  "buiten adem": "kortademigheid",
  "shortness of breath": "kortademigheid",
  "moeite met ademen": "kortademigheid",
  "dyspnoe": "kortademigheid",

  // energiepiek s-avonds
  "s avonds pas energie": "energiepiek s-avonds",
  "nachtmens": "energiepiek s-avonds",
  "energy at night": "energiepiek s-avonds",
  "actief s avonds": "energiepiek s-avonds",

  // middagdip
  "dip na de lunch": "middagdip",
  "afternoon slump": "middagdip",
  "moe na het eten": "middagdip",
  "slaperig na lunch": "middagdip",

  // buikvet
  "vet op de buik": "buikvet",
  "belly fat": "buikvet",
  "dikke buik": "buikvet",
  "visceraal vet": "buikvet",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. CLUSTER MAP
//    Welke standaard symptomen horen bij welk cluster
// ─────────────────────────────────────────────────────────────────────────────

const CLUSTER_MAP: Record<SymptomCluster, StandardSymptom[]> = {
  vermoeidheid_cluster: [
    "vermoeidheid", "slaapproblemen", "middagdip", "energiepiek s-avonds",
    "concentratieproblemen", "geheugenklachten",
  ],
  darm_cluster: [
    "buikklachten", "opgeblazen gevoel", "constipatie", "diarree",
    "misselijkheid", "voedselovergevoeligheden",
  ],
  hormonale_cluster: [
    "gewichtstoename", "gewichtsverlies", "suikerdrang", "zoutdrang",
    "kouwelijkheid", "haaruitval", "buikvet", "prikkelbaarheid",
  ],
  zenuwstelsel_cluster: [
    "chronische stress", "angst", "hartkloppingen", "spiertrekkingen",
    "tintelingen", "kortademigheid", "prikkelbaarheid",
  ],
  cognitief_cluster: [
    "brain fog", "stemmingswisselingen", "concentratieproblemen",
    "geheugenklachten", "depressieve gevoelens", "angst",
  ],
  immuun_cluster: [
    "lage weerstand", "frequente infecties", "trage genezing",
    "ontsteking", "huidproblemen",
  ],
  mineraal_cluster: [
    "spiertrekkingen", "spierpijn", "hoofdpijn", "constipatie",
    "slaapproblemen", "angst",
  ],
  lymfe_cluster: [
    "zwelling", "trage genezing", "weinig beweging", "ontsteking",
    "frequente infecties",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONFIDENCE RULES
//    Basisconfidence per symptoom + boosts op basis van context
// ─────────────────────────────────────────────────────────────────────────────

/** Basisconfidence: hoe duidelijk is dit symptoom als signaal? */
const BASE_CONFIDENCE: Partial<Record<StandardSymptom, number>> = {
  "vermoeidheid": 0.6,          // vaag, veel oorzaken
  "slaapproblemen": 0.65,
  "chronische stress": 0.75,    // specifiek
  "buikklachten": 0.65,
  "brain fog": 0.75,
  "stemmingswisselingen": 0.70,
  "angst": 0.70,
  "gewichtstoename": 0.65,
  "ontsteking": 0.70,
  "gewrichtspijn": 0.70,
  "spierpijn": 0.65,
  "spiertrekkingen": 0.80,      // specifiek signaal
  "hoofdpijn": 0.60,
  "haaruitval": 0.75,
  "kouwelijkheid": 0.75,
  "hartkloppingen": 0.80,
  "constipatie": 0.70,
  "diarree": 0.70,
  "opgeblazen gevoel": 0.70,
  "tintelingen": 0.85,          // zeer specifiek neurologisch signaal
  "concentratieproblemen": 0.65,
  "geheugenklachten": 0.70,
  "depressieve gevoelens": 0.70,
  "suikerdrang": 0.75,
  "lage weerstand": 0.65,
  "frequente infecties": 0.75,
  "trage genezing": 0.80,
  "zwelling": 0.75,
  "voedselovergevoeligheden": 0.80,
  "energiepiek s-avonds": 0.85, // zeer specifiek circadiaan signaal
  "middagdip": 0.70,
  "buikvet": 0.70,
};

const DEFAULT_CONFIDENCE = 0.60;

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stap 1: map een ruwe invoerstring naar een standaard symptoom.
 * Geeft null terug als geen match gevonden.
 */
function mapSynonym(raw: string): StandardSymptom | null {
  const normalized = raw.toLowerCase().trim();

  // exacte match
  if (normalized in SYNONYM_MAP) return SYNONYM_MAP[normalized];

  // gedeeltelijke match: controleer of een sleutel voorkomt in de invoer
  for (const [key, standard] of Object.entries(SYNONYM_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return standard;
    }
  }

  // directe match op standaard termen zelf
  const directMatch = normalized as StandardSymptom;
  if (Object.values(SYNONYM_MAP).includes(directMatch)) return directMatch;

  return null;
}

/**
 * Stap 2: bereken confidence voor een symptoom.
 * Boost als het symptoom meerdere keren voorkomt of samen met verwante symptomen.
 */
function calculateConfidence(
  symptom: StandardSymptom,
  allSymptoms: StandardSymptom[],
  occurrences: number
): number {
  const base = BASE_CONFIDENCE[symptom] ?? DEFAULT_CONFIDENCE;

  // boost voor herhaald voorkomen (max +0.15)
  const repetitionBoost = Math.min((occurrences - 1) * 0.05, 0.15);

  // boost als symptoom voorkomt samen met andere symptomen in hetzelfde cluster
  let clusterBoost = 0;
  for (const [, members] of Object.entries(CLUSTER_MAP)) {
    const clusterMembers = members as StandardSymptom[];
    if (clusterMembers.includes(symptom)) {
      const overlap = allSymptoms.filter(s => clusterMembers.includes(s) && s !== symptom).length;
      clusterBoost = Math.min(overlap * 0.05, 0.15);
      break;
    }
  }

  return Math.min(base + repetitionBoost + clusterBoost, 1.0);
}

/**
 * Stap 3: bereken cluster scores op basis van genormaliseerde symptomen.
 */
function calculateClusterScores(symptoms: NormalizedSymptom[]): ClusterScore[] {
  const scores: ClusterScore[] = [];

  for (const [cluster, members] of Object.entries(CLUSTER_MAP)) {
    const clusterMembers = members as StandardSymptom[];
    const matching = symptoms.filter(s => clusterMembers.includes(s.standard));

    if (matching.length === 0) continue;

    const avgConfidence = matching.reduce((sum, s) => sum + s.confidence, 0) / matching.length;

    scores.push({
      cluster: cluster as SymptomCluster,
      score: Math.round(avgConfidence * 100) / 100,
      symptoms: matching.map(s => s.standard),
    });
  }

  // sorteer op score (hoogste eerst)
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * HOOFD FUNCTIE: normaliseer een array van ruwe symptoomstrings.
 *
 * @param rawInputs - array van strings zoals patiënt ze invult
 * @returns NormalizedInput klaar voor de correlatie engine
 *
 * @example
 * const result = normalizeInput(["moe", "slechte slaap", "stress", "buikpijn"]);
 * // result.symptoms → [{standard: "vermoeidheid", confidence: 0.75}, ...]
 * // result.clusters → [{cluster: "vermoeidheid_cluster", score: 0.78}, ...]
 */
export function normalizeInput(rawInputs: string[]): NormalizedInput {
  const occurrenceMap = new Map<StandardSymptom, number>();
  const rawMap = new Map<StandardSymptom, string>();
  const unrecognized: string[] = [];

  // tel occurrences en sla raw op
  for (const raw of rawInputs) {
    const standard = mapSynonym(raw);
    if (standard) {
      occurrenceMap.set(standard, (occurrenceMap.get(standard) ?? 0) + 1);
      if (!rawMap.has(standard)) rawMap.set(standard, raw);
    } else {
      unrecognized.push(raw);
    }
  }

  const allStandard = Array.from(occurrenceMap.keys());

  // bereken confidence per symptoom
  const symptoms: NormalizedSymptom[] = allStandard.map(standard => ({
    standard,
    raw: rawMap.get(standard) ?? standard,
    confidence: calculateConfidence(standard, allStandard, occurrenceMap.get(standard) ?? 1),
  }));

  const clusters = calculateClusterScores(symptoms);

  const total_confidence =
    symptoms.length > 0
      ? Math.round((symptoms.reduce((sum, s) => sum + s.confidence, 0) / symptoms.length) * 100) / 100
      : 0;

  return {
    symptoms,  // ALLE symptomen (high + low)
    high_confidence_symptoms: symptoms,  // initially all; will be split by filterByConfidence
    low_confidence_symptoms: [],  // initially empty; will be populated by filterByConfidence
    clusters,
    total_confidence,
    unrecognized,
  };
}

/**
 * Hulpfunctie: extraheer alleen de standaard symptoomnamen uit NormalizedInput.
 * Gebruik dit om door te geven aan de correlatie engine.
 */
export function extractStandardSymptoms(input: NormalizedInput): StandardSymptom[] {
  return input.symptoms.map(s => s.standard);
}

/**
 * Hulpfunctie: tag symptomen als 'high' of 'low' confidence (GEEN verwijdering).
 * - high_confidence_symptoms: confidence >= threshold (voor correlatie engine)
 * - low_confidence_symptoms: confidence < threshold (ruwe signalen voor AI)
 * - symptoms: ALLE symptomen met confidence_tag
 */
export function filterByConfidence(
  input: NormalizedInput,
  threshold = 0.65
): NormalizedInput {
  const high = input.symptoms.filter(s => s.confidence >= threshold);
  const low = input.symptoms.filter(s => s.confidence < threshold);

  // Tag alle symptomen
  const taggedSymptoms = input.symptoms.map(s => ({
    ...s,
    confidence_tag: (s.confidence >= threshold ? 'high' : 'low') as 'high' | 'low',
  }));

  return {
    symptoms: taggedSymptoms,
    high_confidence_symptoms: high.map(s => ({ ...s, confidence_tag: 'high' as const })),
    low_confidence_symptoms: low.map(s => ({ ...s, confidence_tag: 'low' as const })),
    clusters: calculateClusterScores(high),
    total_confidence:
      high.length > 0
        ? Math.round((high.reduce((sum, s) => sum + s.confidence, 0) / high.length) * 100) / 100
        : 0,
    unrecognized: input.unrecognized,
  };
}
