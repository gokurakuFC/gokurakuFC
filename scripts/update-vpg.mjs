import { chromium } from "playwright";
import fs from "node:fs/promises";

const SOURCE = "https://virtualprogaming.com/league/Japan-Challenge-Cup/matches";
const TEAM = "GOKURAKU FC";
const OUTPUT = new URL("../data/matches.json", import.meta.url);

const teamAliases = ["GOKURAKU FC", "GOKURAKU", "極楽FC"];

function normKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scalar(v) {
  return ["string", "number", "boolean"].includes(typeof v) ? v : null;
}

function teamName(v, depth = 0) {
  if (depth > 3 || v == null) return null;
  if (typeof v === "string") return v.trim();
  if (typeof v !== "object") return null;

  const preferred = ["name","teamName","clubName","title","shortName","displayName"];
  for (const k of preferred) {
    if (typeof v[k] === "string" && v[k].trim()) return v[k].trim();
  }
  for (const [k,val] of Object.entries(v)) {
    if (/name|title/i.test(k) && typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function firstByAliases(obj, aliases, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 3) return null;
  const normalized = new Map(Object.keys(obj).map(k => [normKey(k), k]));
  for (const alias of aliases) {
    const real = normalized.get(normKey(alias));
    if (real != null) return obj[real];
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = firstByAliases(val, aliases, depth + 1);
      if (found != null) return found;
    }
  }
  return null;
}

function numByAliases(obj, aliases) {
  const v = firstByAliases(obj, aliases);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stringByAliases(obj, aliases) {
  const v = firstByAliases(obj, aliases);
  if (typeof v === "string") return v.trim();
  return null;
}

function dateByAliases(obj) {
  const aliases = [
    "date","matchDate","fixtureDate","datetime","dateTime","startAt","startsAt",
    "startDate","scheduledAt","kickoff","kickOff","matchTime","time"
  ];
  const v = firstByAliases(obj, aliases);
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function competitionName(obj) {
  const v = firstByAliases(obj, ["competition","league","tournament","event"]);
  const n = teamName(v);
  if (n) return n;
  const s = stringByAliases(obj, ["competitionName","leagueName","tournamentName","eventName"]);
  return s || "Japan Challenge Cup";
}

function hasOurTeam(s) {
  const u = String(s || "").toUpperCase();
  return teamAliases.some(a => u.includes(a.toUpperCase()));
}

function normalizeApiObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

  const json = JSON.stringify(obj);
  if (!hasOurTeam(json)) return null;

  let home = teamName(firstByAliases(obj, [
    "homeTeam","teamHome","home","homeClub","clubHome","team1","firstTeam"
  ]));
  let away = teamName(firstByAliases(obj, [
    "awayTeam","teamAway","away","awayClub","clubAway","team2","secondTeam"
  ]));

  // Some APIs expose teams as an array.
  if ((!home || !away)) {
    const teams = firstByAliases(obj, ["teams","clubs","participants"]);
    if (Array.isArray(teams) && teams.length >= 2) {
      home ||= teamName(teams[0]);
      away ||= teamName(teams[1]);
    }
  }

  if (!home || !away || (!hasOurTeam(home) && !hasOurTeam(away))) return null;

  const date = dateByAliases(obj);
  const scoreHome = numByAliases(obj, [
    "homeScore","scoreHome","homeGoals","goalsHome","homeResult","resultHome","score1"
  ]);
  const scoreAway = numByAliases(obj, [
    "awayScore","scoreAway","awayGoals","goalsAway","awayResult","resultAway","score2"
  ]);

  return {
    competition: competitionName(obj),
    date,
    home,
    away,
    scoreHome,
    scoreAway,
    source: SOURCE
  };
}

function walk(value, fn, depth = 0) {
  if (depth > 12 || value == null) return;
  if (Array.isArray(value)) {
    for (const x of value) walk(x, fn, depth + 1);
    return;
  }
  if (typeof value === "object") {
    fn(value);
    for (const x of Object.values(value)) walk(x, fn, depth + 1);
  }
}

function parseDateText(text) {
  if (!text) return null;

  // ISO-like first.
  const iso = text.match(/20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}[T\s]\d{1,2}:\d{2}(?::\d{2})?/);
  if (iso) {
    const d = new Date(iso[0].replace(/\//g, "-") + (iso[0].includes("T") ? "" : "+09:00"));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // 8/29 23:00 or 29/08/2026 23:00 style.
  const md = text.match(/(?:(20\d{2})[\/.-])?(\d{1,2})[\/.-](\d{1,2})[^\d]{0,15}(\d{1,2}):(\d{2})/);
  if (md) {
    const year = Number(md[1] || new Date().getFullYear());
    let month = Number(md[2]), day = Number(md[3]);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    const d = new Date(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T${String(md[4]).padStart(2,"0")}:${md[5]}:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

function parseScoreText(text, home, away) {
  if (!text) return [null, null];

  // Common 2 - 1 / 2:1 score pattern. Avoid times such as 23:00.
  const scores = [...text.matchAll(/(?:^|\s)(\d{1,2})\s*[-–:]\s*(\d{1,2})(?:\s|$)/gm)]
    .map(m => [Number(m[1]), Number(m[2])])
    .filter(([a,b]) => a <= 30 && b <= 30);

  return scores.length ? scores[0] : [null, null];
}

async function main() {
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  } catch {}

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-US",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1440, height: 1400 }
  });

  const jsonPayloads = [];

  page.on("response", async (response) => {
    try {
      const type = response.request().resourceType();
      const ct = (response.headers()["content-type"] || "").toLowerCase();
      if (!["xhr","fetch"].includes(type) && !ct.includes("json")) return;
      const data = await response.json();
      jsonPayloads.push({ url: response.url(), data });
    } catch {}
  });

  await page.goto(SOURCE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(12000);

  // Best-effort cookie/consent dismissal.
  for (const label of ["Accept", "Accept all", "I agree", "OK"]) {
    try {
      const btn = page.getByRole("button", { name: label, exact: false }).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    } catch {}
  }

  const found = [];

  // 1) Prefer structured JSON discovered from VPG's own network requests.
  for (const payload of jsonPayloads) {
    walk(payload.data, (obj) => {
      const m = normalizeApiObject(obj);
      if (m) found.push(m);
    });
  }

  // 2) Fallback: inspect rendered DOM around GOKURAKU FC.
  if (!found.length) {
    const domCandidates = await page.evaluate((teamAliases) => {
      const hasTeam = (s) => teamAliases.some(a => String(s || "").toUpperCase().includes(a.toUpperCase()));
      const nodes = [...document.querySelectorAll("body *")]
        .filter(el => {
          const own = [...el.childNodes]
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent || "")
            .join(" ")
            .trim();
          return own && hasTeam(own);
        });

      const out = [];
      const seen = new Set();

      for (const node of nodes) {
        let el = node;
        let candidate = null;

        for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
          const text = (el.innerText || "").trim();
          if (!text || text.length > 1400) continue;

          const teamLinks = [...el.querySelectorAll('a[href*="/team/"]')]
            .map(a => ({ name:(a.innerText || "").trim(), href:a.href }))
            .filter(x => x.name);

          const timeEls = [...el.querySelectorAll("time")]
            .map(t => ({ text:(t.innerText || "").trim(), datetime:t.getAttribute("datetime") }));

          if (teamLinks.length >= 2 || (text.split(/\n+/).length >= 3 && hasTeam(text))) {
            candidate = { text, teamLinks, timeEls, html: el.outerHTML.slice(0,10000) };
            break;
          }
        }

        if (candidate && !seen.has(candidate.text)) {
          seen.add(candidate.text);
          out.push(candidate);
        }
      }
      return out;
    }, teamAliases);

    for (const c of domCandidates) {
      let teams = [...new Map(c.teamLinks.map(t => [t.name, t])).values()].map(t => t.name);

      if (teams.length < 2) {
        // Fallback to meaningful lines around VS.
        teams = c.text.split(/\n+/).map(s => s.trim()).filter(Boolean)
          .filter(s => !/^\d{1,2}[:/.-]\d/.test(s))
          .filter(s => !/^(vs|result|matches?|fixtures?|challenge cup)$/i.test(s))
          .filter(s => s.length >= 2 && s.length <= 70);
      }

      const ourIndex = teams.findIndex(hasOurTeam);
      if (ourIndex < 0) continue;

      let home = null, away = null;
      if (teams.length >= 2) {
        if (ourIndex === 0) { home = teams[0]; away = teams[1]; }
        else { home = teams[Math.max(0, ourIndex - 1)]; away = teams[ourIndex]; }
      }
      if (!home || !away || home === away) continue;

      let date = null;
      for (const t of c.timeEls) {
        if (t.datetime) {
          const d = new Date(t.datetime);
          if (!Number.isNaN(d.getTime())) { date = d.toISOString(); break; }
        }
        date ||= parseDateText(t.text);
      }
      date ||= parseDateText(c.text);

      const [scoreHome, scoreAway] = parseScoreText(c.text, home, away);

      found.push({
        competition: "Japan Challenge Cup",
        date,
        home,
        away,
        scoreHome,
        scoreAway,
        source: SOURCE
      });
    }
  }

  await browser.close();

  // Clean, dedupe and keep only our fixtures.
  const cleaned = found
    .filter(m => m.home && m.away && (hasOurTeam(m.home) || hasOurTeam(m.away)))
    .map(m => ({
      competition: m.competition || "Japan Challenge Cup",
      date: m.date || null,
      home: String(m.home).trim(),
      away: String(m.away).trim(),
      scoreHome: Number.isFinite(m.scoreHome) ? m.scoreHome : null,
      scoreAway: Number.isFinite(m.scoreAway) ? m.scoreAway : null,
      source: SOURCE
    }));

  const unique = [];
  const seen = new Set();
  for (const m of cleaned) {
    const key = [m.date || "", m.home.toUpperCase(), m.away.toUpperCase()].join("|");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }

  unique.sort((a,b) => {
    const ad = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });

  // Never wipe working data just because VPG temporarily failed/blocked the scrape.
  if (!unique.length && previous?.matches?.length) {
    console.log("VPG scrape returned no fixtures; preserving previous match data.");
    return;
  }

  const output = {
    updatedAt: new Date().toISOString(),
    source: SOURCE,
    competition: "Japan Challenge Cup",
    matches: unique
  };

  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Saved ${unique.length} GOKURAKU FC fixtures.`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
