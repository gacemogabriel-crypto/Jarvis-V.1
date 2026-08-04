function splitCommaList(value) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function initializeKnowledgePanel() {
  let selectedKnowledgeImage = "";
    const entityName = document.getElementById("entityName");
  const entityType = document.getElementById("entityType");
  const entityUniverse =
    document.getElementById("entityUniverse");
  const entityCategory =
    document.getElementById("entityCategory");
  const entityAliases =
    document.getElementById("entityAliases");
  const entityTags = document.getElementById("entityTags");
 const entityVisualKeywords =
  document.getElementById("entityVisualKeywords");
  const entityDescription =
    document.getElementById("entityDescription");

  const saveKnowledgeButton =
    document.getElementById("saveKnowledgeButton");
  const knowledgeList =
    document.getElementById("knowledgeList");
  const knowledgeStatus =
    document.getElementById("knowledgeStatus");
const knowledgeImageInput =
  document.getElementById("knowledgeImageInput");

const selectKnowledgeImageButton =
  document.getElementById("selectKnowledgeImageButton");

const knowledgeImagePreviewContainer =
  document.getElementById("knowledgeImagePreviewContainer");

const knowledgeImagePreview =
  document.getElementById("knowledgeImagePreview");

const analyzeKnowledgeImageButton =
  document.getElementById("analyzeKnowledgeImageButton");

const removeKnowledgeImageButton =
  document.getElementById("removeKnowledgeImageButton");
  if (
    !entityName ||
    !saveKnowledgeButton ||
    !knowledgeList ||
    !knowledgeStatus
  ) {
    console.warn("Knowledge panel elements were not found.");
    return;
  }
function compressKnowledgeImage(file) {
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

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

selectKnowledgeImageButton.addEventListener("click", () => {
  knowledgeImageInput.click();
});

knowledgeImageInput.addEventListener("change", async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  knowledgeStatus.textContent = "PREPARING IMAGE";

  try {
    selectedKnowledgeImage =
      await compressKnowledgeImage(file);

    knowledgeImagePreview.src = selectedKnowledgeImage;
    knowledgeImagePreviewContainer.classList.remove("hidden");

    knowledgeStatus.textContent = "IMAGE READY";
  } catch (error) {
    console.error(error);
    knowledgeStatus.textContent = "IMAGE ERROR";
  }
});

removeKnowledgeImageButton.addEventListener("click", () => {
  selectedKnowledgeImage = "";
  knowledgeImageInput.value = "";
  knowledgeImagePreview.src = "";

  knowledgeImagePreviewContainer.classList.add("hidden");
  knowledgeStatus.textContent = "READY";
});

analyzeKnowledgeImageButton.addEventListener(
  "click",
  async () => {
    if (!selectedKnowledgeImage) {
      knowledgeStatus.textContent = "SELECT IMAGE";
      return;
    }

    knowledgeStatus.textContent = "ANALYZING";
    analyzeKnowledgeImageButton.disabled = true;

    try {
      const response = await fetch(
        "/api/knowledge-autofill",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: selectedKnowledgeImage
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not analyze the image."
        );
      }

      const entry = result.entry || {};

      entityName.value = entry.name || "";
      entityType.value = entry.entityType || "";
      entityUniverse.value = entry.universe || "";
      entityCategory.value = entry.category || "";
      entityAliases.value = Array.isArray(entry.aliases)
        ? entry.aliases.join(", ")
        : "";
      entityTags.value = Array.isArray(entry.tags)
        ? entry.tags.join(", ")
        : "";
      entityVisualKeywords.value =
        Array.isArray(entry.visualKeywords)
          ? entry.visualKeywords.join(", ")
          : "";
      entityDescription.value =
        entry.description || "";

      knowledgeStatus.textContent = "DRAFT READY";
    } catch (error) {
      console.error(error);
      knowledgeStatus.textContent = "AUTO-FILL ERROR";
    } finally {
      analyzeKnowledgeImageButton.disabled = false;
    }
  }
);
  async function loadKnowledge() {
    knowledgeStatus.textContent = "LOADING";

    try {
      const response = await fetch("/api/knowledge");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not load the knowledge base."
        );
      }

      renderKnowledge(result.entities || []);
      knowledgeStatus.textContent = "READY";
    } catch (error) {
      console.error(error);
      knowledgeStatus.textContent = "LOAD ERROR";
    }
  }

  function renderKnowledge(entities) {
    knowledgeList.innerHTML = "";

    if (entities.length === 0) {
      knowledgeList.innerHTML =
        '<p class="empty-memory">No knowledge saved yet.</p>';
      return;
    }

    entities.forEach(entity => {
      const item = document.createElement("div");
      item.className = "knowledge-item";

      const title = document.createElement("h3");
      title.textContent = entity.name;

      const meta = document.createElement("div");
      meta.className = "knowledge-meta";

      const details = [
        entity.entity_type,
        entity.universe,
        entity.category
      ].filter(Boolean);

      meta.textContent = details.join(" • ");

      const description = document.createElement("p");
      description.textContent =
        entity.description || "No description.";

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-memory";
      deleteButton.textContent = "DELETE";

      deleteButton.addEventListener("click", async () => {
        const confirmed = confirm(
          `Delete "${entity.name}" from JARVIS's knowledge?`
        );

        if (!confirmed) return;

        try {
          const response = await fetch("/api/knowledge", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              id: entity.id
            })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.error || "Could not delete the entry."
            );
          }

          await loadKnowledge();
        } catch (error) {
          console.error(error);
          knowledgeStatus.textContent = "DELETE ERROR";
        }
      });

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(description);
      item.appendChild(deleteButton);

      knowledgeList.appendChild(item);
    });
  }

  saveKnowledgeButton.addEventListener("click", async () => {
    const name = entityName.value.trim();

    if (!name) {
      knowledgeStatus.textContent = "NAME REQUIRED";
      entityName.focus();
      return;
    }

    saveKnowledgeButton.disabled = true;
    knowledgeStatus.textContent = "SAVING";

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          entityType: entityType.value.trim(),
          universe: entityUniverse.value.trim(),
          category: entityCategory.value.trim(),
          aliases: splitCommaList(entityAliases.value),
          tags: splitCommaList(entityTags.value),
          visualkeywords:splitCommaList(entityVisualKeywords.value),
          description: entityDescription.value.trim(),
          source: "user"
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not save the entry."
        );
      }

      entityName.value = "";
      entityType.value = "";
      entityUniverse.value = "";
      entityCategory.value = "";
      entityAliases.value = "";
      entityTags.value = "";
      entityVisualKeywords.value = "";
      entityDescription.value = "";

      knowledgeStatus.textContent = "SAVED";
      await loadKnowledge();
    } catch (error) {
      console.error(error);
      knowledgeStatus.textContent = "SAVE ERROR";
    } finally {
      saveKnowledgeButton.disabled = false;
    }
  });

  loadKnowledge();
}