
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const APIFY_ACTOR_URL =
  "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  })
);

app.use(express.json({ limit: "20kb" }));

// --------------------------------------------------
// HEALTH CHECKS
// --------------------------------------------------

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "SocialSight API is running!",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "SocialSight Backend",
    aiProvider: "Groq",
    dataProvider: "Apify",
    priceProvider: process.env.SERPAPI_API_KEY
      ? "SerpApi"
      : "not configured",
  });
});

// --------------------------------------------------
// INSTAGRAM URL VALIDATION
// --------------------------------------------------

function isValidInstagramUrl(value) {
  if (typeof value !== "string") return false;

  return /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+\/?(?:\?.*)?$/i.test(
    value.trim()
  );
}

// --------------------------------------------------
// APIFY REQUEST
// --------------------------------------------------

async function apifyRequest(input, timeoutMs = 130000) {
  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    throw new Error("APIFY_NOT_CONFIGURED");
  }

  const response = await fetch(
    `${APIFY_ACTOR_URL}?timeout=120&maxItems=1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  if (!response.ok) {
    const details = await response.text();

    console.error(
      "Apify request failed:",
      response.status,
      details.slice(0, 350)
    );

    if ([401, 403].includes(response.status)) {
      throw new Error("APIFY_AUTH_ERROR");
    }

    if (response.status === 402) {
      throw new Error("APIFY_CREDITS_REQUIRED");
    }

    if (response.status === 429) {
      throw new Error("APIFY_RATE_LIMIT");
    }

    if ([408, 504].includes(response.status)) {
      throw new Error("APIFY_TIMEOUT");
    }

    throw new Error("APIFY_FETCH_FAILED");
  }

  return response.json();
}

// --------------------------------------------------
// NORMALIZE COMMENTS
// --------------------------------------------------

function normalizeComments(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((comment) => {
      if (typeof comment === "string") {
        return comment.trim();
      }

      return String(
        comment?.text ||
        comment?.content ||
        comment?.comment ||
        ""
      ).trim();
    })
    .filter(Boolean)
    .slice(0, 100);
}

// --------------------------------------------------
// FETCH INSTAGRAM DATA
// --------------------------------------------------

async function fetchInstagramData(reelUrl) {
  const posts = await apifyRequest({
    directUrls: [reelUrl],
    resultsType: "posts",
    resultsLimit: 1,
  });

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("INSTAGRAM_DATA_NOT_FOUND");
  }

  const post =
    posts.find((item) => item.type !== "profile") ||
    posts[0];

  let comments = normalizeComments(
    post.latestComments ||
    post.comments ||
    post.topComments ||
    []
  );

  // Best-effort separate comment fetch.
  // Availability depends on the configured Apify actor.
  if (
    comments.length === 0 &&
    Number(post.commentsCount || 0) > 0
  ) {
    try {
      const commentItems = await apifyRequest(
        {
          directUrls: [
            post.url || post.inputUrl || reelUrl,
          ],
          resultsType: "comments",
          resultsLimit: 100,
        },
        90000
      );

      if (Array.isArray(commentItems)) {
        const collected = [];

        for (const item of commentItems) {
          if (Array.isArray(item.comments)) {
            collected.push(...item.comments);
          }

          if (
            item.text ||
            item.content ||
            item.comment
          ) {
            collected.push(item);
          }

          if (Array.isArray(item.latestComments)) {
            collected.push(...item.latestComments);
          }
        }

        comments = normalizeComments(collected);
      }
    } catch (error) {
      console.warn(
        "Separate comment fetch did not succeed:",
        error.message
      );
    }
  }

  return {
    url: post.url || post.inputUrl || reelUrl,
    caption: post.caption || "",
    creator:
      post.ownerUsername ||
      post.username ||
      post.ownerFullName ||
      "",
    likesCount: post.likesCount ?? null,
    commentsCount: post.commentsCount ?? null,
    comments,
    mediaType: post.type || post.postType || "",
  };
}

// --------------------------------------------------
// GROQ AI ANALYSIS
// --------------------------------------------------

async function generateAnalysis(prompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_NOT_CONFIGURED");
  }

  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are SocialSight, an honest AI shopping assistant. Return valid JSON only. Never invent evidence or current prices.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 3000,
          response_format: {
            type: "json_object",
          },
        }),
        signal: AbortSignal.timeout(60000),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Groq API error:",
          response.status,
          data?.error?.message || "Unknown error"
        );

        if (
          response.status === 429 ||
          response.status >= 500
        ) {
          throw new Error("GROQ_TEMPORARY_ERROR");
        }

        const error = new Error("GROQ_REQUEST_FAILED");
        error.publicMessage =
          data?.error?.message ||
          "Groq rejected the request.";
        error.status = response.status;

        throw error;
      }

      const content =
        data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("GROQ_EMPTY_RESPONSE");
      }

      try {
        return JSON.parse(content);
      } catch {
        throw new Error("GROQ_INVALID_JSON");
      }
    } catch (error) {
      lastError = error;

      const temporary =
        error.message === "GROQ_TEMPORARY_ERROR" ||
        error.name === "TimeoutError" ||
        error.name === "AbortError";

      if (!temporary || attempt === 2) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1500 * (attempt + 1))
      );
    }
  }

  throw lastError;
}

// --------------------------------------------------
// COMMENT SENTIMENT + EVIDENCE SCORE
// --------------------------------------------------

function analyzeCommentEvidence(comments) {
  if (!comments.length) {
    return {
      sentiment: {
        positive: null,
        neutral: null,
        negative: null,
        status:
          "No accessible comments were returned, so sentiment cannot be calculated.",
      },
      reviewTrust: {
        score: null,
        status:
          "Insufficient comment evidence. This is not a finding that reviews are fake.",
        commentsAnalyzed: 0,
      },
    };
  }

  const positiveWords =
    /\b(love|great|good|amazing|awesome|excellent|best|nice|perfect|worth|buy|bought|recommend|beautiful|genuine|original|works|quality|superb|mast|achha|accha|badhiya|sundar|satisfied)\b/i;

  const negativeWords =
    /\b(fake|scam|fraud|bad|worst|poor|terrible|waste|broken|duplicate|cheap quality|not working|disappointed|refund|return|complaint|late|damaged|overpriced|bekar|nakli|kharab)\b/i;

  const classified = comments.map((text) => {
    const positive = positiveWords.test(text);
    const negative = negativeWords.test(text);

    if (positive && !negative) return "positive";
    if (negative && !positive) return "negative";

    return "neutral";
  });

  const total = classified.length;

  const count = (label) =>
    classified.filter((item) => item === label).length;

  const percent = (label) =>
    Math.round((count(label) / total) * 100);

  const uniqueTextRatio =
    new Set(
      comments.map((text) =>
        text.toLowerCase().replace(/\s+/g, " ").trim()
      )
    ).size / total;

  const detailedComments = comments.filter(
    (text) => text.trim().length >= 12
  ).length;

  const lengthScore = Math.min(
    1,
    detailedComments / Math.max(5, total * 0.6)
  );

  const volumeScore = Math.min(1, total / 20);

  const evidenceScore = Math.round(
    Math.min(
      100,
      volumeScore * 45 +
      uniqueTextRatio * 30 +
      lengthScore * 25
    )
  );

  return {
    sentiment: {
      positive: percent("positive"),
      neutral: percent("neutral"),
      negative: percent("negative"),
      status:
        `Keyword-based estimate from ${total} accessible comments; sarcasm and context may be missed.`,
    },

    reviewTrust: {
      score: evidenceScore,
      status:
        "Comment evidence coverage score based on count, text detail and repetition. It does not verify commenter identity or prove reviews are authentic or fake.",
      commentsAnalyzed: total,
    },
  };
}


/* --------------------------------------------------
   SERPAPI GOOGLE SHOPPING PRICE COMPARISON
-------------------------------------------------- */

function normalizeShoppingPrice(item) {
  const rawPrice =
    item?.extracted_price ??
    item?.price ??
    null;

  if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
    return {
      price: rawPrice,
      formattedPrice: `₹${rawPrice.toLocaleString("en-IN")}`,
    };
  }

  if (typeof rawPrice === "string") {
    const match = rawPrice.replace(/,/g, "").match(/[\d]+(?:\.\d{1,2})?/);

    if (match) {
      const value = Number(match[0]);

      if (Number.isFinite(value)) {
        return {
          price: value,
          formattedPrice: `₹${value.toLocaleString("en-IN")}`,
        };
      }
    }
  }

  return {
    price: null,
    formattedPrice:
      typeof item?.price === "string" ? item.price : null,
  };
  
function normalizeProductText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getProductTokens(value = "") {
  const stopWords = new Set([
    "with", "for", "and", "the", "by", "new",
    "original", "best", "online", "buy", "in", "of"
  ]);

  return normalizeProductText(value)
    .split(" ")
    .filter(token => token.length > 1 && !stopWords.has(token));
}

function getProductMatchScore(expectedName, listingTitle) {
  const expected = getProductTokens(expectedName);
  const listing = getProductTokens(listingTitle);

  if (!expected.length || !listing.length) return 0;

  const listingSet = new Set(listing);
  const matched = expected.filter(token => listingSet.has(token));

  // Product name na important tokens match thava joie.
  const coverage = matched.length / expected.length;

  // Product name bahu short hoy to accidental matches avoid karo.
  if (expected.length <= 2 && coverage < 1) return 0;

  return coverage;
}

function isLikelySameProduct(expectedName, listingTitle) {
  const score = getProductMatchScore(expectedName, listingTitle);

  // Conservative threshold: unrelated products ne reject kare.
  return score >= 0.8;
}

}

function getSafeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function serpApiSearch(params) {
  const key = process.env.SERPAPI_API_KEY;

  if (!key) {
    return null;
  }

  const url = new URL("https://serpapi.com/search.json");

  for (const [name, value] of Object.entries({
    ...params,
    api_key: key,
  })) {
    url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const body = await response.text();

    console.warn(
      "SerpApi request failed:",
      response.status,
      body.slice(0, 250)
    );

    return null;
  }

  const data = await response.json();

  if (data?.error) {
    console.warn("SerpApi error:", data.error);
    return null;
  }

  return data;
}


function normalizeProductText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getProductMatchScore(expectedName, listingTitle) {
  const stopWords = new Set([
    "with", "for", "and", "the", "by", "new",
    "original", "best", "online", "buy", "in", "of"
  ]);

  const expected = normalizeProductText(expectedName)
    .split(" ")
    .filter(token => token.length > 1 && !stopWords.has(token));

  const listing = new Set(
    normalizeProductText(listingTitle).split(" ")
  );

  if (!expected.length || !listing.size) return 0;

  const matched = expected.filter(token => listing.has(token));

  return matched.length / expected.length;
}

function isLikelySameProduct(expectedName, listingTitle) {
  return getProductMatchScore(expectedName, listingTitle) >= 0.8;
}




async function fetchPriceComparison(productName) {
  if (!process.env.SERPAPI_API_KEY) {
    console.warn("Price comparison skipped: SERPAPI_API_KEY is missing.");
    return [];
  }

  const query = String(productName || "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    query.length < 2 ||
    /^(unknown|not identified|unclear|unavailable)$/i.test(query)
  ) {
    return [];
  }

  try {
    const data = await serpApiSearch({
      engine: "google_shopping",
      q: query,
      google_domain: "google.co.in",
      gl: "in",
      hl: "en",
    });

    const shoppingResults = Array.isArray(data?.shopping_results)
      ? data.shopping_results
      : [];

    const results = shoppingResults
      .map((item) => {
        const title =
          typeof item?.title === "string" ? item.title.trim() : "";

        if (!title || !isLikelySameProduct(query, title)) {
          return null;
        }

        const { price, formattedPrice } = normalizeShoppingPrice(item);

        const retailer =
          typeof item?.source === "string" && item.source.trim()
            ? item.source.trim()
            : "Online retailer";

        const offers = Array.isArray(item?.offers)
          ? item.offers
          : item?.offers && typeof item.offers === "object"
            ? [item.offers]
            : [];

        const offerWithLink = offers.find(
          offer =>
            getSafeHttpUrl(offer?.link) ||
            getSafeHttpUrl(offer?.url)
        );

        const merchantUrl = getSafeHttpUrl(
          offerWithLink?.link ||
          offerWithLink?.url ||
          item?.merchant_link ||
          item?.seller_link
        );

        const googleProductUrl = getSafeHttpUrl(
          item?.product_link || item?.link
        );

        const url = merchantUrl || googleProductUrl;

        if (!url) return null;

        const extractedPrice =
          typeof item?.extracted_price === "number" &&
          Number.isFinite(item.extracted_price)
            ? item.extracted_price
            : price;

        const numericRating = Number(item?.rating);
        const numericReviews = Number(item?.reviews);

        return {
          retailer,
          title,
          price: extractedPrice,
          formattedPrice: item?.price || formattedPrice || null,
          currency: "INR",
          url,
          image: getSafeHttpUrl(
            item?.thumbnail || item?.serpapi_thumbnail
          ),
          rating: Number.isFinite(numericRating) ? numericRating : null,
          reviews: Number.isFinite(numericReviews) ? numericReviews : null,
          availability: "Check retailer website",
          linkType: merchantUrl ? "retailer" : "shopping",
          matchScore: getProductMatchScore(query, title),
          note:
            "Product title matched the search. Verify the exact size, variant, seller and final price before purchasing.",
        };
      })
      .filter(Boolean);

    // Same retailer + same product ni duplicate entries remove karo.
    const seen = new Set();

    const uniqueResults = results.filter(item => {
      const key = `${item.retailer}|${normalizeProductText(item.title)}`;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    uniqueResults.sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });

    console.log(
      `Price comparison for "${query}": ` +
      `${shoppingResults.length} search results, ` +
      `${uniqueResults.length} likely matching listings.`
    );

    return uniqueResults.slice(0, 10);
  } catch (error) {
    console.error("Google Shopping price search failed:", error.message);
    return [];
  }
}


// --------------------------------------------------
// BUILD AI PROMPT
// --------------------------------------------------

function buildAnalysisPrompt(
  post,
  extraDescription = ""
) {
  return `
Analyze the supplied Instagram post data for SocialSight.

POST URL:
${post.url}

CREATOR:
${post.creator || "Unavailable"}

CAPTION:
${post.caption || "Unavailable"}

MEDIA TYPE:
${post.mediaType || "Unavailable"}

LIKES:
${post.likesCount ?? "Unavailable"}

REPORTED COMMENT COUNT:
${post.commentsCount ?? "Unavailable"}

COMMENTS ACTUALLY RECEIVED:
${JSON.stringify(post.comments)}

ADDITIONAL USER CONTEXT:
${extraDescription || "None provided"}

Return one valid JSON object with this structure:

{
  "productName": "string",
  "category": "string",
  "summary": "string",
  "sentiment": {
    "positive": null,
    "neutral": null,
    "negative": null,
    "status": "string"
  },
  "reviewTrust": {
    "score": null,
    "status": "string"
  },
  "priceComparison": [],
  "recommendation": "string",
  "confidence": 0,
  "reasons": [],
  "limitations": []
}

RULES:
- Identify a product only when the caption, comments, or user context support it.
- Do not claim to have watched inaccessible video.
- Do not invent prices or retailer data. Price comparison is added separately by the server.
- Do not claim reviews are fake without evidence. Review trust is calculated separately by the server.
- If no usable comments are supplied, sentiment percentages must be null.
- Confidence must be a number from 0 to 100 based on available evidence.
- Return JSON only, without Markdown fences.
`;
}

// --------------------------------------------------
// ANALYZE REEL ENDPOINT
// --------------------------------------------------

app.post("/api/analyze", async (req, res) => {
  try {
    const {
      reelUrl,
      productDescription = "",
    } = req.body ?? {};

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        success: false,
        message:
          "GROQ_API_KEY is missing from backend/.env",
      });
    }

    if (!process.env.APIFY_API_TOKEN) {
      return res.status(500).json({
        success: false,
        message:
          "APIFY_API_TOKEN is missing from backend/.env",
      });
    }

    if (!isValidInstagramUrl(reelUrl)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid Instagram Reel or post URL.",
      });
    }

    if (
      typeof productDescription !== "string" ||
      productDescription.length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Product description must be 2000 characters or fewer.",
      });
    }

    console.log(
      "Step 1: Fetching Instagram post and comments..."
    );

    const post = await fetchInstagramData(
      reelUrl.trim()
    );

    console.log(
      `Instagram data received. Caption length: ${post.caption.length}; comments received: ${post.comments.length}`
    );

    if (
      !post.caption &&
      post.comments.length === 0 &&
      !productDescription.trim()
    ) {
      return res.status(422).json({
        success: false,
        message:
          "No caption or comments were available. This Reel may be restricted or unsupported.",
      });
    }

    console.log(
      "Step 2: Generating AI product assessment..."
    );

    const analysis = await generateAnalysis(
      buildAnalysisPrompt(
        post,
        productDescription.trim()
      )
    );

    // Use actual fetched comments for these calculations.
    const evidence = analyzeCommentEvidence(
      post.comments
    );

    analysis.sentiment = evidence.sentiment;
    analysis.reviewTrust = evidence.reviewTrust;

    console.log(
      "Step 3: Searching retailer listings..."
    );

    analysis.priceComparison =
      await fetchPriceComparison(
        analysis.productName
      );

    return res.json({
      success: true,
      analysis,

      sourceData: {
        url: post.url,
        caption: post.caption,
        creator: post.creator || null,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        commentsAnalyzed: post.comments.length,
      },

      analyzedAt: new Date().toISOString(),

      dataSource:
        `Apify Instagram data + Groq AI${
          process.env.SERPAPI_API_KEY
            ? " + SerpApi retailer search"
            : ""
        }`,
    });
  } catch (error) {
    console.error(
      "SocialSight analysis error:",
      error
    );

    const knownErrors = {
      APIFY_NOT_CONFIGURED: [
        500,
        "APIFY_API_TOKEN is missing from backend/.env.",
      ],
      APIFY_AUTH_ERROR: [
        502,
        "Apify rejected the token or account access.",
      ],
      APIFY_CREDITS_REQUIRED: [
        402,
        "Apify account credits are required to fetch this Reel.",
      ],
      APIFY_RATE_LIMIT: [
        429,
        "Apify rate limit reached. Please wait and retry.",
      ],
      APIFY_TIMEOUT: [
        504,
        "Apify timed out while fetching the Reel.",
      ],
      APIFY_FETCH_FAILED: [
        502,
        "Could not fetch this Reel. Check the backend terminal for the detailed error.",
      ],
      INSTAGRAM_DATA_NOT_FOUND: [
        422,
        "No data was returned. Verify that the Reel is public and accessible.",
      ],
      GROQ_NOT_CONFIGURED: [
        500,
        "GROQ_API_KEY is missing from backend/.env.",
      ],
      GROQ_TEMPORARY_ERROR: [
        503,
        "Groq is temporarily unavailable or its rate limit was reached. Please try again later.",
      ],
      GROQ_EMPTY_RESPONSE: [
        502,
        "Groq returned an empty response. Please retry.",
      ],
      GROQ_INVALID_JSON: [
        502,
        "Groq returned an invalid analysis format. Please retry.",
      ],
    };

    const known = knownErrors[error.message];

    if (known) {
      return res.status(known[0]).json({
        success: false,
        message: known[1],
      });
    }

    if (error.message === "GROQ_REQUEST_FAILED") {
      return res.status(error.status || 502).json({
        success: false,
        message:
          error.publicMessage ||
          "Groq rejected the request. Check the API key and model settings.",
      });
    }

    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return res.status(504).json({
        success: false,
        message:
          "The request timed out. Please try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Analysis failed. Check the backend terminal for the detailed error.",
    });
  }
});

app.get("/api/test-shopping", async (_req, res) => {
  try {
    const data = await serpApiSearch({
      engine: "google_shopping",
      q: "Niconi Beauty",
      google_domain: "google.co.in",
      gl: "in",
      hl: "en",
    });

    if (!data) {
      return res.status(502).json({
        success: false,
        message: "SerpApi request failed or API key is missing.",
      });
    }

    return res.json({
      success: true,
      resultCount: data.shopping_results?.length || 0,
      results: (data.shopping_results || []).slice(0, 5),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `SocialSight backend running at http://localhost:${PORT}`
  );

  console.log(`AI provider: Groq (${GROQ_MODEL})`);
  console.log("Instagram data provider: Apify");

  console.log(
    `Price provider: ${
      process.env.SERPAPI_API_KEY
        ? "SerpApi"
        : "not configured (add SERPAPI_API_KEY to enable price comparison)"
    }`
  );
});
