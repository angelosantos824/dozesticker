const namespace = "dozesticker";

export function readStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(`${namespace}:${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
