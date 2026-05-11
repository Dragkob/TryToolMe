var CONTENT_INJECT_FILES = ["js/content.js"];
var THM_VM_STATUS_URL = "https://status-api.vm.tryhackme.com/";
var THM_AVAILABILITY_MIN_INTERVAL_MS = 30000;
var THM_AVAILABILITY_LS_LAST = "thmAvailabilityLastCompleteMs";
var THM_AVAILABILITY_LS_CACHE = "thmAvailabilityCache";
var thmAvailabilityFetchInFlight = false;

function isThmRoomUrl(url) {
  try { return new URL(url).hostname === "tryhackme.com" && new URL(url).pathname.startsWith("/room/"); } catch (e) { return false; }
}
function isThmPublicProfileUrl(url) {
  try { return new URL(url).hostname === "tryhackme.com" && /^\/p\/[^/]+/.test(new URL(url).pathname); } catch (e) { return false; }
}
function isThmRoomOrProfileUrl(url) {
  return isThmRoomUrl(url) || isThmPublicProfileUrl(url);
}
function isThmWebsiteUrl(url) {
  try {
    var h = new URL(url).hostname;
    return h === "tryhackme.com" || h === "www.tryhackme.com";
  } catch (e) { return false; }
}

function povColorValue(pov) {
  var v = String(pov || "").toLowerCase();
  if (v === "blue") return "#4d78ff";
  if (v === "green") return "#31c372";
  if (v === "purple") return "#a468ff";
  if (v === "red") return "#ff5d73";
  return "#4d78ff";
}

function setPovLogoColor(pov) {
  if (document && document.body) {
    document.body.style.setProperty("--pov-logo-color", povColorValue(pov));
  }
}

function formatCapabilityScoreValue(raw) {
  if (raw == null || raw === "") return null;
  var n;
  if (typeof raw === "number") {
    if (!isFinite(raw)) return null;
    n = raw;
  } else {
    var st = String(raw).trim().replace(/,/g, "");
    if (!st) return null;
    n = parseFloat(st);
    if (!isFinite(n)) return st;
  }
  return String(parseFloat(n.toFixed(3)));
}

function setCapabilityScoreDisplay(rawScore) {
  var els = document.querySelectorAll(".pov-score-text");
  if (!els || !els.length) return;
  var txt = "--";
  var f = formatCapabilityScoreValue(rawScore);
  if (f != null) txt = f;
  for (var i = 0; i < els.length; i++) els[i].textContent = txt;
}

function setPovCapabilityBadgesVisible(visible) {
  var badges = document.querySelectorAll(".pov-logo-badge");
  for (var i = 0; i < badges.length; i++) {
    badges[i].style.display = visible ? "" : "none";
    badges[i].setAttribute("aria-hidden", visible ? "false" : "true");
    badges[i].setAttribute("tabindex", visible ? "0" : "-1");
  }
}

var CAPABILITY_SCORE_CACHE_KEY = "capability_score_me";
var CACHE_CAPABILITY_SCORE_HOURS_KEY = "cacheCapabilityScoreHours";

function clampCapabilityCacheHours(h) {
  var n = parseInt(String(h), 10);
  if (isNaN(n)) return 24;
  if (n < 1) return 1;
  if (n > 72) return 72;
  return n;
}

function capabilityPayloadLooksValid(body) {
  return !!(body && body.status === "success" && body.data && body.data.capabilityScore);
}

function applyCapabilityResponseToPov(body) {
  var cap = body && body.data && body.data.capabilityScore ? body.data.capabilityScore : null;
  var pov = cap && cap.pov ? cap.pov : (body && body.data ? body.data.pov : null);
  if (!pov && body && body.pov) pov = body.pov;
  setPovLogoColor(pov || "blue");
  var raw = cap && cap.rawScore != null ? cap.rawScore : (body && body.data ? body.data.rawScore : null);
  setCapabilityScoreDisplay(raw);
}

function persistCapabilityScoreCache(body, callback) {
  var ts = Date.now();
  var row = {};
  row[CAPABILITY_SCORE_CACHE_KEY] = { json: body, timestamp: ts };
  chrome.storage.local.set(row, function () {
    if (callback) callback(ts);
  });
}

function formatCapabilityRetrievedAt(ms) {
  var d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function clearCapabilityScoreCache(callback) {
  chrome.storage.local.remove([CAPABILITY_SCORE_CACHE_KEY], function () {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message || "Storage error");
      return;
    }
    callback(null);
  });
}

function loadCapabilityScorePayload(forceNetwork, onResult) {
  chrome.storage.local.get([CAPABILITY_SCORE_CACHE_KEY, CACHE_CAPABILITY_SCORE_HOURS_KEY], function (store) {
    if (chrome.runtime.lastError) {
      onResult(chrome.runtime.lastError.message || "Storage error", null);
      return;
    }
    var maxAgeMs = clampCapabilityCacheHours(store[CACHE_CAPABILITY_SCORE_HOURS_KEY]) * 60 * 60 * 1000;
    var cached = store[CAPABILITY_SCORE_CACHE_KEY];
    var now = Date.now();
    if (!forceNetwork && cached && cached.json && typeof cached.timestamp === "number" && (now - cached.timestamp) < maxAgeMs) {
      if (capabilityPayloadLooksValid(cached.json)) {
        onResult(null, cached.json, cached.timestamp);
        return;
      }
    }
    fetch("https://tryhackme.com/api/v2/capability-score/me", { credentials: "include" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (body) {
        if (capabilityPayloadLooksValid(body)) {
          persistCapabilityScoreCache(body, function (ts) {
            onResult(null, body, ts);
          });
        } else {
          onResult(null, body);
        }
      })
      .catch(function (e) {
        onResult((e && e.message) ? e.message : "Could not load capability score.", null);
      });
  });
}

function refreshPovLogoColor(tabUrl) {
  if (!isThmWebsiteUrl(tabUrl)) {
    setPovLogoColor("blue");
    setCapabilityScoreDisplay(null);
    setPovCapabilityBadgesVisible(false);
    return;
  }
  setPovCapabilityBadgesVisible(true);
  loadCapabilityScorePayload(false, function (err, body, retrievedAtMs) {
    if (body) {
      applyCapabilityResponseToPov(body);
      return;
    }
    setPovLogoColor("blue");
    setCapabilityScoreDisplay(null);
  });
}

function sendToTabWithAutoInject(tabId, payload, onOk, onError) {
  chrome.tabs.sendMessage(tabId, payload, function (response) {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({ target: { tabId: tabId }, files: CONTENT_INJECT_FILES }, function () {
        if (chrome.runtime.lastError) {
          onError(chrome.runtime.lastError.message || "Could not inject or reach the page.");
          return;
        }
        chrome.tabs.sendMessage(tabId, payload, function (r2) {
          if (chrome.runtime.lastError) {
            onError("Extension could not talk to this page. Try refreshing the tab.");
            return;
          }
          onOk(r2 || {});
        });
      });
      return;
    }
    onOk(response || {});
  });
}

