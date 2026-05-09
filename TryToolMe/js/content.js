console.log(`
  ___  _  _____  ___         _____ _____   _______ ___   ___  _    __  __ ___ 
 |   \| |/ / _ \| _ )  ___  |_   _| _ \ \ / /_   _/ _ \ / _ \| |  |  \/  | __|
 | |) | ' < (_) | _ \ |___|   | | |   /\ V /  | || (_) | (_) | |__| |\/| | _| 
 |___/|_|\_\___/|___/         |_| |_|_\ |_|   |_| \___/ \___/|____|_|  |_|___|
                                                                              
`);

function getRoomCode() {
  const m = window.location.pathname.match(/\/room\/(.+)/);
  return m && m[1] ? m[1] : null;
}

async function fetchRoomDetails(roomCode) {
  const apiUrl = `https://tryhackme.com/api/v2/rooms/details?roomCode=${roomCode}`;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).data;
  } catch (e) {
    console.error("fetchRoomDetails:", e);
    return null;
  }
}

function getProfileUsername() {
  const m = window.location.pathname.match(/^\/p\/([^/]+)\/?/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function yearFrom4Digit(t) {
  if (!/^\d{4}$/.test(t)) return null;
  const n = parseInt(t, 10);
  return n >= 2010 && n <= 2100 ? n : null;
}

function resolveActivityYear() {
  const p = new URLSearchParams(window.location.search);
  const yq = p.get("year");
  if (yq) {
    const n = yearFrom4Digit(yq);
    if (n != null) return n;
  }
  const heatRoots = [".activity-heatmap", '[class*="activity-heatmap" i]', '[class*="ActivityHeatmap" i]', '[class*="heatmap" i]']
    .map((s) => {
      try { return document.querySelector(s); } catch (e) { return null; }
    })
    .filter(Boolean);
  for (const root of heatRoots) {
    for (const el of root.querySelectorAll("button, [role='tab'], [role='button']")) {
      if (el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true") {
        const n = yearFrom4Digit((el.textContent || "").trim());
        if (n != null) return n;
      }
    }
  }
  for (const btn of document.querySelectorAll("button, [role='tab']")) {
    if (btn.getAttribute("aria-pressed") === "true" || btn.getAttribute("aria-selected") === "true") {
      const n = yearFrom4Digit((btn.textContent || "").trim());
      if (n != null) return n;
    }
  }
  const opt = document.querySelector("select option[selected], select");
  if (opt && "value" in opt) {
    const n = yearFrom4Digit(String(opt.value));
    if (n != null) return n;
  }
  return new Date().getFullYear();
}

if (!window.__TRYTOOLME_CONTENT) {
  window.__TRYTOOLME_CONTENT = true;
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getProfileContext") {
      const username = getProfileUsername();
      if (!username) {
        sendResponse({ error: "Not on a public profile (expected /p/username in URL)." });
        return;
      }
      sendResponse({ username: username, year: resolveActivityYear() });
      return;
    }
    if (request.action !== "getRoomDates") {
      return;
    }
    const roomCode = getRoomCode();
    if (!roomCode) {
      sendResponse({ error: "Not on a room page (no room code in URL)." });
      return;
    }
    const cacheKey = "room_dates_" + roomCode;
    chrome.runtime.sendMessage({ action: "getLocalStorage", keys: [cacheKey, "cacheDurationDays"] }, async (result) => {
      const days = result.cacheDurationDays || 1;
      const maxAge = days * 864e5;
      const now = Date.now();
      const cached = result[cacheKey];
      if (cached && now - cached.timestamp < maxAge) {
        sendResponse({
          title: cached.title,
          id: cached.id,
          code: cached.code,
          created: cached.created,
          published: cached.published
        });
        return;
      }
      const d = await fetchRoomDetails(roomCode);
      if (!d) {
        sendResponse({ error: "Could not fetch room details." });
        return;
      }
      const toSave = { title: d.title, id: d._id, code: d.code, created: d.created, published: d.published, timestamp: now };
      chrome.runtime.sendMessage({ action: "setLocalStorage", data: { [cacheKey]: toSave } });
      sendResponse({ title: d.title, id: d._id, code: d.code, created: d.created, published: d.published });
    });
    return true;
  });
}
