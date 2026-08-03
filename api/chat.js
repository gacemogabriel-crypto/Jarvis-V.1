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
      const userMessage = body.message?.trim();
      const history = Array.isArray(body.history)
        ? body.history.slice(-10)
        : [];

      if (!userMessage) {
        return Response.json(
          { error: "No message was provided." },
          { status: 400 }
        );
      }

      const messages = [
        {
          role: "system",
          content: `
You are JARVIS, Gabriel's personal AI assistant.

Personality:
- Calm, intelligent and composed.
- Helpful without sounding overly enthusiastic.
- Speak naturally and keep answers concise unless detail is requested.
- Address the user as Gabriel occasionally, but not constantly.
- Use a refined British-assistant tone.
- Never claim that you can control devices or access information unless that feature is actually available.
- The user likes Dragon Ball.
`
        },
        ...history,
        {
          role: "user",
          content: userMessage
        }
      ];

      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages,
            temperature: 0.7,
            max_completion_tokens: 500
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
              `Groq error ${groqResponse.status}.`
          },
          { status: groqResponse.status }
        );
      }

      const reply =
        result.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        return Response.json(
          { error: "The AI returned an empty response." },
          { status: 502 }
        );
      }

      return Response.json({ reply });
    } catch (error) {
      const message =
        error?.name === "TimeoutError"
          ? "The AI request timed out."
          : error?.message || "Unknown AI error.";

      return Response.json(
        { error: message },
        { status: 500 }
      );
    }
  }
};
