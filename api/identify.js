export const maxDuration = 45;

function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
}

async function callGroq(messages, model, maxTokens = 700) {
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
        temperature: 0.1,
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
    throw new Error("Groq returned an invalid response.");
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
        max_results: 6,
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
    throw new Error("Tavily returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      result?.detail ||
      result?.message ||
      `Web search failed with status ${response.status}.`
    );
  }

  return Array.isArray(result.results)
    ? result.results
    : [];
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

      const memories = Array.isArray(body.memories)
        ? body.memories
            .filter(item => typeof item === "string")
            .slice(-30)
        : [];

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
       * Stage 1:
       * Describe the image and create a useful search query.
       */
      const visualAnalysis = await callGroq(
        [
          {
            role: "system",
            content: [
              "You are the visual-analysis module of JARVIS.",
              "Examine only visible evidence.",
              "Do not confidently identify a logo, symbol, franchise, character, or object from vague similarity.",
              "Your job is to produce a detailed visual description and a web-search query.",
              "",
              "Return exactly this format:",
              "DESCRIPTION: detailed visible features",
              "INITIAL_GUESS: likely identity or UNKNOWN",
              "CONFIDENCE: number from 0 to 100",
              "SEARCH_QUERY: one precise web search query",
              "",
              "Mention colors, shapes, line arrangement, text, style, and unusual details."
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
        ],
        "qwen/qwen3.6-27b",
        600
      );

      const queryMatch = visualAnalysis.match(
        /SEARCH_QUERY:\s*(.+)/i
      );

      const searchQuery = queryMatch?.[1]?.trim()
        || `${userPrompt} ${visualAnalysis.slice(0, 300)}`;

      /*
       * Stage 2:
       * Search the web for possible matches.
       */
      const searchResults = await searchWeb(searchQuery);

      const searchEvidence = searchResults
        .map((result, index) => {
          return [
            `RESULT ${index + 1}`,
            `Title: ${result.title || "Untitled"}`,
            `URL: ${result.url || "No URL"}`,
            `Summary: ${result.content || "No summary"}`
          ].join("\n");
        })
        .join("\n\n");

      /*
       * Stage 3:
       * Compare the image evidence with the web evidence.
       */
      const memoryText =
        memories.length > 0
          ? memories
              .map(memory => `- ${memory}`)
              .join("\n")
          : "- No relevant saved memories.";

      const finalReply = await callGroq(
        [
          {
            role: "system",
            content: [
              "You are JARVIS, Gabriel's personal AI assistant.",
              "Identify visual material by comparing visual evidence with web-search evidence.",
              "Do not accept a search result merely because it shares a color or general style.",
              "Compare exact shapes, layout, markings, text, and context.",
              "If the evidence is insufficient, say that clearly.",
              "Do not invent certainty.",
              "",
              "Give the answer in this format:",
              "Identification: ...",
              "Reasoning: ...",
              "Confidence: ...%",
              "Possible alternatives: ...",
              "",
              "Keep the answer fairly concise."
            ].join("\n")
          },
          {
            role: "user",
            content: [
              `User request:\n${userPrompt}`,
              "",
              `Visual analysis:\n${visualAnalysis}`,
              "",
              `Web evidence:\n${searchEvidence || "No useful search results were found."}`,
              "",
              `Saved information about Gabriel:\n${memoryText}`
            ].join("\n")
          }
        ],
        "openai/gpt-oss-20b",
        800
      );

      return jsonResponse({
        reply: finalReply,
        visualAnalysis,
        searchQuery,
        sources: searchResults.map(result => ({
          title: result.title || "",
          url: result.url || ""
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
