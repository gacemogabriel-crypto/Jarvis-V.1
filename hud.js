import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js";
const hudClock = document.getElementById("hudClock");
const hudDate = document.getElementById("hudDate");

const commandForm = document.getElementById("hudCommandForm");
const commandInput = document.getElementById("hudCommandInput");
const sendButton = document.getElementById("hudSendButton");

const responsePanel = document.querySelector("#hudResponse p");
const hudState = document.getElementById("hudState");
const hudCore = document.getElementById("hudCore");
const bootScreen = document.getElementById("bootScreen");
const bootMessage = document.getElementById("bootMessage");
const bootProgress = document.getElementById("bootProgress");
const bootPercent = document.getElementById("bootPercent");
const bootLog = document.getElementById("bootLog");
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
async function runBootSequence() {
  const steps = [
    { progress: 12, message: "INITIALIZING CORE..." },
    { progress: 28, message: "LOADING MEMORY..." },
    { progress: 46, message: "CONNECTING KNOWLEDGE..." },
    { progress: 63, message: "ACTIVATING VISION..." },
    { progress: 79, message: "CALIBRATING VOICE..." },
    { progress: 92, message: "RUNNING DIAGNOSTICS..." },
    { progress: 100, message: "SYSTEM ONLINE" }
  ];

  for (const step of steps) {
    bootMessage.textContent = step.message;
    bootProgress.style.width = `${step.progress}%`;
    bootPercent.textContent = `${step.progress}%`;
    const logLine = document.createElement("p");
const statuses = [
  "[SYS]",
  "[MEM]",
  "[NET]",
  "[VIS]",
  "[VOC]",
  "[CHK]",
  "[JVS]"
];

const index = steps.indexOf(step);

logLine.textContent =
  `${getBootTime()}  ${statuses[index]}  ${step.message}`;
bootLog.appendChild(logLine);
bootLog.scrollTop = bootLog.scrollHeight;

    await new Promise(resolve => {
      setTimeout(resolve, 550);
    });
  }

  await new Promise(resolve => {
    setTimeout(resolve, 700);
  });

bootScreen.classList.add("hidden");

addActivity(
  "BOOT",
  "Startup sequence completed."
);
}
function getBootTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
runBootSequence();
updateClock();

setInterval(
  updateClock,
  1000
);
function initializeThreeReactor() {
  const canvas = document.getElementById("reactorCanvas");

  if (!canvas) {
    console.error("Three.js reactor could not initialize.");
    return;
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    1,
    0.1,
    100
  );

  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  const coreGroup = new THREE.Group();
  scene.add(coreGroup);

  const coreGeometry = new THREE.IcosahedronGeometry(
    1,
    3
  );

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x74f7ff,
    wireframe: true,
    transparent: true,
    opacity: 0.88
  });

  const coreMesh = new THREE.Mesh(
    coreGeometry,
    coreMaterial
  );

  coreGroup.add(coreMesh);

  const innerGeometry = new THREE.SphereGeometry(
    0.55,
    32,
    32
  );

  const innerMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xd8fdff,
      transparent: true,
      opacity: 0.55
    });

  const innerMesh = new THREE.Mesh(
    innerGeometry,
    innerMaterial
  );

  coreGroup.add(innerMesh);

  function createRing(radius, tube, color) {
    const geometry = new THREE.TorusGeometry(
      radius,
      tube,
      16,
      100
    );

    const material =
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.72,
        wireframe: true
      });

    return new THREE.Mesh(
      geometry,
      material
    );
  }

  const ringOne = createRing(
    1.55,
    0.025,
    0x50efff
  );

  const ringTwo = createRing(
    1.9,
    0.025,
    0x1fd6c2
  );

  const ringThree = createRing(
    2.25,
    0.02,
    0x0d74d5
  );

  ringOne.rotation.x = Math.PI / 2;
  ringTwo.rotation.y = Math.PI / 2;
  ringThree.rotation.x = Math.PI / 3;
  ringThree.rotation.y = Math.PI / 4;

  coreGroup.add(
    ringOne,
    ringTwo,
    ringThree
  );

  const pointLight =
    new THREE.PointLight(
      0x50efff,
      2,
      20
    );

  pointLight.position.set(0, 0, 3);
  scene.add(pointLight);

  function resizeReactor() {
    const rect =
      canvas.getBoundingClientRect();

    const width = Math.max(
      rect.width,
      1
    );

    const height = Math.max(
      rect.height,
      1
    );

    renderer.setSize(
      width,
      height,
      false
    );

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animateReactor() {
    requestAnimationFrame(
      animateReactor
    );

    const speed =
      hudCore.classList.contains("thinking")
        ? 0.025
        : 0.008;

    coreMesh.rotation.x += speed;
    coreMesh.rotation.y += speed * 1.2;

    innerMesh.rotation.y -= speed * 0.7;

    ringOne.rotation.z += speed;
    ringTwo.rotation.x -= speed * 0.8;
    ringThree.rotation.z -= speed * 0.55;

    renderer.render(
      scene,
      camera
    );
  }

  window.addEventListener(
    "resize",
    resizeReactor
  );

  resizeReactor();
  animateReactor();
}

initializeThreeReactor();