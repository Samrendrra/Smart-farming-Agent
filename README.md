# 🌾 KrishiMitra AI – Smart Farming RAG Agent

**AICTE-IBM SkillsBuild Internship | Problem Statement #9**
**"AI Agent for Smart Farming Advice (RAG Based)"**

> *Empowering small-scale farmers with real-time, localized, trustworthy agricultural guidance — powered by IBM Cloud Lite & IBM Granite via watsonx.ai.*

---

## 📋 Problem Statement

Small-scale farmers across India face critical information gaps on:
- Which crops to sow for the current season
- Real-time soil condition and weather advisories
- Effective pest and disease management
- Daily mandi (market) prices to maximize income
- All in their preferred local language (Hindi / English)

**Problem Statement #9** requires building an AI Agent that uses **Retrieval-Augmented Generation (RAG)** to retrieve trusted agricultural data and synthesize grounded, hallucination-free advisory responses using **IBM Granite** on **IBM watsonx.ai**.

---

## 👨‍🌾 Target Users & Pain Points

| User Segment | Pain Point | KrishiMitra Solution |
|---|---|---|
| Small & marginal farmers | No access to expert agronomy advice | AI-powered 24×7 advisory |
| Hindi-speaking farmers | English-only agri portals | Full Hindi language support |
| Vegetable/Horticulture farmers | Unpredictable mandi prices | Real-time e-NAM price intelligence |
| Farmers in drought-prone zones | Weather uncertainty at sowing time | IMD-based pre-sowing forecast advisory |
| Pest-affected farmers | Expensive/wrong pesticide use | ICAR-grounded IPM recommendations |

---

## 💡 Solution Overview

**KrishiMitra AI** is a Node.js + Express web application that implements a full RAG pipeline:

1. **Knowledge Base (RAG Corpus)**: A structured JSON dataset (`data/farming_knowledge_base.json`) with 17 expert records spanning 5 agricultural pillars — sourced from ICAR, IMD, e-NAM, KVK, and NAFED.

2. **RAG Retrieval Engine**: A keyword + semantic scoring retrieval function that matches farmer queries to the top-3 most relevant knowledge base records.

3. **IBM Granite LLM (watsonx.ai)**: When IBM credentials are configured, the system retrieves an IAM token and calls `ibm/granite-13b-instruct-v2` via the watsonx.ai inference API, passing the retrieved context as a grounded prompt.

4. **RAG Synthesis Fallback**: When credentials are blank, a deterministic response is synthesized directly from the retrieved records — ensuring the demo runs 100% out-of-the-box without any API keys.

5. **Bilingual UI Dashboard**: A responsive web frontend (`public/index.html`) with language toggle, quick-ask buttons, dual output panels (RAG sources + advisory), and an Ethical AI badge.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              KrishiMitra AI – System Architecture                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Farmer Browser UI]  ──── HTTP POST /api/ask ────►             │
│   index.html                                                     │
│   ├── Language Toggle (EN/HI)                                    │
│   ├── Quick-Ask Buttons                                          │
│   ├── RAG Sources Panel   ◄──────────────────┐                  │
│   └── Advisory Panel      ◄────────────────┐ │                  │
│                                            │ │                  │
│  [Express Server – server.js]              │ │                  │
│   ├── POST /api/ask                        │ │                  │
│   │    │                                   │ │                  │
│   │    ▼                                   │ │                  │
│   │  ┌─────────────────────────────────┐   │ │                  │
│   │  │  RAG RETRIEVAL ENGINE           │   │ │                  │
│   │  │  (Keyword + Pillar Scoring)     │───┘ │                  │
│   │  │  farming_knowledge_base.json    │     │                  │
│   │  │  • Crop Recommendations (4)     │     │                  │
│   │  │  • Soil Conditions (4)          │     │                  │
│   │  │  • Pest Control (4)             │     │                  │
│   │  │  • Weather Forecasts (4)        │     │                  │
│   │  │  • Daily Mandi Rates (6)        │     │                  │
│   │  └─────────────────────────────────┘     │                  │
│   │    │                                     │                  │
│   │    ▼                                     │                  │
│   │  IBM Credentials configured?             │                  │
│   │    │                                     │                  │
│   │  YES ──► IBM Cloud IAM Token ──►         │                  │
│   │           IBM watsonx.ai API             │                  │
│   │           ibm/granite-13b-instruct-v2 ───┘                  │
│   │                                                              │
│   │  NO  ──► RAG Synthesis Fallback ──────────────────────────► │
│   │           (Grounded, no hallucination)                       │
│   │                                                              │
│   └── GET /api/health                                            │
│                                                                  │
│  [IBM Cloud Lite]                                                │
│   ├── IBM Cloud IAM (iam.cloud.ibm.com)                          │
│   └── IBM watsonx.ai (us-south.ml.cloud.ibm.com)                │
│        └── Model: ibm/granite-13b-instruct-v2                   │
│                                                                  │
│  [Data Sources – RAG Knowledge Base]                             │
│   ├── ICAR (Indian Council of Agricultural Research)             │
│   ├── IMD (India Meteorological Department)                      │
│   ├── e-NAM (National Agriculture Market)                        │
│   ├── NAFED (National Agricultural Cooperative Marketing)        │
│   └── KVK (Krishi Vigyan Kendras)                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
Smart-farming Agent/
├── server.js                      # Express server + RAG engine + watsonx.ai integration
├── package.json                   # Node.js dependencies (express, dotenv, cors)
├── .env.example                   # Environment variable template
├── .env                           # Your local credentials (DO NOT COMMIT)
├── data/
│   └── farming_knowledge_base.json  # RAG corpus (17 expert records, 5 pillars)
├── public/
│   └── index.html                 # Bilingual responsive dashboard UI
└── README.md                      # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ installed
- (Optional) IBM Cloud Lite account for watsonx.ai + IBM Granite

