/**
 * Knowledge Loader - AI Kennisbrein
 * 
 * Gestructureerde kennisbank gebaseerd op:
 * - Dr. Eric Berg (@Drberg)
 * - Barbara O'Neill (@realbarbaraoneillvideos)
 * - Dr. Perry Nickelston (@stopchasingpain)
 * 
 * Bevat 25 correlaties, 3 protocollen, en kanaalspecifieke kennis
 */

// ============================================================
// CORRELATIE MATRIX - 25 IF-THEN VERBANDEN
// ============================================================
export const CORRELATION_RULES = [
  {
    id: "C001",
    rule: "IF chronische_stress + darmklachten → oxidatieve_stress + mineralentekort",
    trigger: ["stress", "buikklachten", "vermoeidheid", "brain fog", "spijsvertering"],
    cause: "HPA-as overactivatie → mineralentekort (koper, omega-3, B1, magnesium) → oxidatieve stress",
    action: "Vraag naar bloedwaarden: ferritine, B12, magnesium, zink, koper. Vraag wat eerder geprobeerd is.",
    confidence: "high", impact: 9
  },
  {
    id: "C002",
    rule: "IF insulineresistentie + vermoeidheid + gewichtstoename → hoog_cortisol + bijnieruitputting",
    trigger: ["insulineresistentie", "vermoeidheid", "gewichtstoename", "suikerdrang", "buikvet"],
    cause: "Chronisch hoge insuline → cortisol dysregulatie → bijnieruitputting → energietekort",
    action: "Keto + intermittent fasting protocol. Check nuchter insuline en HbA1c.",
    confidence: "high", impact: 9
  },
  {
    id: "C003",
    rule: "IF lymfatische_stagnatie + chronische_pijn + ontsteking → slechte_vloeistofstroom + fascia",
    trigger: ["chronische pijn", "stijfheid", "zwelling", "trage genezing", "lymfe"],
    cause: "Lymfatische stagnatie door gebrek aan beweging → fascia verhardt → pijnpatronen",
    action: "BIG 6 lymfatisch reset protocol dagelijks 5 minuten. Hydratatie verhogen.",
    confidence: "high", impact: 8
  },
  {
    id: "C004",
    rule: "IF vitamine_D_tekort + vermoeidheid + slechte_weerstand → hoge_stress + slechte_slaap",
    trigger: ["vermoeidheid", "slechte weerstand", "depressie", "spierpijn", "vitamine D"],
    cause: "Vitamine D tekort (hormoon) → immuundisfunctie → verhoogde infectiegevoeligheid",
    action: "Vitamine D3 + K2 supplementatie. Zonlicht blootstelling. Check 25-OH vitamine D.",
    confidence: "high", impact: 8
  },
  {
    id: "C005",
    rule: "IF mineralentekort + botpijn + spierkrampen → alkaline_onbalans + slechte_opname",
    trigger: ["botpijn", "spierkrampen", "vermoeidheid", "tandproblemen", "mineralen"],
    cause: "Tekort aan 12 essentiële mineralen door zure voeding en slechte opname",
    action: "Alkalisch dieet. Celtic zout. Mineraalsuppletie. Check bloedwaarden op tekorten.",
    confidence: "high", impact: 8
  },
  {
    id: "C006",
    rule: "IF darmdysbiose + brain_fog + stemmingsproblemen → darm_brein_as_verstoring",
    trigger: ["brain fog", "stemmingswisselingen", "angst", "concentratie", "buikpijn", "darm"],
    cause: "Darm-brein as verstoord → serotonine productie daalt (90% in darmen) → cognitieve problemen",
    action: "Probiotica, gefermenteerde voeding, eliminatie gluten/zuivel. Vraag naar antibioticagebruik.",
    confidence: "high", impact: 9
  },
  {
    id: "C007",
    rule: "IF nervus_vagus_disfunctie + spijsverteringsproblemen + angst → parasympathisch_onderdrukt",
    trigger: ["angst", "spijsvertering", "hartkloppingen", "slaapproblemen", "vagus"],
    cause: "Nervus vagus disfunctie → parasympathisch onderdrukt → fight-or-flight dominant",
    action: "Vagus zenuw activatie: hummen, koude douche, diepe ademhaling, zingen.",
    confidence: "high", impact: 9
  },
  {
    id: "C008",
    rule: "IF bewerkt_voedsel + ontsteking + vermoeidheid → lekkende_darm + systemische_ontsteking",
    trigger: ["vermoeidheid", "huidproblemen", "gewrichtspijn", "allergieën", "ontsteking"],
    cause: "Ultra-bewerkt voedsel beschadigt darmwand → lekkende darm → systemische ontsteking",
    action: "4R protocol: Remove, Replace, Reinoculate, Repair. Elimineer bewerkt voedsel.",
    confidence: "high", impact: 9
  },
  {
    id: "C009",
    rule: "IF schildklier_problemen + vermoeidheid + gewichtsverandering → jodium + selenium_tekort",
    trigger: ["vermoeidheid", "gewichtstoename", "kouwelijkheid", "haaruitval", "schildklier"],
    cause: "Schildklier disfunctie door jodium- en seleniumtekort → vertraagd metabolisme",
    action: "Check TSH, T3, T4, anti-TPO. Jodium via zeewier. Selenium via paranoten (2/dag).",
    confidence: "high", impact: 8
  },
  {
    id: "C010",
    rule: "IF chronische_stress + slechte_slaap + cortisol_dysregulatie → bijnieruitputting + HPA_as",
    trigger: ["uitputting", "slaapproblemen", "prikkelbaarheid", "suikerdrang", "zoutdrang", "cortisol"],
    cause: "HPA-as overactivatie → bijnieren uitgeput → cortisol ritme verstoord → energietekort",
    action: "Adrenal cocktail. Slaaphygiëne. Adaptogenen (ashwagandha, rhodiola). Stressmanagement.",
    confidence: "high", impact: 9
  },
  {
    id: "C011",
    rule: "IF uitdroging + mineralenverlies + middagdip → cellulaire_uitdroging",
    trigger: ["middagdip", "hoofdpijn", "concentratie", "droge mond", "uitdroging"],
    cause: "Cellulaire uitdroging: water alleen is niet genoeg zonder elektrolyten",
    action: "Celtic zout + water. Elektrolyten supplementatie. Minimaal 2L water met mineralen.",
    confidence: "high", impact: 7
  },
  {
    id: "C012",
    rule: "IF fascia_restrictie + slechte_houding + chronische_pijn → bewegingstekort + uitdroging",
    trigger: ["rugpijn", "nekpijn", "stijfheid", "beperkte beweging", "fascia"],
    cause: "Fascia verhardt door gebrek aan beweging en dehydratie → systemische pijnpatronen",
    action: "Fasciale release. Dagelijkse beweging. Hydratatie. BIG 6 protocol.",
    confidence: "high", impact: 7
  },
  {
    id: "C013",
    rule: "IF omega3_tekort + ontsteking + brain_fog → neuro_inflammatie + cognitieve_achteruitgang",
    trigger: ["brain fog", "depressie", "gewrichtspijn", "droge huid", "geheugen", "omega"],
    cause: "Omega-3 tekort → pro-inflammatoire balans verstoord → neuro-inflammatie",
    action: "Omega-3 (EPA/DHA) supplementatie. Vette vis 3x per week. Check omega-3 index.",
    confidence: "high", impact: 8
  },
  {
    id: "C014",
    rule: "IF magnesium_tekort + angst + spierspanning + slaapproblemen → zenuwstelsel_overactief",
    trigger: ["angst", "spiertrekkingen", "slaapproblemen", "hoofdpijn", "constipatie", "magnesium"],
    cause: "Magnesiumtekort → zenuwstelsel overactief → spieren kunnen niet ontspannen",
    action: "Magnesium glycinaat of malaat (400-600mg voor slapen). Epsom zout bad.",
    confidence: "high", impact: 8
  },
  {
    id: "C015",
    rule: "IF zink_tekort + slechte_weerstand + trage_genezing → immuun_disfunctie",
    trigger: ["trage genezing", "infecties", "smaak", "reukverlies", "huidproblemen", "zink"],
    cause: "Zinktekort → immuuncellen kunnen niet aanmaken → slechte weerstand",
    action: "Zink supplementatie (15-30mg). Pompoenpitten, vlees, oesters. Check serum zink.",
    confidence: "high", impact: 7
  },
  {
    id: "C016",
    rule: "IF suikerrijk_dieet + candida + brain_fog + vermoeidheid → systemische_candida",
    trigger: ["brain fog", "suikerdrang", "vermoeidheid", "schimmel", "opgeblazen", "candida"],
    cause: "Suikerrijke voeding voedt Candida → overgroei → toxines → systemische klachten",
    action: "Suiker elimineren. Antifungale voeding (knoflook, kokosolie, kurkuma). Probiotica.",
    confidence: "medium", impact: 7
  },
  {
    id: "C017",
    rule: "IF antibiotica_geschiedenis + darmdysbiose + voedselovergevoeligheden → microbioom_schade",
    trigger: ["voedselovergevoeligheden", "opgeblazen", "diarree", "constipatie", "antibiotica"],
    cause: "Antibiotica vernietigen microbioom → dysbiose → lekkende darm → overgevoeligheden",
    action: "Vraag naar antibioticageschiedenis. Microbioom herstel: probiotica, prebiotica, gefermenteerd.",
    confidence: "high", impact: 8
  },
  {
    id: "C018",
    rule: "IF B12_tekort + vermoeidheid + tintelingen + cognitieve_klachten → methylatie_probleem",
    trigger: ["vermoeidheid", "tintelingen", "geheugen", "depressie", "B12", "methylatie"],
    cause: "B12 tekort → methylatieprobleem → neurologische klachten",
    action: "Methylcobalamine B12. Check serum B12 en homocysteïne.",
    confidence: "high", impact: 8
  },
  {
    id: "C019",
    rule: "IF slechte_slaap + hoog_cortisol_avond + blauw_licht → circadiaan_ritme_verstoring",
    trigger: ["slaapproblemen", "vermoeidheid overdag", "energiepiek avond", "gewichtstoename", "slaap"],
    cause: "Blauw licht onderdrukt melatonine → cortisol blijft hoog → circadiaan ritme verstoord",
    action: "Blauw licht filter na 20:00. Donkere slaapkamer. Magnesium voor slapen. Vaste tijden.",
    confidence: "high", impact: 8
  },
  {
    id: "C020",
    rule: "IF lever_overbelasting + huidproblemen + hormonale_onbalans → oestrogeendominantie",
    trigger: ["huidproblemen", "PMS", "gewichtstoename heupen", "stemmingswisselingen", "hormonen"],
    cause: "Lever overbelast → oestrogeen wordt niet afgebroken → oestrogeendominantie",
    action: "Lever ondersteuning: bittere groenten, mariadistel, DIM. Verminder xeno-oestrogenen.",
    confidence: "medium", impact: 8
  },
  {
    id: "C021",
    rule: "IF chronische_ontsteking + gewrichtspijn + auto_immuun → lekkende_darm + moleculaire_mimicry",
    trigger: ["gewrichtspijn", "huiduitslag", "vermoeidheid", "auto-immuun", "ontsteking"],
    cause: "Lekkende darm → onverteerde eiwitten in bloed → immuunsysteem valt eigen weefsel aan",
    action: "Eliminatiedieet (gluten, zuivel, soja). Darmherstel protocol. Anti-inflammatoire voeding.",
    confidence: "medium", impact: 9
  },
  {
    id: "C022",
    rule: "IF koper_tekort + vermoeidheid + vroeg_grijs_haar + bloedarmoede → oxidatieve_stress",
    trigger: ["vroeg grijs haar", "bloedarmoede", "vermoeidheid", "gewrichtspijn", "koper"],
    cause: "Kopertekort → ceruloplasmine daalt → ijzer kan niet worden verwerkt → oxidatieve stress",
    action: "Koper via lever, oesters, noten. Check serum koper en ceruloplasmine. Balans met zink.",
    confidence: "medium", impact: 7
  },
  {
    id: "C023",
    rule: "IF sedentaire_leefstijl + lymfatische_stagnatie + chronische_vermoeidheid → geen_flow_geen_genezing",
    trigger: ["chronische vermoeidheid", "zwelling", "trage genezing", "infecties", "stilzitten"],
    cause: "Lymfestelsel heeft geen eigen pomp → stilzitten = lymfestagnatie → afvalstoffen ophopen",
    action: "BIG 6 protocol dagelijks. Wandelen 30 min. Trampolinespringen. Diepe ademhaling.",
    confidence: "high", impact: 8
  },
  {
    id: "C024",
    rule: "IF stress + slecht_dieet + laag_maagzuur → voedingsstof_malabsorptie",
    trigger: ["opgeblazen na eten", "boeren", "tekorten ondanks goede voeding", "maagzuur"],
    cause: "Chronische stress verlaagt maagzuur → voedingsstoffen worden niet opgenomen",
    action: "Betaine HCl supplementatie. Apple cider vinegar voor maaltijden. Stress reduceren.",
    confidence: "high", impact: 8
  },
  {
    id: "C025",
    rule: "IF glutengevoeligheid + gewrichtspijn + brain_fog + vermoeidheid → niet_coeliakie_glutengevoeligheid",
    trigger: ["gewrichtspijn", "brain fog", "vermoeidheid", "huidproblemen", "gluten"],
    cause: "Glutengevoeligheid (ook zonder coeliakie) → systemische ontsteking → multi-systeem klachten",
    action: "4 weken glutenvrij eliminatiedieet. Observeer symptoomverbetering. Herintroductie test.",
    confidence: "medium", impact: 8
  }
];

