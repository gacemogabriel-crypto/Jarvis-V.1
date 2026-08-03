export const maxDuration = 60;

const VISION_MODEL = "qwen/qwen3.6-27b";
const REASONING_MODEL = "openai/gpt-oss-20b";

function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
}

async function callGroq({
  messages,
  model,
  maxTokens = 800,
  temperature = 0.1
}) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens
      }),
      signal: AbortSignal.timeout(30000)
    }
  );

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Groq returned invalid JSON: ${responseText.slice(0, 180)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
      `Groq request failed with status ${response.status}.`
    );
  }

  const content =
    result?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  return content;
}

async function searchWeb(query) {
  const response = await fetch(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        topic: "general",
        search_depth: "advanced",
        max_results: 5,
        include_answer: false,
        include_raw_content: false
      }),
      signal: AbortSignal.timeout(20000)
    }
  );

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Tavily returned invalid JSON: ${responseText.slice(0, 180)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.detail ||
      result?.message ||
      `Search failed with status ${response.status}.`
    );
  }

  return Array.isArray(result.results)
    ? result.results
    : [];
}

function extractSection(text, sectionName) {
  const escapedName = sectionName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const expression = new RegExp(
    `${escapedName}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`,
    "i"
  );

  return text.match(expression)?.[1]?.trim() || "";
}

function extractQueries(text) {
  const querySection = extractSection(
    text,
    "SEARCH_QUERIES"
  );

  const lines = querySection
    .split("\n")
    .map(line =>
      line
        .replace(/^[-*•\d.)\s]+/, "")
        .trim()
    )
    .filter(Boolean);

  return [...new Set(lines)].slice(0, 5);
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    parsed.hash = "";

    const removableParameters = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref"
    ];

    removableParameters.forEach(parameter => {
      parsed.searchParams.delete(parameter);
    });

    return parsed.toString();
  } catch {
    return url || "";
  }
}

function deduplicateResults(searchGroups) {
  const seenUrls = new Set();
  const combined = [];

  searchGroups.forEach(group => {
    group.results.forEach(result => {
      const normalizedUrl = normalizeUrl(result.url);

      if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
        return;
      }

      seenUrls.add(normalizedUrl);

      combined.push({
        query: group.query,
        title: result.title || "Untitled",
        url: normalizedUrl,
        content: result.content || "No summary available.",
        score:
          typeof result.score === "number"
            ? result.score
            : null
      });
    });
  });

  return combined.slice(0, 20);
}

