export const maxDuration = 30;

function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
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

      const body = await request.json();
      const image = body.image;

      if (
        typeof image !== "string" ||
        !image.startsWith("data:image/")
      ) {
        return jsonResponse(
          { error: "No valid image was received." },
          400
        );
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "qwen/qwen3.6-27b",
            reasoning_effort: "none",
            response_format: {
  type: "json_object"
},
            temperature: 0.2,
            max_completion_tokens: 1200,
            messages: [
              {
                role: "system",
content: "Return only JSON.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text:
                      "Create a structured knowledge entry from this image."
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
          }),
          signal: AbortSignal.timeout(25000)
        }
      );

      const responseText = await response.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        return jsonResponse(
          { error: "Groq returned invalid JSON." },
          502
        );
      }

      if (!response.ok) {
        return jsonResponse(
          {
            error:
              result?.error?.message ||
              `Groq error ${response.status}.`
          },
          response.status
        );
      }

      const rawContent =
        result?.choices?.[0]?.message?.content?.trim();

      if (!rawContent) {
        return jsonResponse(
          { error: "The model returned an empty response." },
          502
        );
      }

      const cleanedContent = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      let entry;

      try {
        entry = JSON.parse(cleanedContent);
      } catch {
        return jsonResponse(
          {
            error:
              "The model response could not be parsed as a knowledge entry."
          },
          502
        );
      }

      return jsonResponse({ entry });
    } catch (error) {
      return jsonResponse(
        {
          error:
            error?.name === "TimeoutError"
              ? "Image analysis timed out."
              : error?.message ||
                "Unknown knowledge auto-fill error."
        },
        500
      );
    }
  }
};