export const maxDuration = 60;

const VISION_MODEL = "qwen/qwen3.6-27b";
const REASONING_MODEL = "openai/gpt-oss-20b";

function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${label} returned invalid JSON: ${text.slice(0, 180)}`
    );
  }
}

async function callGroq({
  messages,
  model,
  maxTokens = 900,
  temperature = 0
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
  const result = parseJson(responseText, "Groq");

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

async function searchWeb(query, maxResults = 5) {
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
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        include_images: true,
        include_image_descriptions: true
      }),
      signal: AbortSignal.timeout(20000)
    }
  );

  const responseText = await response.text();
  const result = parseJson(responseText, "Tavily");

  if (!response.ok) {
    throw new Error(
      result?.detail ||
        result?.message ||
        `Search failed with status ${response.status}.`
    );
  }

  return {
    results: Array.isArray(result.results)
      ? result.results
      : [],
    images: Array.isArray(result.images)
      ? result.images
      : []
  };
}

function cleanJsonBlock(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseModelJson(text, label) {
  return parseJson(cleanJsonBlock(text), label);
}

function uniqueStrings(values, limit) {
  return [
    ...new Set(
      values
        .filter(value => typeof value === "string")
        .map(value => value.trim())
        .filter(Boolean)
    )
  ].slice(0, limit);
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    parsed.hash = "";

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref"
    ].forEach(parameter => {
      parsed.searchParams.delete(parameter);
    });

    return parsed.toString();
  } catch {
    return url || "";
  }
}

function combineSearches(searches) {
  const seenUrls = new Set();
  const results = [];
  const images = [];

  for (const search of searches) {
    for (const result of search.data.results) {
      const url = normalizeUrl(result.url);

      if (!url || seenUrls.has(url)) {
        continue;
      }

      seenUrls.add(url);

      results.push({
        query: search.query,
        title: result.title || "Untitled",
        url,
        content:
          result.content || "No summary available."
      });
    }

    for (const image of search.data.images) {
      if (typeof image === "string") {
        images.push({
          query: search.query,
          url: image,
          description: ""
        });
      } else if (image?.url) {
        images.push({
          query: search.query,
          url: image.url,
          description: image.description || ""
        });
      }
    }
  }

  return {
    results: results.slice(0, 25),
    images: images.slice(0, 25)
  };
}

function formatResults(results) {
  if (results.length === 0) {
    return "No useful text results were found.";
  }

  return results
    .map((result, index) => {
      return [
        `SOURCE ${index + 1}`,
        `Query: ${result.query}`,
        `Title: ${result.title}`,
        `URL: ${result.url}`,
        `Summary: ${result.content}`
      ].join("\n");
    })
    .join("\n\n");
}

function formatImages(images) {
  if (images.length === 0) {
    return "No image descriptions were returned.";
  }

  return images
    .map((image, index) => {
      return [
        `IMAGE RESULT ${index + 1}`,
        `Query: ${image.query}`,
        `URL: ${image.url}`,
        `Description: ${
          image.description || "No description available."
        }`
      ].join("\n");
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
          { error: "GROQ_API_KEY is missing in Vercel." },
          500
        );
      }

      if (!process.env.TAVILY_API_KEY) {
        return jsonResponse(
          { error: "TAVILY_API_KEY is missing in Vercel." },
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

      if (
        typeof image !== "string" ||
        !image.startsWith("data:image/")
      ) {
        return jsonResponse(
          { error: "No valid image was received." },
          400
        );
      }

      /*
       * STAGE 1
       * Extract visible features without committing
       * to one identity.
       */

      const extractionText = await callGroq({
        model: VISION_MODEL,
        maxTokens: 1000,
        messages: [
          {
            role: "system",
            content: [
              "You are JARVIS's objective visual examiner.",
              "Describe only details that are visibly present.",
              "Do not let a possible identity alter the description.",
              "",
              "Return valid JSON only using this structure:",
              "{",
              '  "visibleFeatures": ["feature"],',
              '  "visibleText": ["text"],',
              '  "category": "broad category",',
              '  "candidates": ["candidate or UNKNOWN"],',
              '  "searchQueries": ["query"]',
              "}",
              "",
              "Rules:",
              "- Include exact colors, shapes, line counts, curves, drips, spacing, symmetry, orientation and background.",
              "- Candidates must be cautious.",
              "- Include no more than five candidates.",
              "- Produce five different search queries.",
              "- At least three queries must not contain a candidate name.",
              "- Include one television or film query.",
              "- Include one games, music or comics query."
            ].join("\n")
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt
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

      const extraction = parseModelJson(
        extractionText,
        "Visual analysis"
      );

      const visibleFeatures = Array.isArray(
        extraction.visibleFeatures
      )
        ? extraction.visibleFeatures
        : [];

      let candidates = uniqueStrings(
        Array.isArray(extraction.candidates)
          ? extraction.candidates
          : [],
        5
      ).filter(
        candidate =>
          candidate.toUpperCase() !== "UNKNOWN"
      );

      const generalQueries = uniqueStrings(
        Array.isArray(extraction.searchQueries)
          ? extraction.searchQueries
          : [],
        5
      );

      /*
       * STAGE 2
       * Broad searches based mainly on visible details.
       */

      const broadSettled = await Promise.allSettled(
        generalQueries.map(async query => ({
          query,
          data: await searchWeb(query)
        }))
      );

      const broadSearches = broadSettled
        .filter(result => result.status === "fulfilled")
        .map(result => result.value);

      const broadEvidence = combineSearches(broadSearches);

      /*
       * STAGE 3
       * Use broad evidence to propose additional
       * candidates without choosing a winner.
       */

      const candidateText = await callGroq({
        model: REASONING_MODEL,
        maxTokens: 700,
        messages: [
          {
            role: "system",
            content: [
              "Generate possible identities for a visual symbol.",
              "Do not choose a final answer.",
              "Discard suggestions that match only the mood, genre or color.",
              "",
              "Return valid JSON only:",
              '{ "candidates": ["candidate"] }',
              "",
              "Return no more than six candidates."
            ].join("\n")
          },
          {
            role: "user",
            content: [
              "VISIBLE FEATURES:",
              visibleFeatures.join("\n"),
              "",
              "INITIAL CANDIDATES:",
              candidates.join("\n") || "None",
              "",
              "BROAD SEARCH EVIDENCE:",
              formatResults(
                broadEvidence.results.slice(0, 15)
              )
            ].join("\n")
          }
        ]
      });

      const suggestedCandidates = parseModelJson(
        candidateText,
        "Candidate generation"
      );

      candidates = uniqueStrings(
        [
          ...candidates,
          ...(Array.isArray(
            suggestedCandidates.candidates
          )
            ? suggestedCandidates.candidates
            : [])
        ],
        6
      );

      /*
       * STAGE 4
       * Search every candidate separately for its
       * actual symbol and visual description.
       */

      const candidateSettled =
        await Promise.allSettled(
          candidates.map(async candidate => {
            const query = [
              `"${candidate}"`,
              "symbol logo appearance",
              "red painted dripping smile",
              "image visual description"
            ].join(" ");

            return {
              candidate,
              query,
              data: await searchWeb(query, 6)
            };
          })
        );

      const candidateSearches = candidateSettled
        .filter(result => result.status === "fulfilled")
        .map(result => result.value);

      const candidateEvidence =
        combineSearches(candidateSearches);

      /*
       * STAGE 5
       * Verify each candidate and reject those whose
       * actual design does not match the image.
       */

      const finalReply = await callGroq({
        model: REASONING_MODEL,
        maxTokens: 1300,
        messages: [
          {
            role: "system",
            content: [
              "You are JARVIS's strict visual identity verifier.",
              "",
              "Evaluate every candidate separately.",
              "A candidate must be rejected when sources do not show or describe the same design.",
              "",
              "Do not accept a candidate because:",
              "- it belongs to a similar genre",
              "- it involves a serial killer",
              "- it uses red coloring",
              "- it has a horror theme",
              "- it contains a generic smile",
              "",
              "Compare exact visual structure:",
              "- eye shape and direction",
              "- mouth length and curvature",
              "- number and position of drips",
              "- brush or paint style",
              "- symmetry",
              "- surrounding marks",
              "- text",
              "- documented meaning and context",
              "",
              "A final identification requires direct support from at least two useful sources, or one exceptionally clear authoritative source.",
              "If no candidate passes, say Unable to identify reliably.",
              "Never invent evidence.",
              "",
              "Return exactly this format:",
              "",
              "Visible details:",
              "...",
              "",
              "Candidate checks:",
              "- Candidate: PASS or REJECT — reason",
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
              "Verified, partially supported, or unverified."
            ].join("\n")
          },
          {
            role: "user",
            content: [
              `USER REQUEST:\n${userPrompt}`,
              "",
              `VISIBLE FEATURES:\n${visibleFeatures.join(
                "\n"
              )}`,
              "",
              `VISIBLE TEXT:\n${
                Array.isArray(extraction.visibleText)
                  ? extraction.visibleText.join("\n")
                  : "None"
              }`,
              "",
              `CANDIDATES TO VERIFY:\n${candidates.join(
                "\n"
              )}`,
              "",
              `BROAD TEXT EVIDENCE:\n${formatResults(
                broadEvidence.results
              )}`,
              "",
              `BROAD IMAGE DESCRIPTIONS:\n${formatImages(
                broadEvidence.images
              )}`,
              "",
              `CANDIDATE-SPECIFIC TEXT EVIDENCE:\n${formatResults(
                candidateEvidence.results
              )}`,
              "",
              `CANDIDATE-SPECIFIC IMAGE DESCRIPTIONS:\n${formatImages(
                candidateEvidence.images
              )}`
            ].join("\n")
          }
        ]
      });

      return jsonResponse({
        reply: finalReply,
        visibleFeatures,
        candidates,
        broadQueries: generalQueries,
        sources: [
          ...broadEvidence.results,
          ...candidateEvidence.results
        ]
          .slice(0, 30)
          .map(result => ({
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

      return jsonResponse({ error: message }, 500);
    }
  }
};
