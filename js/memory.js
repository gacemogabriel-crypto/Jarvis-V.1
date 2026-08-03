let memories = JSON.parse(
  localStorage.getItem("jarvisMemories") || "[]"
);

function save() {
  localStorage.setItem(
    "jarvisMemories",
    JSON.stringify(memories)
  );
}

export function getMemories() {
  return [...memories];
}

export function rememberFact(fact) {
  const cleanFact = fact.trim();

  if (!cleanFact) {
    return "I need something specific to remember.";
  }

  const alreadyExists = memories.some(
    memory =>
      memory.toLowerCase() === cleanFact.toLowerCase()
  );

  if (alreadyExists) {
    return "I already remember that.";
  }

  memories.push(cleanFact);

  if (memories.length > 50) {
    memories.shift();
  }

  save();

  return `Understood. I will remember that ${cleanFact}.`;
}

export function forgetFact(searchText) {
  const query = searchText.trim().toLowerCase();

  if (!query) {
    return "Tell me what you want me to forget.";
  }

  const originalLength = memories.length;

  memories = memories.filter(
    memory => !memory.toLowerCase().includes(query)
  );

  save();

  if (memories.length === originalLength) {
    return "I could not find a matching memory.";
  }

  return "That information has been removed from my memory.";
}

export function listMemories() {
  if (memories.length === 0) {
    return "I have not saved any personal memories yet.";
  }

  return `Here is what I remember: ${memories.join("; ")}.`;
}

export function deleteMemory(index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= memories.length
  ) {
    return false;
  }

  memories.splice(index, 1);
  save();

  return true;
}

export function clearMemories() {
  memories = [];
  save();
}