function formatThmDowntimeMinutesVerbose(totalMinutes) {
  if (totalMinutes == null || !isFinite(totalMinutes)) return "—";
  var m = Math.round(totalMinutes);
  if (m <= 0) return "0 minutes";
  if (m === 1) return "1 minute";
  if (m < 60) return m + " minutes";
  var h = Math.floor(m / 60);
  var rem = m % 60;
  var hp = h === 1 ? "1 hour" : h + " hours";
  if (!rem) return hp;
  var rp = rem === 1 ? "1 minute" : rem + " minutes";
  return hp + " " + rp;
}

function sumThmDowntimeTodayLocal(downtimePerDay) {
  if (!Array.isArray(downtimePerDay)) return null;
  var now = new Date();
  var key = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  for (var i = 0; i < downtimePerDay.length; i++) {
    var row = downtimePerDay[i];
    if (!row || row.date == null) continue;
    if (String(row.date).slice(0, 10) !== key) continue;
    var dm = row.downtimeMinutes;
    var mins = typeof dm === "number" && isFinite(dm) ? dm : parseFloat(String(dm));
    return isFinite(mins) ? mins : 0;
  }
  return null;
}

function readThmAvailabilityLastCompleteMs() {
  try {
    var n = parseInt(localStorage.getItem(THM_AVAILABILITY_LS_LAST) || "0", 10);
    return isNaN(n) ? 0 : n;
  } catch (e) {
    return 0;
  }
}

function writeThmAvailabilityPersist(lastMs, cacheObj) {
  try {
    localStorage.setItem(THM_AVAILABILITY_LS_LAST, String(lastMs));
    if (cacheObj) localStorage.setItem(THM_AVAILABILITY_LS_CACHE, JSON.stringify(cacheObj));
  } catch (e) { /* ignore quota / disabled storage */ }
}