// ============================================================
// CHANNEL KNOWLEDGE SUMMARIES
// ============================================================
export const DR_BERG_KNOWLEDGE = `
## Dr. Eric Berg - Kernkennis

**Specialisatie**: Keto, intermittent fasting, insulineresistentie, bijniergezondheid

**Kernprincipes**:
- Insulineresistentie is de basis van de meeste moderne ziekten
- Keto + intermittent fasting herstelt insulinegevoeligheid
- Vitamine D is een hormoon, niet alleen een vitamine (gemaakt van cholesterol, net als cortisol)
- Hoge stress verlaagt vitamine D → bijnieruitputting
- Maagzuur is essentieel voor voedingsstofopname; stress verlaagt maagzuur
- Candida groeit op suiker; elimineer suiker om candida te bestrijden
- Lekkende darm → systemische ontsteking → auto-immuun patronen

**Sleutelprotocollen**:
- Keto + 16:8 intermittent fasting
- Adrenal cocktail (vitamine C + elektrolyten)
- 4R darmherstel
- Vitamine D3 + K2 suppletie
`;

export const BARBARA_ONEILL_KNOWLEDGE = `
## Barbara O'Neill - Kernkennis

**Specialisatie**: Natuurlijk herstel, mineralen, lymfestelsel, alkalisch dieet

**Kernprincipes**:
- Het lichaam heeft innate intelligentie en kan zichzelf herstellen bij juiste omstandigheden
- 12 essentiële mineralen zijn de bouwstenen van gezondheid
- Celtic zout gevolgd door water trekt hydratatie in de cellen
- Alkalisch dieet (groenten, fruit, volkoren) neutraliseert zuurheid
- Lymfestelsel is het afvoersysteem en immuunhighway van het lichaam
- Gember is een krachtig natuurlijk ontstekingsremmer
- Kurkuma + piperine: systemische ontstekingsremming

**Sleutelprotocollen**:
- Alkalisch dieet protocol
- 15-daagse darmreiniging
- Lymfatische activatie (beweging, ademhaling, contrast douches)
- Mineraalsuppletie (Celtic zout, zeewier, paranoten)
- Gember + kurkuma anti-inflammatoir protocol
`;

