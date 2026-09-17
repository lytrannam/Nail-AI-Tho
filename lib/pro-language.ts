"use client";

import { useSyncExternalStore } from "react";
import type { Language } from "./translations";

const key = "al-nail-language";
const eventName = "al-nail-language-change";
let memoryLanguage: Language = "vi";
function read(): Language {
  try { const value = localStorage.getItem(key); if (value === "en" || value === "vi") return value; } catch {}
  return memoryLanguage;
}
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); };
}
export function useProLanguage(): [Language, (value: Language) => void] {
  const language = useSyncExternalStore(subscribe, read, () => "vi" as Language);
  return [language, (value) => {
    memoryLanguage = value;
    try { localStorage.setItem(key, value); } catch {}
    window.dispatchEvent(new Event(eventName));
  }];
}
