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

const imageInput = document.getElementById("imageInput");
const selectImageButton =
  document.getElementById("selectImageButton");
const analyzeImageButton =
  document.getElementById("analyzeImageButton");
const removeImageButton =
  document.getElementById("removeImageButton");
const imagePreview = document.getElementById("imagePreview");
const imagePreviewContainer =
  document.getElementById("imagePreviewContainer");
const visionPrompt = document.getElementById("visionPrompt");
const visionStatus = document.getElementById("visionStatus");

const conversationHistory = [];

let jarvisMemories = JSON.parse(
  localStorage.getItem("jarvisMemories") || "[]"
);

let selectedImageData = "";
let mediaRecorder = null;
let audioChunks = [];
let microphoneStream = null;
let isRecording = false;

/* STARTUP */

setTimeout(() => {
  bootScreen.classList.add("hidden");
}, 3000);

/* CLOCK */

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

/* CHAT */

function addMessage(speaker, message) {
  const messageElement = document.createElement("div");
  messageElement.className = "message";

  const speakerElement = document.createElement("span");
  speakerElement.className = "speaker";
  speakerElement.textContent = speaker;

  const textElement = document.createElement("span");
  textElement.textContent = message;

  messageElement.appendChild(speakerElement);
  messageElement.appendChild(textElement);

  chat.appendChild(messageElement);
  chat.scrollTop = chat.scrollHeight;
}

function speak(message) {
  if (!("speechSynthesis" in window)) return;

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = "en-GB";
  speech.rate = 0.92;
  speech.pitch = 0.82;
  speech.volume = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}

/* MEMORY */

function saveMemories() {
  localStorage.setItem(
    "jarvisMemories",
    JSON.stringify(jarvisMemories)
  );
}

function renderMemories() {
  memoryList.innerHTML = "";

  if (jarvisMemories.length === 0) {
    const emptyText = document.createElement("p");
    emptyText.className = "empty-memory";
    emptyText.textContent = "No saved memories yet.";

    memoryList.appendChild(emptyText);
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

/* AI CHAT */

async function getJarvisResponse(command) {
  const lowerCommand = command.toLowerCase().trim();

  if (lowerCommand.startsWith("remember that ")) {
    return rememberFact(command.slice(14));
  }

  if (lowerCommand.startsWith("remember ")) {
    return rememberFact(command.slice(9));
  }

  if (lowerCommand.startsWith("forget that ")) {
    return forgetFact(command.slice(12));
  }

  if (lowerCommand.startsWith("forget ")) {
    return forgetFact(command.slice(7));
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

/* MICROPHONE RECORDING */

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

/* IMAGE COMPRESSION */

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("The image could not be read."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("The selected file is not a valid image."));
      };

      image.onload = () => {
        const maximumSize = 1600;

        let width = image.width;
        let height = image.height;

        if (width > maximumSize || height > maximumSize) {
          const scale = Math.min(
            maximumSize / width,
            maximumSize / height
          );

          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        context.drawImage(image, 0, 0, width, height);

        const compressedData =
          canvas.toDataURL("image/jpeg", 0.82);

        resolve(compressedData);
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

/* VISION */

selectImageButton.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    visionStatus.textContent = "PREPARING IMAGE";
    selectImageButton.disabled = true;

    selectedImageData = await compressImage(file);

    imagePreview.src = selectedImageData;
    imagePreviewContainer.classList.remove("hidden");

    analyzeImageButton.disabled = false;
    visionStatus.textContent = "IMAGE READY";
  } catch (error) {
    console.error(error);

    selectedImageData = "";
    visionStatus.textContent = "IMAGE ERROR";

    addMessage(
      "JARVIS",
      error.message || "I could not prepare that image."
    );
  } finally {
    selectImageButton.disabled = false;
  }
});

removeImageButton.addEventListener("click", () => {
  selectedImageData = "";
  imageInput.value = "";
  imagePreview.src = "";

  imagePreviewContainer.classList.add("hidden");
  analyzeImageButton.disabled = true;
  visionStatus.textContent = "NO IMAGE SELECTED";
});

analyzeImageButton.addEventListener("click", async () => {
  if (!selectedImageData) return;

  const prompt =
    visionPrompt.value.trim() ||
    "Describe and analyze this image.";

  visionStatus.textContent = "ANALYZING";
  statusText.textContent = "VISUAL ANALYSIS";
  analyzeImageButton.disabled = true;
  selectImageButton.disabled = true;
  coreContainer.classList.add("active");

  addMessage("YOU", `[Image] ${prompt}`);

  try {
    const response = await fetch("/api/vision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: selectedImageData,
        prompt,
        memories: jarvisMemories
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Image analysis failed."
      );
    }

    addMessage("JARVIS", result.reply);
    speak(result.reply);

    visionStatus.textContent = "ANALYSIS COMPLETE";
    statusText.textContent = "AWAITING COMMAND";
  } catch (error) {
    console.error(error);

    visionStatus.textContent = "ANALYSIS ERROR";
    statusText.textContent = "VISION ERROR";

    addMessage(
      "JARVIS",
      error.message || "I could not analyze the image."
    );
  } finally {
    analyzeImageButton.disabled = false;
    selectImageButton.disabled = false;
    coreContainer.classList.remove("active");
  }
});

/* CLEAR MEMORIES */

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

renderMemories();