export const STOP_CHASING_PAIN_KNOWLEDGE = `
## Dr. Perry Nickelston (Stop Chasing Pain) - Kernkennis

**Specialisatie**: Lymfestelsel, fascia, chronische pijn, zenuwstelsel

**Kernprincipes**:
- "No Flow, No Healing. Slow Flow, Slow Healing."
- Chronische pijn is NOOIT het probleem — het is een signaal van een dieper probleem
- Lymfestelsel heeft geen eigen pomp → afhankelijk van beweging en ademhaling
- Fascia omhult elk orgaan, spier en zenuw → als het verhardt, ontstaan pijnpatronen
- Nervus vagus reguleert parasympathisch zenuwstelsel → chronische stress blokkeert genezing
- Immuunsysteem weet verschil tussen "zelf" en "niet-zelf" → hoe je over jezelf denkt beïnvloedt immuunfunctie

**BIG 6 Protocol** (dagelijks 5 minuten):
1. Sleutelbeenderen (terminale drainagepunten)
2. Oksels (axillaire knopen)
3. Binnenkant ellebogen (cubitale knopen)
4. Buik (cisterna chyli)
5. Liezen (inguinale knopen)
6. Knieholtes (popliteale knopen)

**Sleutelprotocollen**:
- BIG 6 lymfatisch reset
- Fasciale release technieken
- Vagus zenuw activatie
- Bewegingsgebaseerde lymfedrainage
`;

