const bootScreen = document.getElementById("bootScreen");
const talkButton = document.getElementById("talkButton");
const sendButton = document.getElementById("sendButton");
const textInput = document.getElementById("textInput");
const chat = document.getElementById("chat");
const statusText = document.getElementById("statusText");
const clock = document.getElementById("clock");
const dateText = document.getElementById("date");
const coreContainer = document.getElementById("coreContainer");
const memoryList = document.getElementById("memoryList");
const clearMemoriesButton =
  document.getElementById("clearMemoriesButton");
setTimeout(() => {
  bootScreen.classList.add("hidden");
}, 3000);

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

function speak(message) {
  if (!("speechSynthesis" in window)) return;

  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = "en-GB";
  speech.rate = 0.92;
  speech.pitch = 0.82;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}

const conversationHistory = [];

let jarvisMemories = JSON.parse(
  localStorage.getItem("jarvisMemories") || "[]"
);

function saveMemories() {
  localStorage.setItem(
    "jarvisMemories",
    JSON.stringify(jarvisMemories)
  );
}
function renderMemories() {
  memoryList.innerHTML = "";

  if (jarvisMemories.length === 0) {
    memoryList.innerHTML =
      '<p class="empty-memory">No saved memories yet.</p>';
    return;
  }

  jarvisMemories.forEach((memory, index) => {
    const item = document.createElement("div");
    item.className = "memory-item";

    const text = document.createElement("div");
    text.className = "memory-text";
    text.textContent = memory;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-memory";
    deleteButton.textContent = "DELETE";

    deleteButton.addEventListener("click", () => {
      jarvisMemories.splice(index, 1);
      saveMemories();
      renderMemories();
    });

    item.appendChild(text);
    item.appendChild(deleteButton);
    memoryList.appendChild(item);
  });
}
function rememberFact(fact) {
  const cleanFact = fact.trim();

  if (!cleanFact) {
    return "I need something specific to remember.";
  }

  const alreadyExists = jarvisMemories.some(
    memory =>
      memory.toLowerCase() === cleanFact.toLowerCase()
  );

  if (alreadyExists) {
    return "I already remember that.";
  }

  jarvisMemories.push(cleanFact);

  if (jarvisMemories.length > 50) {
    jarvisMemories.shift();
  }

  saveMemories();
renderMemories();
  return `Understood. I will remember that ${cleanFact}.`;
}

function forgetFact(searchText) {
  const query = searchText.trim().toLowerCase();

  if (!query) {
    return "Tell me what you want me to forget.";
  }

  const originalLength = jarvisMemories.length;

  jarvisMemories = jarvisMemories.filter(
    memory => !memory.toLowerCase().includes(query)
  );

  saveMemories();
renderMemories();
  if (jarvisMemories.length === originalLength) {
    return "I could not find a matching memory.";
  }

  return "That information has been removed from my memory.";
}

function listMemories() {
  if (jarvisMemories.length === 0) {
    return "I have not saved any personal memories yet.";
  }

  return `Here is what I remember: ${jarvisMemories.join("; ")}.`;
}

async function getJarvisResponse(command) {
  const lowerCommand = command.toLowerCase().trim();

  if (lowerCommand.startsWith("remember that ")) {
    const fact = command.slice(14);
    return rememberFact(fact);
  }

  if (lowerCommand.startsWith("remember ")) {
    const fact = command.slice(9);
    return rememberFact(fact);
  }

  if (lowerCommand.startsWith("forget that ")) {
    const fact = command.slice(12);
    return forgetFact(fact);
  }

  if (lowerCommand.startsWith("forget ")) {
    const fact = command.slice(7);
    return forgetFact(fact);
  }

  if (
    lowerCommand.includes("what do you remember") ||
    lowerCommand.includes("show my memories") ||
    lowerCommand.includes("what do you know about me")
  ) {
    return listMemories();
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: command,
      history: conversationHistory,
      memories: jarvisMemories
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "JARVIS could not process the request."
    );
  }

  conversationHistory.push({
    role: "user",
    content: command
  });

  conversationHistory.push({
    role: "assistant",
    content: result.reply
  });

  if (conversationHistory.length > 20) {
    conversationHistory.splice(
      0,
      conversationHistory.length - 20
    );
  }

  return result.reply;
}

async function processCommand(command) {
  const cleanCommand = command.trim();

  if (!cleanCommand) return;

  addMessage("YOU", cleanCommand);

  statusText.textContent = "THINKING";
  coreContainer.classList.add("active");
  talkButton.disabled = true;
  sendButton.disabled = true;

  try {
    const response = await getJarvisResponse(cleanCommand);

    addMessage("JARVIS", response);
    speak(response);

    statusText.textContent = "AWAITING COMMAND";
  } catch (error) {
    console.error(error);

    statusText.textContent = "AI CONNECTION ERROR";

    addMessage(
      "JARVIS",
      error.message ||
        "I could not connect to my intelligence system."
    );
  } finally {
    coreContainer.classList.remove("active");
    talkButton.disabled = false;
    sendButton.disabled = false;
  }
}
sendButton.addEventListener("click", () => {
  processCommand(textInput.value);
  textInput.value = "";
});

textInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    processCommand(textInput.value);
    textInput.value = "";
  }
});

let mediaRecorder = null;
let audioChunks = [];
let microphoneStream = null;
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
    const options = mimeType ? { mimeType } : undefined;

    mediaRecorder = new MediaRecorder(
      microphoneStream,
      options
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
      error.message || "I could not access the microphone."
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

    const extension =
      recordingType.includes("webm") ? "webm" : "m4a";

    const audioFile = new File(
      [audioBlob],
      `jarvis-recording.${extension}`,
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
      throw new Error("I could not detect any speech.");
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

    if (statusText.textContent === "PROCESSING AUDIO") {
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
clearMemoriesButton.addEventListener("click", () => {
  const confirmed = confirm(
    "Delete every saved JARVIS memory?"
  );

  if (!confirmed) return;

  jarvisMemories = [];
  saveMemories();
  renderMemories();

  addMessage(
    "JARVIS",
    "All saved memories have been deleted."
  );
});

rendermemories();