### Step 1 – Clone / Download
```bash
cd "Smart-farming Agent"
```

### Step 2 – Install Dependencies
```bash
npm install
```

### Step 3 – Configure Environment (Optional for IBM Granite)
```bash
cp .env.example .env
```
Edit `.env` and fill in your IBM credentials:
```
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-instruct-v2
PORT=3000
```

> **Note:** If credentials are left blank, the app runs in **RAG Synthesis Demo Mode** — all features work without any IBM account.

### Step 4 – Run the Server
```bash
npm start
```

### Step 5 – Open the Dashboard
Open your browser and navigate to: **http://localhost:3000**

---

## 🔌 API Reference

### `POST /api/ask`
Ask a farming question via the RAG pipeline.

**Request Body:**
```json
{
  "query": "What crop is best for this season?",
  "lang": "en"
}
```
`lang` can be `"en"` (English) or `"hi"` (Hindi).

**Response:**
```json
{
  "query": "What crop is best for this season?",
  "lang": "en",
  "mode": "ibm_granite",
  "model": "ibm/granite-13b-instruct-v2",
  "context": [
    {
      "id": "CR-004",
      "pillar": "crop_recommendation",
      "title": "Best Crop for Current Season – General Advisory",
      "source": "Krishi Vigyan Kendra (KVK)",
      "snippet": "Selecting the best crop depends on..."
    }
  ],
  "response": "Based on trusted ICAR and KVK data...",
  "ethical_ai": {
    "grounded": true,
    "sources_cited": ["Krishi Vigyan Kendra (KVK)", "ICAR"],
    "hallucination_risk": "low",
    "disclaimer": "This advisory is AI-generated based on trusted agricultural data..."
  }
}
```

### `GET /api/health`
Returns service status and configuration info.

---

## 🌐 Supported Query Types (Bilingual)

| English Query | Hindi Query | Pillar |
|---|---|---|
| What crop is best for this season? | इस मौसम की सबसे अच्छी फसल कौन सी है? | Crop Recommendations |
| What is today's mandi rate for tomatoes? | आज टमाटर का मंडी भाव क्या है? | Mandi Rates |
| How to control pests in wheat? | गेहूं में कीट नियंत्रण कैसे करें? | Pest Control |
| Soil and weather advice for sowing | बुवाई के लिए मिट्टी और मौसम की सलाह | Soil + Weather |
| What is the MSP for mustard? | सरसों का MSP क्या है? | Mandi Rates |
| Weather forecast for north India | उत्तर भारत मौसम पूर्वानुमान | Weather |

---

## 🛡️ Ethical AI Principles

This project adheres to IBM's Responsible AI guidelines:

- **Grounded Responses**: All LLM responses are grounded in retrieved context — the model cannot hallucinate uncited information.
- **Source Transparency**: Every response cites the authoritative source (ICAR, IMD, e-NAM, KVK, NAFED).
- **Hallucination Mitigation**: RAG architecture prevents out-of-distribution outputs; fallback mode is fully deterministic.
- **Bias Awareness**: Knowledge base covers all major Indian agricultural regions (north, central, south) and soil types.
- **Farmer-First Language**: Advisory responses are designed in plain, farmer-friendly language in both English and Hindi.
- **Data Privacy**: No farmer data is stored; all queries are stateless.

---

## 🧰 Technology Stack

| Component | Technology |
|---|---|
| Backend Server | Node.js + Express |
| AI/LLM | IBM Granite (`ibm/granite-13b-instruct-v2`) via IBM watsonx.ai |
| Cloud | IBM Cloud Lite (IAM + watsonx.ai) |
| RAG Architecture | Custom keyword + pillar scoring retrieval |
| Knowledge Base | JSON (Docling-ready structure) |
| Frontend | Vanilla HTML5 + CSS3 + JS (no framework) |
| Languages | English + Hindi (bilingual) |
| Data Sources | ICAR · IMD · e-NAM · NAFED · KVK |

---

## 📊 Knowledge Base Coverage

| Pillar | Records | Key Topics |
|---|---|---|
| 🌱 Crop Recommendations | 4 | Kharif, Rabi, Zaid, General/Best Crop |
| 🏔️ Soil Conditions | 4 | Alluvial, Black Cotton, Sandy, Soil Testing |
| 🐛 Pest Control | 4 | Tomato, Wheat, Paddy, General IPM |
| 🌦️ Weather Forecasts | 4 | North India, Central India, South India, Pre-Sowing |
| 📊 Mandi Rates | 6 | Tomato, Wheat, Paddy, Onion, Potato, Mustard |
| **Total** | **17** | **5 pillars, 6 commodities, bilingual** |

---

## 📜 License

MIT License — Free to use, modify, and distribute for educational purposes.

---

*Built for AICTE-IBM SkillsBuild Internship Program | Problem Statement #9*
*IBM Cloud Lite · watsonx.ai · IBM Granite · RAG Architecture*
