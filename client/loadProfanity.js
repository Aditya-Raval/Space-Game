import { chatProfanity } from "./state.js";

export async function loadProfanityList() {
  try {
    const response = await fetch("./assets/en.txt");
    if (!response.ok) throw new Error(`Failed to load profanity list: ${response.status}`);
    const raw = await response.text();
    const words = raw
      .split(/\r?\n/)
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);

    chatProfanity.length = 0;
    chatProfanity.push(...words);
    console.log(`Loaded ${chatProfanity.length} profanity words`);
  } catch (err) {
    console.error(err);
  }
}
