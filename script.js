const bootScreen = document.getElementById("bootScreen");
const talkButton = document.getElementById("talkButton");
const sendButton = document.getElementById("sendButton");
const textInput = document.getElementById("textInput");
const chat = document.getElementById("chat");
const statusText = document.getElementById("statusText");
const clock = document.getElementById("clock");
const dateText = document.getElementById("date");
const coreContainer = document.getElementById("coreContainer");

// Hide the startup screen
setTimeout(() => {
  bootScreen.classList.add("hidden");
}, 3000);

// Update clock and date
function updateTime() {
  const now = new Date();

  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  dateText.textContent = now.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

updateTime();
setInterval(updateTime, 1000);

// Add messages to the communication log
function addMessage(speaker, message) {
  const messageElement = document.createElement("div");
  messageElement.className = "message";

  messageElement.innerHTML = `
    <span class="speaker">${speaker}</span>
    ${message}
  `;

  chat.appendChild(messageElement);
  chat.scrollTop = chat.scrollHeight;
}

// Make JARVIS speak
function speak(message) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = "en-GB";
  speech.rate = 0.92;
  speech.pitch = 0.82;
  speech.volume = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}

// Temporary JARVIS responses
function getJarvisResponse(command) {
  const text = command.toLowerCase();

  if (text.includes("hello") || text.includes("hi jarvis")) {
    return "Hello. All systems are functioning normally.";
  }

  if (text.includes("how are you")) {
    return "I am operating within normal parameters.";
  }

  if (text.includes("your name")) {
    return "I am JARVIS, your personal digital assistant.";
  }

  if (text.includes("time")) {
    return `The current time is ${clock.textContent}.`;
  }

  if (text.includes("date") || text.includes("day")) {
    return `Today is ${new Date().toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    })}.`;
  }

  if (text.includes("dragon ball")) {
    return "Dragon Ball detected. An excellent choice.";
  }

  if (text.includes("who is tony stark")) {
    return "Tony Stark is the creator of the original JARVIS system in the Marvel universe.";
  }

  if (text.includes("thank")) {
    return "You are welcome.";
  }

  if (text.includes("goodbye") || text.includes("bye")) {
    return "Goodbye. I will remain available.";
  }

  return "My artificial intelligence connection has not been installed yet. For now, I can only answer basic commands.";
}

// Process typed or spoken commands
function processCommand(command) {
  const cleanCommand = command.trim();

  if (!cleanCommand) {
    return;
  }

  addMessage("YOU", cleanCommand);

  statusText.textContent = "PROCESSING COMMAND";
  coreContainer.classList.add("active");

  setTimeout(() => {
    const response = getJarvisResponse(cleanCommand);

    addMessage("JARVIS", response);
    speak(response);

    statusText.textContent = "AWAITING COMMAND";
    coreContainer.classList.remove("active");
  }, 700);
}

// Send button
sendButton.addEventListener("click", () => {
  processCommand(textInput.value);
  textInput.value = "";
});

// Press Enter to send
textInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    processCommand(textInput.value);
    textInput.value = "";
  }
});

// Voice recognition
let mediaRecorder;
let audioChunks = [];
let microphoneStream;
let isRecording = false;

function chooseRecordingType() {
  const types = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm"
  ];

  for (const type of types) {
    if (
      window.MediaRecorder &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }

  return "";
}

async function startRecording() {
  try {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      !window.MediaRecorder
    ) {
      throw new Error(
        "Audio recording is not supported on this browser."
      );
    }

    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    const mimeType = chooseRecordingType();

    const recorderOptions = mimeType
      ? { mimeType }
      : undefined;

    mediaRecorder = new MediaRecorder(
      microphoneStream,
      recorderOptions
    );

    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = sendRecording;

    mediaRecorder.start();

    isRecording = true;

    statusText.textContent = "RECORDING";
    talkButton.textContent = "⏹ STOP RECORDING";
    coreContainer.classList.add("active");
  } catch (error) {
    console.error(error);

    statusText.textContent = "MICROPHONE ERROR";

    addMessage(
      "JARVIS",
      error.message ||
        "I could not access the microphone."
    );
  }
}

function stopRecording() {
  if (
    !mediaRecorder ||
    mediaRecorder.state === "inactive"
  ) {
    return;
  }

  statusText.textContent = "PROCESSING AUDIO";
  talkButton.textContent = "PROCESSING...";

  mediaRecorder.stop();

  if (microphoneStream) {
    microphoneStream
      .getTracks()
      .forEach(track => track.stop());
  }

  isRecording = false;
}

async function sendRecording() {
  try {
    const recordingType =
      mediaRecorder.mimeType || "audio/mp4";

    const audioBlob = new Blob(audioChunks, {
      type: recordingType
    });

    if (audioBlob.size === 0) {
      throw new Error("The recording was empty.");
    }

    const fileExtension =
      recordingType.includes("webm")
        ? "webm"
        : "m4a";

    const audioFile = new File(
      [audioBlob],
      `jarvis-recording.${fileExtension}`,
      { type: recordingType }
    );

    const formData = new FormData();
    formData.append("file", audioFile);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Transcription failed."
      );
    }

    const transcript = result.text?.trim();

    if (!transcript) {
      throw new Error(
        "I could not detect any speech."
      );
    }

    textInput.value = transcript;
    processCommand(transcript);
  } catch (error) {
    console.error(error);

    statusText.textContent = "TRANSCRIPTION ERROR";

    addMessage(
      "JARVIS",
      error.message ||
        "I could not transcribe the recording."
    );
  } finally {
    audioChunks = [];
    coreContainer.classList.remove("active");

    talkButton.innerHTML =
      '<span class="microphone">🎙</span> ACTIVATE VOICE';

    if (
      statusText.textContent === "PROCESSING AUDIO"
    ) {
      statusText.textContent = "AWAITING COMMAND";
    }
  }
}

talkButton.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});
});