// ============================================================
// PROTOCOL KNOWLEDGE
// ============================================================
export const PROTOCOL_KNOWLEDGE = `
## BESCHIKBARE PROTOCOLLEN

### 1. BIG 6 Lymfatisch Reset (Stop Chasing Pain)
Dagelijks 5-10 minuten. Stimuleert 6 primaire lymfatische drainagepunten.
Indicaties: chronische pijn, ontsteking, vermoeidheid, trage genezing.
Begin altijd bij sleutelbeenderen (terminale drainagepunten).

### 2. 4R Darmherstel Protocol (Dr. Berg + Barbara O'Neill)
3-6 maanden. Fasen: Remove → Replace → Reinoculate → Repair.
Indicaties: darmklachten, voedselovergevoeligheden, lekkende darm, dysbiose.
Fase 1: Elimineer gluten, zuivel, suiker. Fase 4: L-glutamine, collageen, vitamine D.

### 3. Bijnieruitputting Herstel (Dr. Berg)
3-6 maanden. Fasen: Stabilisatie → Ondersteuning → Optimalisatie.
Indicaties: chronische vermoeidheid, burn-out, cortisol dysregulatie.
Adaptogenen: ashwagandha (avond), rhodiola (ochtend). Vitamine C 1000-2000mg.

### 4. Anti-Inflammatoir Voedingsprotocol (Barbara O'Neill + Dr. Berg)
Continu. Elimineer triggers, voeg ontstekingsremmende voeding toe.
Indicaties: chronische ontsteking, gewrichtspijn, huidproblemen, auto-immuun.
Voeding: gember, kurkuma + piperine, omega-3, groene bladgroenten, bessen.

### 5. Keto + Intermittent Fasting (Dr. Berg)
3-6 maanden. 16:8 vasten + koolhydraatarm dieet.
Indicaties: insulineresistentie, gewichtstoename, suikerdrang, metabole klachten.
Doel: insulinegevoeligheid herstellen, vetverbranding activeren.
`;