function readThmAvailabilityCache() {
  try {
    var raw = localStorage.getItem(THM_AVAILABILITY_LS_CACHE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function loadThmAvailabilityWidget() {
  var dots = document.querySelectorAll(".thm-availability-dot");
  var summaries = document.querySelectorAll(".thm-availability-summary");
  var infoBtns = document.querySelectorAll(".thm-availability-info-btn");
  if (!dots.length || !summaries.length || !infoBtns.length) return;

  function setDotClass(cls) {
    for (var i = 0; i < dots.length; i++) dots[i].className = cls;
  }
  function setAllText(nodes, text) {
    for (var j = 0; j < nodes.length; j++) nodes[j].textContent = text;
  }
  function setDowntimeTooltips(titleText) {
    var tip = titleText || "—";
    for (var k = 0; k < infoBtns.length; k++) {
      infoBtns[k].title = tip;
      infoBtns[k].setAttribute("aria-label", "Downtime today — " + tip);
    }
  }

  var now = Date.now();
  var lastComplete = readThmAvailabilityLastCompleteMs();
  if (lastComplete !== 0 && now - lastComplete < THM_AVAILABILITY_MIN_INTERVAL_MS) {
    var cached = readThmAvailabilityCache();
    if (cached && typeof cached.dotClass === "string" && typeof cached.sumText === "string" && typeof cached.downText === "string") {
      setDotClass(cached.dotClass);
      setAllText(summaries, cached.sumText);
      setDowntimeTooltips(cached.downText);
    }
    return;
  }

  if (thmAvailabilityFetchInFlight) return;
  thmAvailabilityFetchInFlight = true;

  setDotClass("thm-availability-dot thm-availability-dot--unknown");
  setAllText(summaries, "Loading…");
  setDowntimeTooltips("Loading…");

  function finishPersist(dotClass, sumText, downText) {
    writeThmAvailabilityPersist(Date.now(), { dotClass: dotClass, sumText: sumText, downText: downText });
  }

  fetch(THM_VM_STATUS_URL, { method: "GET", cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var st = data && data.currentAvailabilityStatus != null ? String(data.currentAvailabilityStatus).toLowerCase().trim() : "";
      var sumText;
      var dotClass;
      if (st === "up") {
        dotClass = "thm-availability-dot thm-availability-dot--up";
        sumText = "Operational";
      } else if (st === "down") {
        dotClass = "thm-availability-dot thm-availability-dot--down";
        sumText = "Unavailable";
      } else {
        dotClass = "thm-availability-dot thm-availability-dot--unknown";
        sumText = st ? st.charAt(0).toUpperCase() + st.slice(1) : "Unknown";
      }
      setDotClass(dotClass);
      setAllText(summaries, sumText);
      var est = sumThmDowntimeTodayLocal(data.downtimePerDay);
      var v = formatThmDowntimeMinutesVerbose(est);
      var downText = v === "—" ? "No downtime data for today yet." : "Downtime today: " + v;
      setDowntimeTooltips(downText);
      finishPersist(dotClass, sumText, downText);
    })
    .catch(function () {
      var dotClass = "thm-availability-dot thm-availability-dot--unknown";
      var sumText = "Status unavailable";
      var downText = "Could not load downtime.";
      setDotClass(dotClass);
      setAllText(summaries, sumText);
      setDowntimeTooltips(downText);
      finishPersist(dotClass, sumText, downText);
    })
    .finally(function () {
      thmAvailabilityFetchInFlight = false;
    });
}

function formatIsoDate(s) {
  if (!s) return "N/A";
  var d = new Date(s);
  if (isNaN(d.getTime())) return "N/A";
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var day = String(d.getDate()).padStart(2, "0");
  return day + "-" + months[d.getMonth()] + "-" + String(d.getFullYear()).slice(-2);
}

function loadRoomDatesForPopup(tab) {
  var t = document.querySelector(".room-details-table");
  var err = document.getElementById("error-message-display");
  var a = { room: document.getElementById("roomName"), id: document.getElementById("roomID"), code: document.getElementById("roomCode"), c: document.getElementById("creationDate"), p: document.getElementById("publishDate") };
  if (!tab || !tab.id) return;
  if (!isThmRoomUrl(tab.url)) {
    if (t) t.style.display = "none";
    if (err) { err.textContent = "Open a room page in this tab (e.g. tryhackme.com/room/...)."; err.style.display = "block"; }
    return;
  }
  if (t) t.style.display = "";
  if (err) err.style.display = "none";
  sendToTabWithAutoInject(tab.id, { action: "getRoomDates" },
    function (response) {
      if (response && !response.error) {
        if (a.room) a.room.textContent = response.title;
        if (a.id) a.id.textContent = response.id;
        if (a.code) a.code.textContent = response.code;
        if (a.c) a.c.textContent = formatIsoDate(response.created);
        if (a.p) a.p.textContent = formatIsoDate(response.published);
      } else {
        if (t) t.style.display = "none";
        if (err) {
          err.textContent = response && response.error ? response.error : "Could not load room details.";
          err.style.display = "block";
        }
      }
    },
    function (msg) {
      if (t) t.style.display = "none";
      if (err) { err.textContent = msg; err.style.display = "block"; }
    }
  );
}

function analyzeYearlyActivity(ya) {
  var days = 0, sum = 0;
  var list = [];
  if (ya && ya.length) {
    for (var i = 0; i < ya.length; i++) {
      var c = +ya[i].count || 0;
      sum += c;
      if (c > 0) days++;
      list.push({ date: ya[i].date, count: c });
    }
    list.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return String(b.date).localeCompare(String(a.date));
    });
  }
  var top5 = list.filter(function (x) { return x.count > 0; }).slice(0, 5);
  return { activeDays: days, sumCount: sum, top5: top5 };
}

function renderTopActiveDaysList(top5) {
  var el = document.getElementById("activity-topdays-list");
  if (!el) return;
  if (!top5 || !top5.length) {
    el.innerHTML = "<p class=\"muted-status\" style=\"padding:8px 6px 2px 6px;margin:0;\">No activity to rank this year.</p>";
    return;
  }
  var h = "<table class=\"activity-top-table\"><thead><tr><th>#</th><th>Date</th><th>Events</th></tr></thead><tbody>";
  for (var i = 0; i < top5.length; i++) {
    h += "<tr><td class=\"rank\">" + (i + 1) + "</td><td>" + formatIsoDate(top5[i].date) + "</td><td>" + top5[i].count + "</td></tr>";
  }
  h += "</tbody></table>";
  el.innerHTML = h;
}

function setActivityCardLoadingPlaceholders() {
  var uEl = document.getElementById("activity-username");
  var totLabel = document.getElementById("activity-total-label");
  var totEl = document.getElementById("activity-total");
  var adEl = document.getElementById("activity-active-days");
  var ph = document.getElementById("activity-avatar-placeholder");
  var im = document.getElementById("activity-avatar");
  if (uEl) uEl.textContent = "Loading…";
  if (totLabel) totLabel.textContent = "Total activity";
  if (totEl) { totEl.textContent = "Loading…"; totEl.classList.add("value--loading"); }
  if (adEl) { adEl.textContent = "Loading…"; adEl.classList.add("value--loading"); }
  var yrEl = document.getElementById("activity-topdays-year");
  if (yrEl) {
    yrEl.textContent = "…";
    yrEl.classList.add("value--loading");
  }
  var list = document.getElementById("activity-topdays-list");
  if (list) list.innerHTML = "<p class=\"muted-status\" style=\"padding:6px 8px;margin:0;\">Loading…</p>";
  var jw = document.getElementById("activity-joined-wrap");
  var jd = document.getElementById("activity-joined-date");
  var lv = document.getElementById("activity-league-value");
  if (jw) jw.hidden = true;
  if (jd) jd.textContent = "";
  if (lv) lv.textContent = "…";
  if (im) { im.removeAttribute("src"); im.style.display = "none"; im.onerror = null; }
  if (ph) { ph.textContent = "…"; ph.style.display = "flex"; }
}

function clearStatValueLoading() {
  var totEl = document.getElementById("activity-total");
  var adEl = document.getElementById("activity-active-days");
  if (totEl) totEl.classList.remove("value--loading");
  if (adEl) adEl.classList.remove("value--loading");
}

function profileYearlyCacheKey(username, yearStr) {
  return "profile_yearly_" + encodeURIComponent(username) + "_" + String(yearStr);
}
function profilePublicCacheKey(username) {
  return "profile_public_" + encodeURIComponent(username);
}

var MIN_ACTIVITY_YEAR = 2018;

function currentMaxActivityYear() {
  return new Date().getFullYear();
}

function clampActivityYear(y, minYear) {
  var minY = minYear != null ? minYear : MIN_ACTIVITY_YEAR;
  var n = parseInt(String(y), 10);
  var maxY = currentMaxActivityYear();
  if (isNaN(n)) return maxY;
  if (n < minY) return minY;
  if (n > maxY) return maxY;
  return n;
}

function signupCalendarYearFromProf(profJson) {
  if (!profJson || profJson.status !== "success" || !profJson.data) return null;
  var ds = profJson.data.dateSignUp;
  if (!ds) return null;
  var d = new Date(ds);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear();
}

function minSelectableYearFromProf(profJson) {
  var sy = signupCalendarYearFromProf(profJson);
  if (sy != null) return Math.max(MIN_ACTIVITY_YEAR, sy);
  return MIN_ACTIVITY_YEAR;
}

function formatJoinedDate(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function applyJoinedDateDisplay(profJson) {
  var wrap = document.getElementById("activity-joined-wrap");
  var el = document.getElementById("activity-joined-date");
  if (!wrap || !el) return;
  var iso = profJson && profJson.status === "success" && profJson.data && profJson.data.dateSignUp;
  if (!iso) {
    wrap.hidden = true;
    el.textContent = "";
    return;
  }
  var s = formatJoinedDate(iso);
  if (!s) {
    wrap.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = s;
  wrap.hidden = false;
}

function formatLeagueTierDisplay(tier) {
  if (tier == null || tier === "") return "";
  var s = String(tier).trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function applyLeagueTierDisplay(profJson) {
  var el = document.getElementById("activity-league-value");
  if (!el) return;
  var raw = profJson && profJson.status === "success" && profJson.data ? profJson.data.leagueTier : null;
  var formatted = formatLeagueTierDisplay(raw);
  el.textContent = formatted ? formatted : "—";
}

var activityYearContext = { username: null, year: null, minYear: null };

function setYearlyMetricsLoadingPlaceholders() {
  var totEl = document.getElementById("activity-total");
  var adEl = document.getElementById("activity-active-days");
  var list = document.getElementById("activity-topdays-list");
  if (totEl) { totEl.textContent = "…"; totEl.classList.add("value--loading"); }
  if (adEl) { adEl.textContent = "…"; adEl.classList.add("value--loading"); }
  if (list) list.innerHTML = "<p class=\"muted-status\" style=\"padding:6px 8px;margin:0;\">Loading…</p>";
}

function updateActivityYearNavState(year, loading) {
  var prev = document.getElementById("activity-year-prev");
  var next = document.getElementById("activity-year-next");
  var maxY = currentMaxActivityYear();
  var minY = activityYearContext.minYear != null ? activityYearContext.minYear : MIN_ACTIVITY_YEAR;
  if (!prev || !next) return;
  if (loading) {
    prev.disabled = true;
    next.disabled = true;
    return;
  }
  prev.disabled = year <= minY;
  next.disabled = year >= maxY;
}

function applyYearlyActivityFromBody(body, totEl, adEl, errEl) {
  if (!body || body.status !== "success" || !body.data) return false;
  var d = body.data, ya = d.yearlyActivity || [];
  var ann = analyzeYearlyActivity(ya);
  if (totEl) totEl.textContent = d.totalCount != null ? String(d.totalCount) : String(ann.sumCount);
  if (adEl) adEl.textContent = String(ann.activeDays);
  clearStatValueLoading();
  renderTopActiveDaysList(ann.top5);
  if (errEl) errEl.style.display = "none";
  return true;
}

function applyActivityProfileAvatar(profJson, username) {
  var im = document.getElementById("activity-avatar");
  var ph = document.getElementById("activity-avatar-placeholder");
  if (ph) ph.style.display = "none";
  if (!im) return;
  if (profJson && profJson.status === "success" && profJson.data) {
    var aurl = profJson.data.avatar;
    if (aurl && String(aurl).replace(/\s/g, "")) {
      im.alt = "Profile picture for " + username;
      im.onerror = function () {
        this.style.display = "none";
        this.removeAttribute("src");
        if (ph) { ph.textContent = "?"; ph.style.display = "flex"; }
      };
      im.src = aurl;
      im.style.display = "block";
      return;
    }
  }
  im.removeAttribute("src");
  im.style.display = "none";
}

function loadYearlyActivityYearNavOnly(tab, requestedYear) {
  var errEl = document.getElementById("activity-error-display");
  var resBlock = document.getElementById("activity-result");
  var totEl = document.getElementById("activity-total");
  var adEl = document.getElementById("activity-active-days");
  var user = activityYearContext.username;
  var minYear = activityYearContext.minYear != null ? activityYearContext.minYear : MIN_ACTIVITY_YEAR;
  if (!user || !tab || !tab.id) {
    loadYearlyActivityForPopup(tab);
    return;
  }
  var yrNum = clampActivityYear(requestedYear, minYear);
  activityYearContext.year = yrNum;

  var scrollRoot = document.scrollingElement || document.documentElement;
  var prevScroll = scrollRoot ? scrollRoot.scrollTop : 0;

  if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
  setYearlyMetricsLoadingPlaceholders();
  var yrBanner = document.getElementById("activity-topdays-year");
  if (yrBanner) {
    yrBanner.textContent = String(yrNum);
    yrBanner.classList.remove("value--loading");
  }
  updateActivityYearNavState(yrNum, true);

  var yr = String(yrNum);
  var uYearly = "https://tryhackme.com/api/v2/public-profile/yearly-activity?username=" + encodeURIComponent(user) + "&year=" + encodeURIComponent(yr);
  var yearlyKey = profileYearlyCacheKey(user, yr);
  var nowTs = Date.now();

  function saveYearlyCache(body) {
    var payload = {};
    payload[yearlyKey] = { json: body, timestamp: Date.now() };
    chrome.runtime.sendMessage({ action: "setLocalStorage", data: payload });
  }

  function restoreScroll() {
    if (!scrollRoot) return;
    scrollRoot.scrollTop = prevScroll;
    if (document.body) document.body.scrollTop = prevScroll;
  }

  function finishYearlyNav() {
    updateActivityYearNavState(yrNum, false);
    requestAnimationFrame(function () {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    });
  }

  chrome.runtime.sendMessage({ action: "getLocalStorage", keys: [yearlyKey, "cacheDurationDays"] }, function (store) {
    var days = store && store.cacheDurationDays != null ? store.cacheDurationDays : 1;
    var maxAge = days * 864e5;
    var yCached = store && store[yearlyKey];

    var yearlyOk = false;
    if (yCached && typeof yCached.timestamp === "number" && (nowTs - yCached.timestamp) < maxAge && yCached.json) {
      yearlyOk = applyYearlyActivityFromBody(yCached.json, totEl, adEl, errEl);
    }
    if (yearlyOk) {
      finishYearlyNav();
      return;
    }
    fetch(uYearly)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (body) {
        if (!applyYearlyActivityFromBody(body, totEl, adEl, errEl)) {
          throw new Error((body && body.message) || "API error");
        }
        saveYearlyCache(body);
        finishYearlyNav();
      })
      .catch(function (e) {
        finishYearlyNav();
        if (resBlock) resBlock.style.display = "none";
        var ph = document.getElementById("activity-avatar-placeholder");
        if (ph) ph.style.display = "none";
        var im = document.getElementById("activity-avatar");
        if (im) { im.removeAttribute("src"); im.style.display = "none"; }
        if (errEl) { errEl.textContent = (e && e.message) || "Could not load yearly activity."; errEl.style.display = "block"; }
      });
  });
}

function loadYearlyActivityForPopup(tab, options) {
  options = options || {};
  var errEl = document.getElementById("activity-error-display");
  var resBlock = document.getElementById("activity-result");
  var uEl = document.getElementById("activity-username");
  var totLabel = document.getElementById("activity-total-label");
  var totEl = document.getElementById("activity-total");
  var adEl = document.getElementById("activity-active-days");
  var st = document.getElementById("activity-status");
  if (!tab || !tab.id) return;
  if (!isThmPublicProfileUrl(tab.url)) {
    if (resBlock) resBlock.style.display = "none";
    if (errEl) { errEl.textContent = "Open a public profile in this tab (e.g. tryhackme.com/p/your-username)."; errEl.style.display = "block"; }
    if (st) st.textContent = "";
    activityYearContext.username = null;
    activityYearContext.year = null;
    activityYearContext.minYear = null;
    return;
  }
  if (options.metricsOnlyLoading && activityYearContext.username && options.year != null) {
    loadYearlyActivityYearNavOnly(tab, options.year);
    return;
  }
  if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
  if (st) st.textContent = "";
  if (resBlock) resBlock.style.display = "block";
  if (options.metricsOnlyLoading) {
    setYearlyMetricsLoadingPlaceholders();
  } else {
    setActivityCardLoadingPlaceholders();
  }
  sendToTabWithAutoInject(tab.id, { action: "getProfileContext" },
    function (response) {
      if (!response || response.error) {
        if (resBlock) resBlock.style.display = "none";
        if (st) st.textContent = "";
        if (errEl) { errEl.textContent = (response && response.error) || "Could not read profile from the page."; errEl.style.display = "block"; }
        activityYearContext.username = null;
        activityYearContext.year = null;
        activityYearContext.minYear = null;
        return;
      }
      var user = response.username;
      var publicKey = profilePublicCacheKey(user);
      var uProf = "https://tryhackme.com/api/v2/public-profile?username=" + encodeURIComponent(user);

      function savePublicProfileCache(profJson) {
        var payload = {};
        payload[publicKey] = { json: profJson, timestamp: Date.now() };
        chrome.runtime.sendMessage({ action: "setLocalStorage", data: payload });
      }

      function continueAfterProfileLoaded(profJson) {
        var minYear = minSelectableYearFromProf(profJson);
        activityYearContext.username = user;
        activityYearContext.minYear = minYear;

        applyJoinedDateDisplay(profJson);
        applyLeagueTierDisplay(profJson || {});
        applyActivityProfileAvatar(profJson || {}, user);

        var pageYear = clampActivityYear(response.year, minYear);
        var yrNum = options.year != null ? clampActivityYear(options.year, minYear) : pageYear;
        var yr = String(yrNum);
        activityYearContext.year = yrNum;

        if (uEl) uEl.textContent = user;
        if (totLabel) totLabel.textContent = "Total activity";
        var yrBanner = document.getElementById("activity-topdays-year");
        if (yrBanner) {
          yrBanner.textContent = yr;
          yrBanner.classList.remove("value--loading");
        }
        updateActivityYearNavState(yrNum, true);

        var uYearly = "https://tryhackme.com/api/v2/public-profile/yearly-activity?username=" + encodeURIComponent(user) + "&year=" + encodeURIComponent(yr);
        var yearlyKey = profileYearlyCacheKey(user, yr);
        var nowTs = Date.now();

        function saveYearlyCache(body) {
          var payload = {};
          payload[yearlyKey] = { json: body, timestamp: Date.now() };
          chrome.runtime.sendMessage({ action: "setLocalStorage", data: payload });
        }

        function finishYearlyNav() {
          updateActivityYearNavState(yrNum, false);
        }

        chrome.runtime.sendMessage({ action: "getLocalStorage", keys: [yearlyKey, "cacheDurationDays"] }, function (store) {
          var days = store && store.cacheDurationDays != null ? store.cacheDurationDays : 1;
          var maxAge = days * 864e5;
          var yCached = store && store[yearlyKey];

          var yearlyOk = false;
          if (yCached && typeof yCached.timestamp === "number" && (nowTs - yCached.timestamp) < maxAge && yCached.json) {
            yearlyOk = applyYearlyActivityFromBody(yCached.json, totEl, adEl, errEl);
          }
          if (yearlyOk) {
            finishYearlyNav();
          }
          if (!yearlyOk) {
            fetch(uYearly)
              .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
              .then(function (body) {
                if (!applyYearlyActivityFromBody(body, totEl, adEl, errEl)) {
                  throw new Error((body && body.message) || "API error");
                }
                saveYearlyCache(body);
                finishYearlyNav();
              })
              .catch(function (e) {
                finishYearlyNav();
                if (resBlock) resBlock.style.display = "none";
                var ph = document.getElementById("activity-avatar-placeholder");
                if (ph) ph.style.display = "none";
                var im = document.getElementById("activity-avatar");
                if (im) { im.removeAttribute("src"); im.style.display = "none"; }
                if (errEl) { errEl.textContent = (e && e.message) || "Could not load yearly activity."; errEl.style.display = "block"; }
              });
          }
        });
      }

      chrome.runtime.sendMessage({ action: "getLocalStorage", keys: [publicKey, "cacheDurationDays"] }, function (store) {
        var days = store && store.cacheDurationDays != null ? store.cacheDurationDays : 1;
        var maxAge = days * 864e5;
        var nowTs = Date.now();
        var pCached = store && store[publicKey];
        var profHit = pCached && typeof pCached.timestamp === "number" && (nowTs - pCached.timestamp) < maxAge && pCached.json != null;

        if (profHit) {
          continueAfterProfileLoaded(pCached.json);
        } else {
          fetch(uProf)
            .then(function (r) { if (!r.ok) return null; return r.json(); })
            .catch(function () { return null; })
            .then(function (profJson) {
              if (profJson && profJson.status === "success") savePublicProfileCache(profJson);
              continueAfterProfileLoaded(profJson || null);
            });
        }
      });
    },
    function (msg) {
      if (resBlock) resBlock.style.display = "none";
      if (errEl) { errEl.textContent = msg; errEl.style.display = "block"; }
      if (st) st.textContent = "";
      activityYearContext.username = null;
      activityYearContext.year = null;
      activityYearContext.minYear = null;
    }
  );
}

function clearTryToolMeDataCache(callback) {
  chrome.storage.local.get(null, function (all) {
    if (chrome.runtime.lastError) {
      callback(null, chrome.runtime.lastError.message || "Storage error");
      return;
    }
    var keys = Object.keys(all || {}).filter(function (k) {
      return k.startsWith("room_dates_") || k.startsWith("profile_public_") || k.startsWith("profile_yearly_");
    });
    if (!keys.length) {
      callback(0);
      return;
    }
    chrome.storage.local.remove(keys, function () {
      if (chrome.runtime.lastError) {
        callback(null, chrome.runtime.lastError.message || "Storage error");
        return;
      }
      callback(keys.length);
    });
  });
}

function escapeHtmlCap(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function formatCapabilityIsoLocal(iso) {
  if (!iso) return "—";
  var dt = new Date(iso);
  if (isNaN(dt.getTime())) return escapeHtmlCap(String(iso));
  return escapeHtmlCap(dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
}

function trendLabelShort(trend) {
  var t = String(trend || "").toLowerCase();
  if (t === "increased") return "Up";
  if (t === "decreased") return "Down";
  if (t === "no_change") return "Steady";
  return trend ? String(trend) : "—";
}

function capabilityComponentTitle(key) {
  var map = { baseline: "Baseline", foundation: "Foundation", activity: "Activity", specialism: "Specialism", versatility: "Versatility", relevancy: "Relevancy" };
  return map[key] || (key.charAt(0).toUpperCase() + key.slice(1));
}

function renderCapabilityScoreDetail(apiBody) {
  var root = document.getElementById("capability-detail-root");
  if (!root) return;
  if (!apiBody || apiBody.status !== "success" || !apiBody.data || !apiBody.data.capabilityScore) {
    root.innerHTML = "<p class=\"capability-panel-error\">Could not read capability score data.</p>";
    return;
  }
  var cs = apiBody.data.capabilityScore;
  var raw = cs.rawScore;
  var rawStr = "—";
  if (raw != null && raw !== "") {
    var rf = formatCapabilityScoreValue(raw);
    rawStr = escapeHtmlCap(rf != null ? rf : String(raw).trim());
  }
  var pov = cs.pov ? String(cs.pov) : "";
  var povHex = povColorValue(pov || "blue");
  var pillStyle = "color:" + povHex + ";border-color:" + povHex + ";background:color-mix(in srgb, " + povHex + " 22%, transparent)";

  var order = ["baseline", "foundation", "activity", "specialism", "versatility", "relevancy"];
  var comps = cs.components || {};
  var trends = cs.componentTrends || {};

  var compHtml = "";
  for (var ci = 0; ci < order.length; ci++) {
    var k = order[ci];
    if (!Object.prototype.hasOwnProperty.call(comps, k)) continue;
    var val = comps[k];
    var valStr = val != null && val !== "" ? escapeHtmlCap(String(val)) : "—";
    var tr = trends[k] || {};
    var trendTxt = escapeHtmlCap(trendLabelShort(tr.trend));
    var lastAt = formatCapabilityIsoLocal(tr.lastIncreasedAt);
    compHtml += "<div class=\"capability-comp-row\"><div><div class=\"capability-comp-name\">" + escapeHtmlCap(capabilityComponentTitle(k)) + "</div><div class=\"capability-comp-sub\">Trend: " + trendTxt + " · Last change: " + lastAt + "</div></div><div class=\"capability-comp-val\">" + valStr + "</div></div>";
  }

  var meta = cs.metadata || {};
  var metaHtml = "";
  if (meta.skillDistribution != null || meta.specialismRole != null) {
    metaHtml += "<div class=\"capability-section-title\">Profile</div><div class=\"capability-meta-grid\">";
    if (meta.skillDistribution != null && meta.skillDistribution !== "") {
      metaHtml += "<div class=\"capability-meta-card\"><dt>Skill distribution</dt><dd>" + escapeHtmlCap(String(meta.skillDistribution)) + "</dd></div>";
    }
    if (meta.specialismRole != null && meta.specialismRole !== "") {
      metaHtml += "<div class=\"capability-meta-card\"><dt>Specialism role</dt><dd>" + escapeHtmlCap(String(meta.specialismRole)) + "</dd></div>";
    }
    metaHtml += "</div>";
  }

  var histHtml = "";
  var hist = Array.isArray(cs.history) ? cs.history.slice() : [];
  hist.reverse();
  var maxHist = 10;
  if (hist.length) {
    histHtml += "<div class=\"capability-section-title\">History (" + Math.min(hist.length, maxHist) + " newest)</div><div class=\"capability-history\">";
    for (var hi = 0; hi < hist.length && hi < maxHist; hi++) {
      var h = hist[hi];
      var hDate = formatCapabilityIsoLocal(h.date);
      var hScore = "—";
      if (h.rawScore != null && h.rawScore !== "") {
        var hf = formatCapabilityScoreValue(h.rawScore);
        hScore = escapeHtmlCap(hf != null ? hf : String(h.rawScore).trim());
      }
      var hc = h.components || {};
      var mini = "";
      var hk = ["baseline", "foundation", "activity", "specialism", "versatility", "relevancy"];
      for (var mj = 0; mj < hk.length; mj++) {
        var kk = hk[mj];
        if (!Object.prototype.hasOwnProperty.call(hc, kk)) continue;
        var vv = hc[kk];
        mini += "<span>" + escapeHtmlCap(capabilityComponentTitle(kk)) + "</span><span>" + escapeHtmlCap(vv != null ? String(vv) : "—") + "</span>";
      }
      histHtml += "<details class=\"capability-history-item\"><summary><span>" + hDate + "</span><span><strong>" + hScore + "</strong></span></summary><div class=\"capability-history-detail\"><div class=\"capability-mini-grid\">" + mini + "</div></div></details>";
    }
    histHtml += "</div>";
  }

  root.innerHTML =
    "<div class=\"capability-hero\"><div><div class=\"capability-hero__label\">Capability score</div><div class=\"capability-hero__score\">" + rawStr + "</div></div><span class=\"capability-pov-pill\" style=\"" + pillStyle + "\">" + escapeHtmlCap(pov || "—") + "</span></div>" +
    metaHtml +
    "<div class=\"capability-section-title\">Components</div><div class=\"capability-components\">" + compHtml + "</div>" +
    histHtml;
}

function restoreMainPopupView(thmContent, splashContent, messageContent, github, refreshThm) {
  if (github) github.style.display = "block";
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var u = tabs[0] && tabs[0].url;
    if (u && isThmRoomOrProfileUrl(u)) {
      if (thmContent) thmContent.style.display = "block";
      if (splashContent) splashContent.style.display = "none";
      if (messageContent) messageContent.style.display = "none";
      if (refreshThm) refreshThm();
    } else if (u && isThmWebsiteUrl(u)) {
      if (thmContent) thmContent.style.display = "none";
      if (splashContent) splashContent.style.display = "block";
      if (messageContent) messageContent.style.display = "none";
    } else {
      if (thmContent) thmContent.style.display = "none";
      if (splashContent) splashContent.style.display = "none";
      if (messageContent) messageContent.style.display = "block";
    }
  });
}

function wireSettings(thmContent, splashContent, messageContent, settingsContent, capabilityContent, github, refreshThm) {
  var cache = document.getElementById("cache-duration");
  var cacheCapHours = document.getElementById("cache-capability-hours");
  var save = document.getElementById("save-button");
  var clearCache = document.getElementById("clear-cache-button");
  var clearCapCache = document.getElementById("clear-capability-cache-button");
  var smsg = document.getElementById("status-message");
  var show = function (e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (messageContent) messageContent.style.display = "none";
    if (splashContent) splashContent.style.display = "none";
    if (thmContent) thmContent.style.display = "none";
    if (capabilityContent) capabilityContent.style.display = "none";
    if (github) github.style.display = "none";
    if (settingsContent) settingsContent.style.display = "block";
    if (smsg) { smsg.className = "status-message"; smsg.textContent = ""; }
  };
  var hide = function (e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (settingsContent) settingsContent.style.display = "none";
    if (smsg) { smsg.className = "status-message"; smsg.textContent = ""; }
    restoreMainPopupView(thmContent, splashContent, messageContent, github, refreshThm);
  };
  var si1 = document.getElementById("settings-icon-thm");
  var si2 = document.getElementById("settings-icon-msg");
  var si3 = document.getElementById("settings-icon-splash");
  if (si1) si1.addEventListener("click", show);
  if (si2) si2.addEventListener("click", show);
  if (si3) si3.addEventListener("click", show);
  var back = document.getElementById("back-icon");
  if (back) back.addEventListener("click", hide);
  chrome.storage.local.get(["cacheDurationDays", CACHE_CAPABILITY_SCORE_HOURS_KEY], function (result) {
    if (cache) cache.value = result.cacheDurationDays != null ? result.cacheDurationDays : 1;
    if (cacheCapHours) cacheCapHours.value = result[CACHE_CAPABILITY_SCORE_HOURS_KEY] != null ? result[CACHE_CAPABILITY_SCORE_HOURS_KEY] : 24;
  });
  if (cacheCapHours) {
    cacheCapHours.addEventListener("input", function (e) {
      var v = e.target.value.replace(/\D/g, "");
      if (v.length > 2) v = v.slice(0, 2);
      e.target.value = v;
    });
  }
  if (cache) {
    cache.addEventListener("input", function (e) {
      var v = e.target.value.replace(/[^1-7]/g, "");
      e.target.value = v.length > 1 ? v.slice(0, 1) : v;
    });
    cache.addEventListener("keypress", function (e) { if (!/[1-7]/.test(String.fromCharCode(e.which))) e.preventDefault(); });
    cache.addEventListener("paste", function (e) {
      e.preventDefault();
      var f = (e.clipboardData || window.clipboardData).getData("text").replace(/[^1-7]/g, "").slice(0, 1);
      e.target.value = f || e.target.value;
    });
  }
  if (save) {
    save.addEventListener("click", function () {
      var days = parseInt(cache && cache.value, 10);
      var hours = parseInt(cacheCapHours && cacheCapHours.value, 10);
      if (isNaN(days) || days < 1 || days > 7) {
        if (smsg) { smsg.textContent = "Room/profile cache: enter a number between 1 and 7 (days)."; smsg.className = "status-message error"; }
        return;
      }
      if (isNaN(hours) || hours < 1 || hours > 72) {
        if (smsg) { smsg.textContent = "Capability score cache: enter a number between 1 and 72 (hours)."; smsg.className = "status-message error"; }
        return;
      }
      var data = { cacheDurationDays: days, cacheCapabilityScoreHours: hours };
      chrome.storage.local.set(data, function () {
        if (smsg) { smsg.textContent = "Settings saved successfully!"; smsg.className = "status-message success"; }
        setTimeout(function () { if (smsg) smsg.className = "status-message"; }, 3000);
      });
    });
  }
  if (clearCache) {
    clearCache.addEventListener("click", function () {
      clearTryToolMeDataCache(function (n, err) {
        if (err) {
          if (smsg) { smsg.textContent = err; smsg.className = "status-message error"; }
          return;
        }
        if (smsg) {
          smsg.textContent = n === 0 ? "Room and profile cache was already empty." : ("Removed " + n + " cached entr" + (n === 1 ? "y" : "ies") + ". Fresh data will load next time.");
          smsg.className = "status-message success";
          setTimeout(function () { if (smsg) smsg.className = "status-message"; }, 4000);
        }
      });
    });
  }
  if (clearCapCache) {
    clearCapCache.addEventListener("click", function () {
      clearCapabilityScoreCache(function (err) {
        if (err) {
          if (smsg) { smsg.textContent = err; smsg.className = "status-message error"; }
          return;
        }
        if (smsg) {
          smsg.textContent = "Capability score cache cleared.";
          smsg.className = "status-message success";
          setTimeout(function () { if (smsg) smsg.className = "status-message"; }, 4000);
        }
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var thm = document.getElementById("thm-content");
  var splashContent = document.getElementById("splash-content");
  var messageContent = document.getElementById("message-content");
  var capabilityContent = document.getElementById("capability-content");
  var settingsContent = document.getElementById("settings-content");
  var github = document.querySelector(".github-link-container");
  var tabRoom = document.getElementById("tab-panel-room");
  var tabAct = document.getElementById("tab-panel-activity");
  var featureTabs = document.getElementById("feature-tabs");
  var btnR = document.getElementById("tab-btn-room");
  var btnA = document.getElementById("tab-btn-activity");

  function setTab(which) {
    if (tabRoom) tabRoom.style.display = which === "room" ? "block" : "none";
    if (tabAct) tabAct.style.display = which === "activity" ? "block" : "none";
    if (btnR) { btnR.classList.toggle("tab-btn--active", which === "room"); btnR.setAttribute("aria-selected", which === "room" ? "true" : "false"); }
    if (btnA) { btnA.classList.toggle("tab-btn--active", which === "activity"); btnA.setAttribute("aria-selected", which === "activity" ? "true" : "false"); }
  }
  function setLayoutPublicProfile() {
    if (featureTabs) featureTabs.style.display = "none";
    if (tabRoom) tabRoom.style.display = "none";
    if (tabAct) {
      tabAct.style.display = "block";
    }
  }
  function setLayoutRoom() {
    if (featureTabs) featureTabs.style.display = "none";
    if (tabRoom) tabRoom.style.display = "block";
    if (tabAct) tabAct.style.display = "none";
  }
  if (btnR) btnR.addEventListener("click", function () { setTab("room"); });
  if (btnA) btnA.addEventListener("click", function () { setTab("activity"); });

  var prevY = document.getElementById("activity-year-prev");
  var nextY = document.getElementById("activity-year-next");
  if (prevY) {
    prevY.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var t = tabs[0];
        if (!t || !isThmPublicProfileUrl(t.url)) return;
        var y = activityYearContext.year;
        var minY = activityYearContext.minYear != null ? activityYearContext.minYear : MIN_ACTIVITY_YEAR;
        if (y == null || y <= minY) return;
        loadYearlyActivityForPopup(t, { year: y - 1, metricsOnlyLoading: true });
      });
    });
  }
  if (nextY) {
    nextY.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var t = tabs[0];
        if (!t || !isThmPublicProfileUrl(t.url)) return;
        var y = activityYearContext.year;
        if (y == null || y >= currentMaxActivityYear()) return;
        loadYearlyActivityForPopup(t, { year: y + 1, metricsOnlyLoading: true });
      });
    });
  }

  function refresh() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var x = tabs[0];
      if (settingsContent && settingsContent.style.display === "block") return;
      if (capabilityContent && capabilityContent.style.display === "block") return;
      loadThmAvailabilityWidget();
      if (!x || !x.url) return;
      refreshPovLogoColor(x.url);
      if (isThmPublicProfileUrl(x.url)) {
        if (thm) thm.style.display = "block";
        if (splashContent) splashContent.style.display = "none";
        if (messageContent) messageContent.style.display = "none";
        setLayoutPublicProfile();
        loadYearlyActivityForPopup(x);
        return;
      }
      if (isThmRoomUrl(x.url)) {
        if (thm) thm.style.display = "block";
        if (splashContent) splashContent.style.display = "none";
        if (messageContent) messageContent.style.display = "none";
        setLayoutRoom();
        loadRoomDatesForPopup(x);
        return;
      }
      if (isThmWebsiteUrl(x.url)) {
        if (thm) thm.style.display = "none";
        if (splashContent) splashContent.style.display = "block";
        if (messageContent) messageContent.style.display = "none";
        return;
      }
      if (thm) thm.style.display = "none";
      if (splashContent) splashContent.style.display = "none";
      if (messageContent) messageContent.style.display = "block";
    });
  }
  wireSettings(thm, splashContent, messageContent, settingsContent, capabilityContent, github, refresh);

  function openCapabilityPanel() {
    if (messageContent) messageContent.style.display = "none";
    if (splashContent) splashContent.style.display = "none";
    if (thm) thm.style.display = "none";
    if (settingsContent) settingsContent.style.display = "none";
    if (github) github.style.display = "none";
    if (capabilityContent) capabilityContent.style.display = "block";
    var detailRoot = document.getElementById("capability-detail-root");
    var retrievedEl = document.getElementById("capability-retrieved-at");
    if (retrievedEl) {
      retrievedEl.hidden = true;
      retrievedEl.textContent = "";
    }
    if (detailRoot) detailRoot.innerHTML = "<p class=\"capability-loading-msg\">Loading capability score…</p>";
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var u = tabs[0] && tabs[0].url;
      if (!isThmWebsiteUrl(u || "")) {
        if (detailRoot) {
          detailRoot.innerHTML = "<p class=\"capability-panel-error\">Sign in on tryhackme.com and open this popup while on the site to load capability score data.</p>";
        }
        return;
      }
      loadCapabilityScorePayload(false, function (err, body, retrievedAtMs) {
        if (detailRoot && body) {
          renderCapabilityScoreDetail(body);
          if (capabilityPayloadLooksValid(body) && retrievedEl) {
            var tsMs = typeof retrievedAtMs === "number" ? retrievedAtMs : Number(retrievedAtMs);
            var fetchedStr = !isNaN(tsMs) ? formatCapabilityRetrievedAt(tsMs) : "";
            if (fetchedStr) {
              retrievedEl.textContent = "Last API fetch · " + fetchedStr;
              retrievedEl.hidden = false;
            } else {
              retrievedEl.hidden = true;
            }
          } else if (retrievedEl) {
            retrievedEl.hidden = true;
          }
          return;
        }
        if (retrievedEl) retrievedEl.hidden = true;
        if (detailRoot) {
          detailRoot.innerHTML = "<p class=\"capability-panel-error\">" + escapeHtmlCap(err || "Could not load capability score.") + "</p>";
        }
      });
    });
  }

  function closeCapabilityPanel(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (capabilityContent) capabilityContent.style.display = "none";
    restoreMainPopupView(thm, splashContent, messageContent, github, refresh);
  }

  var badges = document.querySelectorAll(".pov-logo-badge");
  for (var bi = 0; bi < badges.length; bi++) {
    badges[bi].addEventListener("click", openCapabilityPanel);
    badges[bi].addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openCapabilityPanel();
      }
    });
  }
  var capBack = document.getElementById("capability-back-icon");
  if (capBack) capBack.addEventListener("click", closeCapabilityPanel);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    loadThmAvailabilityWidget();
    var tab = tabs[0];
    if (!tab) return;
    if (settingsContent && settingsContent.style.display === "block") return;
    if (capabilityContent && capabilityContent.style.display === "block") return;
    var u = tab.url;
    refreshPovLogoColor(u);
    if (u && isThmRoomOrProfileUrl(u)) {
      if (messageContent) messageContent.style.display = "none";
      if (splashContent) splashContent.style.display = "none";
      if (thm) thm.style.display = "block";
      if (isThmPublicProfileUrl(u)) {
        setLayoutPublicProfile();
        loadYearlyActivityForPopup(tab);
      } else {
        setLayoutRoom();
        loadRoomDatesForPopup(tab);
      }
    } else if (u && isThmWebsiteUrl(u)) {
      if (messageContent) messageContent.style.display = "none";
      if (thm) thm.style.display = "none";
      if (splashContent) splashContent.style.display = "block";
    } else {
      if (messageContent) messageContent.style.display = "block";
      if (thm) thm.style.display = "none";
      if (splashContent) splashContent.style.display = "none";
    }
  });
});
