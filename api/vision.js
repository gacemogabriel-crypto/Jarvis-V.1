export const maxDuration = 30;

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Only POST requests are allowed." },
        { status: 405 }
      );
    }

    try {
      if (!process.env.GROQ_API_KEY) {
        return Response.json(
          { error: "GROQ_API_KEY is missing in Vercel." },
          { status: 500 }
        );
      }

      const body = await request.json();

      const image = body.image;
      const prompt =
        typeof body.prompt === "string" && body.prompt.trim()
          ? body.prompt.trim()
          : "Describe and analyze this image.";

      const memories = Array.isArray(body.memories)
        ? body.memories
            .filter(memory => typeof memory === "string")
            .slice(-50)
        : [];

      if (
        typeof image !== "string" ||
        !image.startsWith("data:image/")
      ) {
        return Response.json(
          { error: "No valid image was received." },
          { status: 400 }
        );
      }

      const savedMemories =
        memories.length > 0
          ? memories.map(memory => `- ${memory}`).join("\n")
          : "- No personal memories have been saved.";

      const systemPrompt = [
  "You are JARVIS, Gabriel's personal AI assistant.",
  "Analyze images carefully and accurately.",
  "First describe only the visible evidence before identifying anything.",
  "Do not identify a logo, character, franchise, person, location, object, or symbol unless the image provides enough evidence.",
  "If several identities are possible, list the possibilities and clearly state that you are uncertain.",
  "Never invent a confident identification based only on color or vague visual similarity.",
  "For logos and fictional symbols, examine shape, line style, text, arrangement, and surrounding context.",
  "If the user asks what something is, separate your answer into Visible details, Likely identification, and Confidence.",
  "You may describe images, read visible text, explain worksheets, examine diagrams, and answer questions about visual content.",
  "Never pretend to see details that are not visible.",
  "Keep the answer concise unless the user requests detail.",
  "",
  "Saved information about Gabriel:",
  savedMemories
].join("\n");

      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: prompt
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
            temperature: 0.2,
            max_completion_tokens: 900,
            reasoning_effort: "none"
          }),
          signal: AbortSignal.timeout(25000)
        }
      );

      const responseText = await groqResponse.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        return Response.json(
          { error: "Groq returned an invalid response." },
          { status: 502 }
        );
      }

      if (!groqResponse.ok) {
        return Response.json(
          {
            error:
              result?.error?.message ||
              `Groq vision error ${groqResponse.status}.`
          },
          { status: groqResponse.status }
        );
      }

      const reply =
        result?.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        return Response.json(
          { error: "The vision model returned an empty response." },
          { status: 502 }
        );
      }

      return Response.json({ reply });
    } catch (error) {
      const message =
        error?.name === "TimeoutError"
          ? "Image analysis timed out."
          : error?.message || "Unknown vision error.";

      return Response.json(
        { error: message },
        { status: 500 }
      );
    }
  }
};