// ============================================================
// MAIN KNOWLEDGE BASE PROMPT GENERATOR
// ============================================================
export function getKnowledgeBasePrompt(): string {
  const topCorrelations = CORRELATION_RULES.slice(0, 15); // Top 15 meest relevante
  
  return `
# AI KENNISBREIN - Gestructureerde Kennisbank

## BRONNEN
Kennis geëxtraheerd uit: Dr. Eric Berg, Barbara O'Neill, Dr. Perry Nickelston (Stop Chasing Pain)

---

${DR_BERG_KNOWLEDGE}

---

${BARBARA_ONEILL_KNOWLEDGE}

---

${STOP_CHASING_PAIN_KNOWLEDGE}

---

${PROTOCOL_KNOWLEDGE}

---

## CORRELATIE REGELS (IF-THEN VERBANDEN)

**GEBRUIK DEZE REGELS OM PATRONEN TE HERKENNEN:**

${topCorrelations.map((c, i) => `
**${i + 1}. ${c.rule}**
- Triggers: ${c.trigger.slice(0, 4).join(', ')}
- Oorzaak: ${c.cause}
- Actie: ${c.action}
`).join('\n')}
`;
}

// ============================================================
// RELEVANT CORRELATIONS FINDER
// ============================================================
export function getRelevantCorrelations(symptoms: string[]): typeof CORRELATION_RULES {
  const normalizedSymptoms = symptoms.map(s => s.toLowerCase());
  
  return CORRELATION_RULES.filter(corr => {
    return normalizedSymptoms.some(symptom => 
      corr.trigger.some((trigger: string) => 
        trigger.toLowerCase().includes(symptom) || symptom.includes(trigger.toLowerCase())
      )
    );
  }).sort((a, b) => {
    const confidenceOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    if (a.confidence !== b.confidence) {
      return (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
    }
    return b.impact - a.impact;
  });
}

// ============================================================
// PROTOCOL CONTENT GETTER
// ============================================================
export function getProtocolContent(protocolName: string): string {
  const protocols: Record<string, string> = {
    'big6': `BIG 6 Lymfatisch Reset: Stimuleer dagelijks 6 punten: sleutelbeenderen → oksels → ellebogen → buik → liezen → knieholtes. 5-10 minuten. Lichte druk, pompende bewegingen.`,
    'lymphatic': `BIG 6 Lymfatisch Reset: Begin bij sleutelbeenderen (terminale drainagepunten). Werk omlaag naar oksels, ellebogen, buik, liezen, knieholtes. Drink daarna water.`,
    '4r': `4R Darmherstel: Remove (gluten/zuivel/suiker elimineren) → Replace (spijsverteringsenzymen) → Reinoculate (probiotica + gefermenteerde voeding) → Repair (L-glutamine, collageen, vitamine D).`,
    'darm': `4R Darmherstel Protocol: 3-6 maanden. Elimineer triggers, herstel enzymen, herbepopling microbioom, herstel darmwand.`,
    'bijnier': `Bijnieruitputting Herstel: Stabilisatie (slaap, adrenal cocktail, vitamine C) → Ondersteuning (ashwagandha, rhodiola, magnesium) → Optimalisatie (intermittent fasting, beweging, stressmanagement).`,
    'adrenal': `Bijnieruitputting Herstel: 3-6 maanden. Ashwagandha 's avonds, rhodiola 's ochtends. Vitamine C 1000-2000mg. Slaap 8-9 uur. Geen cafeïne.`,
  };
  
  return protocols[protocolName.toLowerCase()] || '';
}