function formatEvidence(results) {
  if (results.length === 0) {
    return "No useful web results were found.";
  }

  return results
    .map((result, index) => {
      return [
        `SOURCE ${index + 1}`,
        `Search query: ${result.query}`,
        `Title: ${result.title}`,
        `URL: ${result.url}`,
        `Summary: ${result.content}`,
        result.score !== null
          ? `Search relevance score: ${result.score}`
          : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Only POST requests are allowed." },
        405
      );
    }

    try {
      if (!process.env.GROQ_API_KEY) {
        return jsonResponse(
          {
            error:
              "GROQ_API_KEY is missing in Vercel."
          },
          500
        );
      }

      if (!process.env.TAVILY_API_KEY) {
        return jsonResponse(
          {
            error:
              "TAVILY_API_KEY is missing in Vercel."
          },
          500
        );
      }

      const body = await request.json();

      const image = body.image;

      const userPrompt =
        typeof body.prompt === "string" &&
        body.prompt.trim()
          ? body.prompt.trim()
          : "Identify this image accurately.";

      const memories = Array.isArray(body.memories)
        ? body.memories
            .filter(
              memory => typeof memory === "string"
            )
            .slice(-30)
        : [];

      if (
        typeof image !== "string" ||
        !image.startsWith("data:image/")
      ) {
        return jsonResponse(
          {
            error:
              "No valid image was received."
          },
          400
        );
      }

      /*
       * STAGE 1
       * Extract objective visual evidence and create
       * five independent search queries.
       */

      const visualAnalysis = await callGroq({
        model: VISION_MODEL,
        maxTokens: 900,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You are the visual evidence extraction module of JARVIS.",
              "",
              "Your task is not to identify the image immediately.",
              "First extract only objective details that are visibly present.",
              "Do not mention a franchise, television show, film, game, band, character, person, company, or logo unless visible text proves it.",
              "Do not allow an early guess to influence every search query.",
              "",
              "Pay attention to:",
              "- exact colors",
              "- number and shape of lines",
              "- orientation",
              "- symmetry",
              "- facial or symbolic features",
              "- brush, paint, graffiti, print, or digital style",
              "- drips, breaks, curves, angles, borders, and spacing",
              "- visible letters or words",
              "- background and surrounding context",
              "",
              "Generate five meaningfully different search queries.",
              "At least two queries must be purely descriptive.",
              "At least one query should consider television or film.",
              "At least one query should consider games, music, comics, or other media.",
              "Do not repeat the same guessed identity in all five queries.",
              "",
              "Return exactly this structure:",
              "",
              "VISIBLE_FEATURES:",
              "A detailed objective description.",
              "",
              "VISIBLE_TEXT:",
              "Exact readable text, or NONE.",
              "",
              "OBJECT_CATEGORY:",
              "A broad category such as symbol, logo, character, object, scene, document, or unknown.",
              "",
              "INITIAL_POSSIBILITIES:",
              "Up to three cautious possibilities, or UNKNOWN.",
              "",
              "SEARCH_QUERIES:",
              "1. First query",
              "2. Second query",
              "3. Third query",
              "4. Fourth query",
              "5. Fifth query"
            ].join("\n")
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `User request: ${userPrompt}`,
                  "",
                  "Analyze the image using only visible evidence.",
                  "Do not confidently identify it at this stage."
                ].join("\n")
              },
              {
                type: "image_url",
                image_url: {
                  url: image
                }
              }
            ]
          }
        ]
      });

      let searchQueries =
        extractQueries(visualAnalysis);

      if (searchQueries.length < 3) {
        const visibleFeatures =
          extractSection(
            visualAnalysis,
            "VISIBLE_FEATURES"
          ) || visualAnalysis.slice(0, 500);

        searchQueries = [
          `${visibleFeatures} symbol`,
          `${visibleFeatures} television film symbol`,
          `${visibleFeatures} logo graffiti`,
          `${visibleFeatures} fictional symbol`,
          `${userPrompt} ${visibleFeatures}`
        ];
      }

      searchQueries = [
        ...new Set(
          searchQueries
            .map(query => query.trim())
            .filter(Boolean)
        )
      ].slice(0, 5);

      /*
       * STAGE 2
       * Run all searches independently.
       */

      const settledSearches =
        await Promise.allSettled(
          searchQueries.map(async query => ({
            query,
            results: await searchWeb(query)
          }))
        );

      const successfulSearches =
        settledSearches
          .filter(
            result => result.status === "fulfilled"
          )
          .map(result => result.value);

      if (successfulSearches.length === 0) {
        throw new Error(
          "All web searches failed."
        );
      }

      const combinedResults =
        deduplicateResults(successfulSearches);

      const searchEvidence =
        formatEvidence(combinedResults);

      /*
       * STAGE 3
       * Compare visual evidence against all sources.
       */

      const memoryText =
        memories.length > 0
          ? memories
              .map(memory => `- ${memory}`)
              .join("\n")
          : "- No relevant saved memories.";

      const finalReply = await callGroq({
        model: REASONING_MODEL,
        maxTokens: 1100,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You are the verification module of JARVIS.",
              "",
              "Your job is to identify an image only when the visual evidence and web evidence support the same conclusion.",
              "",
              "Important rules:",
              "- Treat the initial visual possibilities as unverified hypotheses.",
              "- Never select an answer merely because one search result mentions it.",
              "- Shared color, horror style, graffiti style, or a general smile shape is not enough.",
              "- Compare exact structure, line placement, proportions, drips, text, context, and distinctive marks.",
              "- Prefer conclusions supported by several independent sources or clearly matching descriptions.",
              "- Search-result relevance scores are not proof of visual identity.",
              "- Ignore results that only match broad keywords.",
              "- If evidence conflicts, lower confidence.",
              "- If no option has strong support, say the image could not be identified reliably.",
              "",
              "Confidence rules:",
              "- 90–100%: distinctive match supported by multiple sources.",
              "- 70–89%: strong match with minor uncertainty.",
              "- 50–69%: plausible but not verified.",
              "- Below 50%: do not give a definite identification.",
              "",
              "Return exactly this format:",
              "",
              "Visible details:",
              "...",
              "",
              "Most likely identification:",
              "... or Unable to identify reliably",
              "",
              "Confidence:",
              "...%",
              "",
              "Evidence:",
              "...",
              "",
              "Possible alternatives:",
              "...",
              "",
              "Verification note:",
              "State whether the conclusion was verified, partially supported, or unverified."
            ].join("\n")
          },
          {
            role: "user",
            content: [
              `USER REQUEST:\n${userPrompt}`,
              "",
              `OBJECTIVE VISUAL ANALYSIS:\n${visualAnalysis}`,
              "",
              `SEARCH QUERIES USED:\n${searchQueries
                .map(
                  (query, index) =>
                    `${index + 1}. ${query}`
                )
                .join("\n")}`,
              "",
              `WEB EVIDENCE:\n${searchEvidence}`,
              "",
              `SAVED USER INFORMATION:\n${memoryText}`
            ].join("\n")
          }
        ]
      });

      return jsonResponse({
        reply: finalReply,
        visualAnalysis,
        searchQueries,
        sources: combinedResults.map(result => ({
          title: result.title,
          url: result.url,
          query: result.query
        }))
      });
    } catch (error) {
      const message =
        error?.name === "TimeoutError"
          ? "The identification request timed out."
          : error?.message ||
            "Unknown identification error.";

      return jsonResponse(
        { error: message },
        500
      );
    }
  }
};
