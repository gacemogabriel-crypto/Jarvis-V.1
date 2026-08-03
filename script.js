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
talkButton.addEventListener("click", () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    statusText.textContent = "VOICE INPUT UNAVAILABLE";
    textInput.focus();

    addMessage(
      "JARVIS",
      "Voice recognition is unavailable here. Please enter your command below."
    );

    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    statusText.textContent = "LISTENING";
    talkButton.textContent = "LISTENING...";
    coreContainer.classList.add("active");
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    processCommand(transcript);
  };

  recognition.onerror = event => {
  statusText.textContent = `VOICE ERROR: ${event.error}`;

  addMessage(
    "JARVIS",
    `Voice recognition failed. Error: ${event.error}`
  );
};

  recognition.onend = () => {
    talkButton.innerHTML =
      '<span class="microphone">🎙</span> ACTIVATE VOICE';

    coreContainer.classList.remove("active");

    if (statusText.textContent === "LISTENING") {
      statusText.textContent = "AWAITING COMMAND";
    }
  };

  recognition.start();
});
