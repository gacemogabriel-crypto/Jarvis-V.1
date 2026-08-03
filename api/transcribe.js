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

      const incomingForm = await request.formData();
      const audioFile = incomingForm.get("file");

      if (!audioFile || audioFile.size === 0) {
        return Response.json(
          { error: "No valid audio recording was received." },
          { status: 400 }
        );
      }

      const groqForm = new FormData();

      groqForm.append(
        "file",
        audioFile,
        audioFile.name || "jarvis-recording.m4a"
      );

      groqForm.append("model", "whisper-large-v3-turbo");
      groqForm.append("response_format", "json");
      groqForm.append("language", "en");

      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: groqForm,
          signal: AbortSignal.timeout(25000)
        }
      );

      const responseText = await groqResponse.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        return Response.json(
          {
            error: `Groq returned an invalid response: ${responseText.slice(
              0,
              200
            )}`
          },
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

      return Response.json({
        text: result.text || ""
      });
    } catch (error) {
      const message =
        error?.name === "TimeoutError"
          ? "The transcription request timed out."
          : error?.message || "Unknown transcription error.";

      return Response.json(
        { error: message },
        { status: 500 }
      );
    }
  }
};
