const hudClock = document.getElementById("hudClock");
const hudCommandInput = document.getElementById("hudCommandInput");
const hudSendButton = document.getElementById("hudSendButton");
const hudResponse = document.getElementById("hudResponse");
const hudState = document.getElementById("hudState");
const hudActivity = document.getElementById("hudActivity");
const hudCore = document.querySelector(".hud-core");

function updateClock() {
  const now = new Date();

  hudClock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setHudState(state, activity) {
  hudState.textContent = state;
  hudActivity.textContent = activity;
}

async function executeCommand() {
  const command = hudCommandInput.value.trim();

  if (!command) return;

  hudCommandInput.value = "";
  hudSendButton.disabled = true;
  hudCore.classList.add("thinking");

  setHudState("PROCESSING", `Analyzing command: ${command}`);
  hudResponse.textContent = "Processing...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: command
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "JARVIS could not process the command."
      );
    }

    hudResponse.textContent =
      result.reply ||
      result.response ||
      result.message ||
      "Command completed.";

    setHudState("ONLINE", "Command completed successfully.");
  } catch (error) {
    console.error(error);

    hudResponse.textContent =
      error.message || "Connection error.";

    setHudState("ERROR", "Unable to complete command.");
  } finally {
    hudSendButton.disabled = false;
    hudCore.classList.remove("thinking");
    hudCommandInput.focus();
  }
}

hudSendButton.addEventListener("click", executeCommand);

hudCommandInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    executeCommand();
  }
});

updateClock();
setInterval(updateClock, 1000);