function splitCommaList(value) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function initializeKnowledgePanel() {
  const entityName = document.getElementById("entityName");
  const entityType = document.getElementById("entityType");
  const entityUniverse =
    document.getElementById("entityUniverse");
  const entityCategory =
    document.getElementById("entityCategory");
  const entityAliases =
    document.getElementById("entityAliases");
  const entityTags = document.getElementById("entityTags");
  const entityDescription =
    document.getElementById("entityDescription");

  const saveKnowledgeButton =
    document.getElementById("saveKnowledgeButton");
  const knowledgeList =
    document.getElementById("knowledgeList");
  const knowledgeStatus =
    document.getElementById("knowledgeStatus");

  if (
    !entityName ||
    !saveKnowledgeButton ||
    !knowledgeList ||
    !knowledgeStatus
  ) {
    console.warn("Knowledge panel elements were not found.");
    return;
  }

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