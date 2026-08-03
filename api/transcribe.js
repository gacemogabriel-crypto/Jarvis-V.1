export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Only POST requests are allowed." },
      { status: 405 }
    );
  }

  try {
    const incomingForm = await request.formData();
    const audioFile = incomingForm.get("file");

    if (!audioFile) {
      return Response.json(
        { error: "No recording was received." },
        { status: 400 }
      );
    }

    const groqForm = new FormData();

    groqForm.append(
      "file",
      audioFile,
      audioFile.name || "recording.mp4"
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
        body: groqForm
      }
    );

    const result = await groqResponse.json();

    if (!groqResponse.ok) {
      return Response.json(
        {
          error:
            result?.error?.message ||
            "Groq could not transcribe the recording."
        },
        { status: groqResponse.status }
      );
    }

    return Response.json({
      text: result.text || ""
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown transcription error."
      },
      { status: 500 }
    );
  }
}
