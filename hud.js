const hudClock = document.getElementById("hudClock");
const hudDate = document.getElementById("hudDate");

const commandForm = document.getElementById("hudCommandForm");
const commandInput = document.getElementById("hudCommandInput");
const sendButton = document.getElementById("hudSendButton");

const responsePanel = document.querySelector("#hudResponse p");
const hudState = document.getElementById("hudState");
const hudCore = document.getElementById("hudCore");

const activityFeed = document.getElementById("activityFeed");
const activeModule = document.getElementById("activeModule");

const moduleButtons =
  document.querySelectorAll(".module-button");

const actionButtons =
  document.querySelectorAll("[data-action]");

function updateClock() {
  const now = new Date();

  hudClock.textContent =
    now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

  hudDate.textContent =
    now.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
}

function addActivity(label, message) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  const text = document.createElement("span");

  time.textContent = label;
  text.textContent = message;

  item.append(time, text);

  activityFeed.prepend(item);

  while (activityFeed.children.length > 7) {
    activityFeed.lastElementChild.remove();
  }
}

function setSystemState(state, message, mode = "normal") {

  hudState.textContent = state;

  responsePanel.textContent = message;

  hudCore.classList.toggle(
    "thinking",
    mode === "thinking"
  );

  hudCore.classList.toggle(
    "error",
    mode === "error"
  );
}

async function executeCommand(event) {

  event.preventDefault();

  const command =
    commandInput.value.trim();

  if (!command) return;

  sendButton.disabled = true;

  commandInput.value = "";

  setSystemState(
    "PROCESSING",
    "Analyzing command...",
    "thinking"
  );

  addActivity(
    "SCAN",
    `Processing: ${command}`
  );

  try {

    const response =
      await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          message: command
        })
      });

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        "JARVIS could not process the command."
      );

    }

    const answer =
      result.reply ||
      result.response ||
      result.message ||
      "Command completed.";

    setSystemState(
      "ONLINE",
      answer
    );

    addActivity(
      "DONE",
      "Command completed successfully."
    );

  } catch (error) {

    console.error(error);

    setSystemState(
      "ERROR",
      error.message ||
      "Unable to complete command.",
      "error"
    );

    addActivity(
      "ERROR",
      error.message
    );

  } finally {

    sendButton.disabled = false;

    window.setTimeout(() => {

      hudCore.classList.remove(
        "thinking"
      );

      hudCore.classList.remove(
        "error"
      );

    }, 1200);

    commandInput.focus();

  }

}

commandForm.addEventListener(
  "submit",
  executeCommand
);

moduleButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      moduleButtons.forEach(b =>
        b.classList.remove("active")
      );

      button.classList.add("active");

      const label =
        button.innerText.trim();

      activeModule.textContent =
        label.toUpperCase();

      addActivity(
        "MODE",
        `${label} selected`
      );

    }
  );

});

actionButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const action =
        button.dataset.action;

      addActivity(
        "INPUT",
        `${action} activated`
      );

    }
  );

});

updateClock();

setInterval(
  updateClock,
  1000
);