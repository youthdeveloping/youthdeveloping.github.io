const ORIGIN = "https://youthdeveloping.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS }
});
const SOURCES = [
  { id: "conditions", category: "병명", name: "NLM Medical Conditions", url: "https://clinicaltables.nlm.nih.gov/apidoc/conditions/v3/doc.html", endpoint: "https://clinicaltables.nlm.nih.gov/api/conditions/v3/search" },
  { id: "icd10cm", category: "병명", name: "ICD-10-CM", url: "https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html", endpoint: "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search" },
  { id: "hcpcs", category: "수술·시술", name: "HCPCS", url: "https://clinicaltables.nlm.nih.gov/apidoc/hcpcs/v3/doc.html", endpoint: "https://clinicaltables.nlm.nih.gov/api/hcpcs/v3/search" },
  { id: "hpo", category: "표현형", name: "Human Phenotype Ontology", url: "https://clinicaltables.nlm.nih.gov/apidoc/hpo/v3/doc.html", endpoint: "https://clinicaltables.nlm.nih.gov/api/hpo/v3/search" },
  { id: "loinc", category: "검사", name: "LOINC Laboratory & Clinical Tests", url: "https://loinc.org/license", endpoint: "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search" },
  { id: "devices", category: "도구", name: "FDA openFDA Device Classification", url: "https://open.fda.gov/apis/device/classification/", endpoint: "https://api.fda.gov/device/classification.json" },
  { id: "uberon", category: "해부", name: "Uberon Anatomy Ontology via EMBL-EBI OLS", url: "https://www.ebi.ac.uk/ols4/", endpoint: "https://www.ebi.ac.uk/ols4/api/search" },
  { id: "mesh", category: "의학 주제어", name: "NLM Medical Subject Headings (MeSH)", url: "https://www.nlm.nih.gov/mesh/", endpoint: "https://id.nlm.nih.gov/mesh/sparql" },
  { id: "europepmc", category: "연구 논문", name: "Europe PMC Biomedical Literature", url: "https://europepmc.org/", endpoint: "https://www.ebi.ac.uk/europepmc/webservices/rest/search" },
  { id: "clinicaltrials", category: "임상연구", name: "ClinicalTrials.gov API v2", url: "https://clinicaltrials.gov/", endpoint: "https://clinicaltrials.gov/api/v2/studies" }
];
const DAILY_TERMS = {
  conditions: ["hypertension","diabetes","asthma","pneumonia","stroke","anemia","fracture","sepsis"],
  icd10cm: ["hypertension","diabetes","asthma","pneumonia","stroke","anemia","fracture","sepsis"],
  hcpcs: ["catheter","surgical","imaging","therapy"],
  hpo: ["short stature","seizure","hearing loss","microcephaly"],
  loinc: ["hemoglobin","glucose","creatinine","blood pressure"],
  devices: ["stethoscope","catheter","syringe","implant"],
  uberon: ["heart","lung","kidney","liver"],
  mesh: ["heart","diabetes","anatomy","blood pressure"],
  europepmc: ["cardiovascular system","asthma","diabetes","neuroscience"],
  clinicaltrials: ["asthma","diabetes","heart failure","sleep disorders"]
};
const nowISO = () => new Date().toISOString();
function parseClinicalTable(data, source) {
  if (!Array.isArray(data)) return [];
  const codes = Array.isArray(data[1]) ? data[1] : [];
  const displayRows = Array.isArray(data[3]) ? data[3] : [];
  const extra = data[2] && typeof data[2] === "object" ? data[2] : {};
  return displayRows.map((row, i) => {
    const parts = Array.isArray(row) ? row : [row];
    let code = String(codes[i] ?? "");
    let name = "";
    if (source.id === "conditions") {
      name = String(parts[0] ?? "");
      const consumer = extra.consumer_name;
      const consumerName = Array.isArray(consumer) ? String(consumer[i] ?? "") : "";
      if (!name) name = consumerName;
    } else if (source.id === "loinc") {
      name = String(parts[0] ?? "");
    } else if (source.id === "icd10cm" || source.id === "hcpcs") {
      code = String(parts[0] ?? code);
      name = String(parts[1] ?? parts[0] ?? "");
    } else {
      code = String(parts[0] ?? code);
      name = String(parts[1] ?? parts[0] ?? "");
    }
    if (!name) name = String(codes[i] ?? "");
    const definition = source.id === "conditions" && Array.isArray(extra.consumer_name)
      ? String(extra.consumer_name[i] ?? "")
      : "";
    const stableCode = code || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: source.id + ":" + stableCode,
      name_en: name.slice(0, 240),
      name_ko: null,
      category: source.category,
      code: code.slice(0, 80),
      system: source.id,
      definition: definition.slice(0, 500),
      source: source.name,
      source_url: source.url,
      updated_at: nowISO()
    };
  }).filter(x => x.name_en);
}
async function fetchSource(source, query, count = 12) {
  if (source.id === "mesh") {
    const safeQuery=query.replaceAll("'"," ");
    const sparql="PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX meshv: <http://id.nlm.nih.gov/mesh/vocab#> SELECT DISTINCT ?descriptor ?label WHERE { ?descriptor rdf:type meshv:Descriptor . ?descriptor rdfs:label ?label . FILTER(LANG(?label) = 'en') FILTER(CONTAINS(LCASE(STR(?label)), LCASE('"+safeQuery+"'))) } LIMIT "+Math.min(count,15);
    const u=new URL(source.endpoint);u.searchParams.set("query",sparql);u.searchParams.set("format","JSON");u.searchParams.set("limit",String(Math.min(count,15)));
    const response=await fetch(u.toString(),{headers:{"Accept":"application/sparql-results+json"},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("MeSH RDF returned "+response.status);
    const data=await response.json();
    return (((data.results||{}).bindings)||[]).map(item=>{const name=String((item.label||{}).value||"");const uri=String((item.descriptor||{}).value||"");const code=uri.split("/").pop();return {id:"mesh:"+code,name_en:name.slice(0,240),name_ko:null,category:source.category,code,system:"MeSH",definition:"NLM의 생의학 주제어 표준(MeSH)에 등록된 표제어입니다.",source:source.name,source_url:uri||source.url,updated_at:nowISO()};}).filter(x=>x.name_en);
  }
  if (source.id === "europepmc") {
    const u=new URL(source.endpoint);u.searchParams.set("query",query);u.searchParams.set("format","json");u.searchParams.set("resultType","lite");u.searchParams.set("pageSize",String(Math.min(count,15)));
    const response=await fetch(u.toString(),{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("Europe PMC returned "+response.status);
    const data=await response.json();
    return (((data.resultList||{}).result)||[]).map(item=>{const id=String(item.pmid||item.pmcid||item.doi||item.id||"");const title=String(item.title||"Untitled biomedical publication");const detail=[item.authorString||"",item.journalTitle||"",item.firstPublicationDate||""].filter(Boolean).join(" · ");const link=item.pmid?"https://europepmc.org/article/MED/"+item.pmid:(item.pmcid?"https://europepmc.org/articles/"+item.pmcid:source.url);return {id:"europepmc:"+id,name_en:title.slice(0,240),name_ko:null,category:source.category,code:id,system:"Europe PMC",definition:detail.slice(0,500),source:source.name,source_url:link,updated_at:nowISO()};}).filter(x=>x.name_en);
  }
  if (source.id === "clinicaltrials") {
    const u=new URL(source.endpoint);u.searchParams.set("query.term",query);u.searchParams.set("format","json");u.searchParams.set("pageSize",String(Math.min(count,15)));
    const response=await fetch(u.toString(),{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("ClinicalTrials.gov returned "+response.status);
    const data=await response.json();
    return (data.studies||[]).map(study=>{const p=study.protocolSection||{};const id=String((p.identificationModule||{}).nctId||"");const title=String((p.identificationModule||{}).briefTitle||"Clinical study");const status=(p.statusModule||{}).overallStatus||"";const type=(p.designModule||{}).studyType||"";const conditions=(p.conditionsModule||{}).conditions||[];const detail=[status,type].concat(conditions.slice(0,4)).filter(Boolean).join(" · ");return {id:"clinicaltrials:"+id,name_en:title.slice(0,240),name_ko:null,category:source.category,code:id,system:"ClinicalTrials.gov",definition:detail.slice(0,500),source:source.name,source_url:id?"https://clinicaltrials.gov/study/"+id:source.url,updated_at:nowISO()};}).filter(x=>x.name_en);
  }
  if (source.id === "devices") {
    const clean = query.replace(/[^a-zA-Z0-9가-힣 -]/g, " ").trim().split(" ").filter(Boolean).join(" ");
    const u = new URL(source.endpoint);
    u.searchParams.set("search", 'device_name:"' + clean + '"');
    u.searchParams.set("limit", String(count));
    const response = await fetch(u.toString(), { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error("openFDA devices returned " + response.status);
    const data = await response.json();
    return (data.results || []).map(item => {
      const code = String(item.product_code || item.regulation_number || item.device_name || "");
      const name = String(item.device_name || "");
      return {
        id: "devices:" + code,
        name_en: name.slice(0,240), name_ko: null, category: source.category,
        code: String(item.product_code || "").slice(0,80), system: "FDA Device Classification",
        definition: [item.medical_specialty_description ? "분야: " + item.medical_specialty_description : "", item.device_class ? "FDA 등급: " + item.device_class : "", item.regulation_number ? "규정: " + item.regulation_number : ""].filter(Boolean).join(" · ").slice(0,500),
        source: source.name, source_url: source.url, updated_at: nowISO()
      };
    }).filter(x => x.name_en);
  }
  if (source.id === "uberon") {
    const u = new URL(source.endpoint);
    u.searchParams.set("q", query);
    u.searchParams.set("ontology", "uberon");
    u.searchParams.set("rows", String(count));
    u.searchParams.set("fieldList", "iri,label,short_form,obo_id,description,ontology_name,ontology_prefix");
    const response = await fetch(u.toString(), { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error("OLS anatomy returned " + response.status);
    const data = await response.json();
    return ((data.response && data.response.docs) || []).map(item => {
      const name = String(item.label || item.short_form || "");
      const code = String(item.short_form || item.obo_id || "");
      const desc = Array.isArray(item.description) ? item.description.join(" ") : String(item.description || "");
      return {
        id: "uberon:" + (code || name.toLowerCase().replace(/[^a-z0-9]+/g,"-")),
        name_en: name.slice(0,240), name_ko: null, category: source.category,
        code: code.slice(0,80), system: "Uberon",
        definition: desc.replace(/<[^>]*>/g," ").slice(0,500),
        source: source.name, source_url: source.url, updated_at: nowISO()
      };
    }).filter(x => x.name_en);
  }
  const u = new URL(source.endpoint);
  u.searchParams.set("terms", query);
  u.searchParams.set("count", String(count));
  if (source.id === "icd10cm") u.searchParams.set("sf", "code,name");
  if (source.id === "hcpcs") u.searchParams.set("sf", "code,short_desc");
  if (source.id === "hpo") u.searchParams.set("sf", "code,name");
  if (source.id === "conditions") {
    u.searchParams.set("df", "primary_name");
    u.searchParams.set("ef", "consumer_name");
  }
  if (source.id === "loinc") {
    u.searchParams.set("type", "question");
    u.searchParams.set("excludeCopyrighted", "true");
    u.searchParams.set("df", "text");
    u.searchParams.set("sf", "text,COMPONENT,CONSUMER_NAME,RELATEDNAMES2,SHORTNAME,LONG_COMMON_NAME,LOINC_NUM");
    u.searchParams.set("ef", "isCopyrighted");
  }
  const response = await fetch(u.toString(), {
    headers: { "Accept": "application/json", "User-Agent": "YouthDeveloper-MedicalDictionary/1.0" },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(source.id + " returned " + response.status);
  return parseClinicalTable(await response.json(), source);
}
async function saveTerms(db, terms) {
  if (!terms.length) return;
  const statements = terms.map(t => db.prepare(
    "INSERT INTO medical_terms (id,name_en,name_ko,category,code,system,definition,source,source_url,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name_en=excluded.name_en,category=excluded.category,code=excluded.code,system=excluded.system,definition=excluded.definition,source=excluded.source,source_url=excluded.source_url,updated_at=excluded.updated_at"
  ).bind(t.id,t.name_en,t.name_ko,t.category,t.code,t.system,t.definition,t.source,t.source_url,t.updated_at));
  for (let i = 0; i < statements.length; i += 80) await db.batch(statements.slice(i, i + 80));
}
async function searchTerms(db, query, category) {
  const sources = SOURCES.filter(s => category === "all" || s.category === category);
  const cacheKey = category + ":" + query.toLocaleLowerCase("en-US");
  const cached = await db.prepare("SELECT payload, expires_at FROM medical_search_cache WHERE cache_key=?")
    .bind(cacheKey).first();
  if (cached && Number(cached.expires_at) > Date.now()) {
    try { return { terms: JSON.parse(cached.payload), cached: true }; } catch {}
  }
  const outcomes = await Promise.allSettled(sources.map(s => fetchSource(s, query, 12)));
  const terms = [];
  const errors = [];
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.status === "fulfilled") terms.push(...outcome.value);
    else errors.push(SOURCES.filter(s => category === "all" || s.category === category)[i].name);
  }
  const unique = [...new Map(terms.map(t => [t.id, t])).values()];
  await saveTerms(db, unique);
  if (unique.length || !errors.length) {
    await db.prepare("INSERT INTO medical_search_cache (cache_key,payload,expires_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,updated_at=excluded.updated_at")
      .bind(cacheKey, JSON.stringify(unique), Date.now() + 12 * 60 * 60 * 1000, nowISO()).run();
  }
  if (!unique.length) {
    const local = await db.prepare("SELECT * FROM medical_terms WHERE name_en LIKE ? OR code LIKE ? ORDER BY name_en LIMIT 40")
      .bind("%" + query + "%", "%" + query + "%").all();
    return { terms: local.results || [], cached: false, partial: true, errors };
  }
  return { terms: unique, cached: false, partial: errors.length > 0, errors };
}
async function recordSync(db, source, query, count, status, detail = "") {
  await db.prepare("INSERT INTO medical_sync_log (source,query,result_count,status,detail,synced_at) VALUES (?,?,?,?,?,?)")
    .bind(source, query, count, status, detail.slice(0, 300), nowISO()).run();
}
async function dailySync(env) {
  for (const source of SOURCES) {
    for (const query of (DAILY_TERMS[source.id] || [])) {
      try {
        const terms = await fetchSource(source, query, 10);
        await saveTerms(env.DB, terms);
        await recordSync(env.DB, source.name, query, terms.length, "ok");
      } catch (error) {
        await recordSync(env.DB, source.name, query, 0, "error", String(error));
      }
    }
  }
  await env.DB.prepare("DELETE FROM medical_search_cache WHERE expires_at < ?").bind(Date.now()).run();
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/api/medical/health" && request.method === "GET") {
      const [count, last] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total FROM medical_terms").first(),
        env.DB.prepare("SELECT synced_at,status FROM medical_sync_log ORDER BY id DESC LIMIT 1").first()
      ]);
      return json({ ok: true, total: Number(count?.total || 0), lastSync: last || null, syncSchedule: "매일 12:00 KST", sources: SOURCES.map(s => ({id:s.id,category:s.category,name:s.name})) });
    }
    if (url.pathname === "/api/medical/search" && request.method === "GET") {
      const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
      const category = String(url.searchParams.get("category") || "all");
      if (query.length < 2) return json({ error: "검색어를 두 글자 이상 입력해 주세요." }, 400);
      if (!["all","병명","수술·시술","표현형","검사","도구","해부","의학 주제어","연구 논문","임상연구"].includes(category)) return json({ error: "지원하지 않는 분류입니다." }, 400);
      try {
        const result = await searchTerms(env.DB, query, category);
        return json({ query, ...result, count: result.terms.length, updatedAt: nowISO() });
      } catch (error) {
        return json({ error: "의학 용어 검색에 실패했습니다.", detail: String(error).slice(0, 180) }, 502);
      }
    }
    return json({ error: "Not Found" }, 404);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dailySync(env));
  }
};
