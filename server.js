/**
 * KrishiMitra AI – Smart Farming RAG Agent
 * AICTE-IBM SkillsBuild Problem Statement #9
 * Powered by IBM Cloud Lite + IBM Granite (ibm/granite-13b-instruct-v2) via watsonx.ai
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Load RAG Knowledge Base ───────────────────────────────────────────────
const KB_PATH = path.join(__dirname, "data", "farming_knowledge_base.json");
let knowledgeBase = { records: [] };
try {
  knowledgeBase = JSON.parse(fs.readFileSync(KB_PATH, "utf8"));
  console.log(
    `✅ Knowledge base loaded: ${knowledgeBase.records.length} records across ${knowledgeBase.metadata.pillars.length} pillars`
  );
} catch (err) {
  console.error("❌ Failed to load knowledge base:", err.message);
}

// ─── RAG Retrieval Engine ──────────────────────────────────────────────────
/**
 * Searches the knowledge base by matching keywords against the query.
 * Returns top-N scored records.
 */
function retrieveContext(query, topN = 3) {
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 1);

  const scored = knowledgeBase.records.map((record) => {
    let score = 0;
    const searchSpace = [
      record.title || "",
      record.title_hi || "",
      record.content || "",
      record.content_hi || "",
      (record.keywords || []).join(" "),
      record.pillar || "",
      record.season || "",
      record.commodity || "",
      record.crop || "",
      record.region || "",
    ]
      .join(" ")
      .toLowerCase();

    for (const token of queryTokens) {
      // Exact substring match in keywords or pillar gets higher weight
      const kwMatch = (record.keywords || []).some(
        (k) => k.toLowerCase().includes(token) || token.includes(k.toLowerCase())
      );
      if (kwMatch) score += 3;
      // General content match
      if (searchSpace.includes(token)) score += 1;
    }

    // Pillar affinity boosts
    if (queryLower.match(/\b(mandi|rate|price|bhav|keemat|market|tamatar|pyaz|aloo|sarson|gehun|dhan)\b/)) {
      if (record.pillar === "mandi_rates") score += 5;
    }
    if (queryLower.match(/\b(pest|keet|disease|rog|blight|borer|aphid|spray|control)\b/)) {
      if (record.pillar === "pest_control") score += 5;
    }
    if (queryLower.match(/\b(weather|mausam|rain|barish|temperature|forecast|sowing|buvai)\b/)) {
      if (record.pillar === "weather_forecast") score += 5;
    }
    if (queryLower.match(/\b(soil|mitti|ph|npk|fertilizer|khad|urea)\b/)) {
      if (record.pillar === "soil_condition") score += 5;
    }
    if (queryLower.match(/\b(crop|fasal|kharif|rabi|zaid|season|maosam|which crop|best crop)\b/)) {
      if (record.pillar === "crop_recommendation") score += 5;
    }

    return { record, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.record);
}

// ─── IBM Cloud IAM Token Helper ────────────────────────────────────────────
function getIAMToken(apiKey) {
  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(apiKey)}`;
    const options = {
      hostname: "iam.cloud.ibm.com",
      path: "/identity/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) resolve(parsed.access_token);
          else reject(new Error(`IAM Error: ${JSON.stringify(parsed)}`));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ─── IBM watsonx.ai Granite Inference ─────────────────────────────────────
function callWatsonxGranite(prompt, accessToken, projectId, modelId, wxUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${wxUrl}/ml/v1/text/generation?version=2023-05-29`);
    const body = JSON.stringify({
      model_id: modelId,
      input: prompt,
      parameters: {
        decoding_method: "greedy",
        max_new_tokens: 500,
        min_new_tokens: 30,
        stop_sequences: ["<end>"],
        repetition_penalty: 1.1,
      },
      project_id: projectId,
    });

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.results && parsed.results[0]) {
            resolve(parsed.results[0].generated_text.trim());
          } else {
            reject(new Error(`watsonx Error: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── RAG Synthesis Fallback (no credentials needed) ───────────────────────
/**
 * Generates a grounded advisory response from the RAG context without an LLM.
 * This ensures the demo works 100% out-of-the-box even without IBM credentials.
 */
function synthesizeFallbackResponse(query, contextRecords, lang) {
  const isHindi = lang === "hi";

  if (contextRecords.length === 0) {
    return isHindi
      ? "क्षमा करें, आपके प्रश्न से संबंधित जानकारी हमारे ज्ञान आधार में नहीं मिली। कृपया अपना प्रश्न अधिक स्पष्ट करें।"
      : "Sorry, no relevant information was found for your query. Please try rephrasing your question with more specific keywords.";
  }

  const primary = contextRecords[0];
  const titleLine = isHindi
    ? `📋 ${primary.title_hi || primary.title}`
    : `📋 ${primary.title}`;
  const sourceLine = isHindi
    ? `🏛️ स्रोत: ${primary.source}`
    : `🏛️ Source: ${primary.source}`;
  const contentLine = isHindi
    ? (primary.content_hi || primary.content)
    : primary.content;

  let response = `${titleLine}\n${sourceLine}\n\n${contentLine}`;

  if (contextRecords.length > 1) {
    const also = isHindi ? "\n\n📌 संबंधित जानकारी:" : "\n\n📌 Also relevant:";
    response += also;
    contextRecords.slice(1).forEach((rec) => {
      const addTitle = isHindi ? (rec.title_hi || rec.title) : rec.title;
      response += `\n• ${addTitle} (${rec.source})`;
    });
  }

  const footer = isHindi
    ? "\n\n⚠️ यह सलाह ICAR, IMD और e-NAM के विश्वसनीय डेटा पर आधारित है। स्थानीय KVK या कृषि अधिकारी से भी परामर्श करें।"
    : "\n\n⚠️ This advisory is grounded in trusted data from ICAR, IMD, and e-NAM. Please also consult your local Krishi Vigyan Kendra (KVK) or agriculture officer for field-specific guidance.";
  response += footer;

  return response;
}

// ─── Main RAG Prompt Builder ───────────────────────────────────────────────
function buildGranitePrompt(query, contextRecords, lang) {
  const isHindi = lang === "hi";
  const contextText = contextRecords
    .map(
      (r, i) =>
        `[Source ${i + 1}] ${r.source}\nTitle: ${r.title}\n${r.content}`
    )
    .join("\n\n---\n\n");

  const systemInstruction = isHindi
    ? `आप KrishiMitra AI हैं, एक विशेषज्ञ कृषि सलाहकार। नीचे दिए गए विश्वसनीय स्रोतों से प्राप्त जानकारी के आधार पर किसान के प्रश्न का उत्तर दें। केवल प्रदत्त जानकारी का उपयोग करें।`
    : `You are KrishiMitra AI, an expert agricultural advisor. Answer the farmer's question strictly based on the trusted context provided below. Do not hallucinate. Be concise, practical, and farmer-friendly.`;

  return `${systemInstruction}

=== TRUSTED CONTEXT (RAG Retrieved) ===
${contextText}
=== END CONTEXT ===

Farmer's Question: ${query}

Advisory Response (be concise and practical):`;
}

// ─── /api/ask Endpoint ─────────────────────────────────────────────────────
app.post("/api/ask", async (req, res) => {
  const { query, lang = "en" } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: "Query is required." });
  }

  // Step 1: RAG Retrieval
  const contextRecords = retrieveContext(query, 3);

  // Step 2: Determine if IBM credentials are available
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const wxUrl = process.env.WATSONX_URL || "https://us-south.ml.cloud.ibm.com";
  const modelId = process.env.WATSONX_MODEL_ID || "ibm/granite-13b-instruct-v2";

  const hasCredentials = apiKey && apiKey.trim() !== "" && projectId && projectId.trim() !== "";

  let response, mode;

  if (hasCredentials) {
    // Step 3a: IBM watsonx.ai + Granite path
    try {
      console.log("🔐 Authenticating with IBM Cloud IAM...");
      const accessToken = await getIAMToken(apiKey);
      console.log("✅ IAM token obtained.");

      const prompt = buildGranitePrompt(query, contextRecords, lang);
      console.log(`🤖 Calling IBM Granite (${modelId})...`);
      const graniteResponse = await callWatsonxGranite(prompt, accessToken, projectId, modelId, wxUrl);
      response = graniteResponse;
      mode = "ibm_granite";
      console.log("✅ Granite response received.");
    } catch (err) {
      console.error("⚠️ IBM watsonx.ai call failed, using RAG fallback:", err.message);
      response = synthesizeFallbackResponse(query, contextRecords, lang);
      mode = "rag_fallback";
    }
  } else {
    // Step 3b: RAG synthesis fallback (no credentials)
    console.log("ℹ️  No IBM credentials found – using grounded RAG synthesis fallback.");
    response = synthesizeFallbackResponse(query, contextRecords, lang);
    mode = "rag_fallback";
  }

  return res.json({
    query,
    lang,
    mode,
    model: hasCredentials ? modelId : "rag-synthesis-fallback",
    context: contextRecords.map((r) => ({
      id: r.id,
      pillar: r.pillar,
      title: r.title,
      title_hi: r.title_hi,
      source: r.source,
      snippet: (r.content || "").slice(0, 280) + "...",
    })),
    response,
    ethical_ai: {
      grounded: true,
      sources_cited: contextRecords.map((r) => r.source),
      hallucination_risk: mode === "rag_fallback" ? "minimal" : "low",
      disclaimer:
        "This advisory is AI-generated based on trusted agricultural data. Always consult your local KVK or agriculture extension officer for field-specific decisions.",
    },
  });
});

// ─── /api/health Endpoint ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "KrishiMitra AI – Smart Farming RAG Agent",
    problem_statement: "AICTE-IBM SkillsBuild PS #9",
    model: process.env.WATSONX_MODEL_ID || "ibm/granite-13b-instruct-v2",
    kb_records: knowledgeBase.records.length,
    pillars: knowledgeBase.metadata?.pillars || [],
    credentials_configured:
      !!(process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID),
  });
});

// ─── Serve Frontend ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start Server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🌾 KrishiMitra AI – Smart Farming RAG Agent");
  console.log("  AICTE-IBM SkillsBuild Problem Statement #9");
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`  Model: ${process.env.WATSONX_MODEL_ID || "ibm/granite-13b-instruct-v2"}`);
  console.log(
    `  IBM Credentials: ${
      process.env.WATSONX_API_KEY && process.env.WATSONX_PROJECT_ID
        ? "✅ Configured (IBM Granite mode)"
        : "⚠️  Not set – RAG synthesis fallback active (demo works out-of-the-box)"
    }`
  );
  console.log("═══════════════════════════════════════════════════════");
});
