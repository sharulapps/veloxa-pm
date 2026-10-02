/* ============================================================================
   VELOXA · Excel Plan vs Actual  (bridge for app.html)
   ----------------------------------------------------------------------------
   Opens budget-excel.html (Python/Pyodide engine) in a full-screen modal.
   When the user presses "Save to file" or "⇪ Sync to VELOXA" inside the module, the
   figures are written into the CURRENT project's Budget Monitor data:

   workspaces/{wsId}/projects/{CPid}
     monthlyBudget[year][month0].categories.{Consumable|Sparepart|Overtime|Project|Stationery}
                                           = { allocated: <Excel PLAN>, used: <Excel ACTUAL> }
     monthlyBudget[year][month0].otHrs     = { planned, actual, individuals:[{id,name,planned,actual}] }
     monthlyBudget[year][month0].excel     = snapshot of SPAREPART sheet (sections, summary, file, sheet)
     monthlyBudget[year][month0].otExcel   = snapshot of MAINT OT sheet (RM + hours per person)
     budgetAllocated / budgetUsed          = recomputed exactly like editProjBudget()._budSave

   month0 is 0-11 (same as budgetSelectedMonth / exec.html getMonth()).
   Excel files never leave the browser.
   ========================================================================== */
(function () {
  const PAGE_URL = "budget-excel.html";
  const ALLOWED_ROLES = ["admin", "superadmin", "manager", "engineer"];

  // Excel summary row (col K) → Budget Monitor category
  const CAT_MAP = [
    [/^CONSUMABLE/i, "Consumable"],
    [/REPAIR|MAINTENANCE|SPARE/i, "Sparepart"],
    [/^OVERTIME\b|^O\.?T\b/i, "Overtime"],
    [/^STATIONERY/i, "Stationery"],
    [/^PROJECT/i, "Project"],
    [/^FIXED ASSET/i, "Fixed Asset"],
  ];
  const SKIP = /TOTAL/i; // G.Total (Actual), TOTAL

  const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  /** "SEP'26 (6)" | "SEP 2026" | "MAINTENANCE OVERTIME FOR SEPT 2026" → {year, month0} */
  function parseYM(...texts) {
    for (const raw of texts) {
      const m = String(raw || "").toUpperCase()
        .match(/\b(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*\s*['’`]?\s*(\d{4}|\d{2})\b/);
      if (m) return { year: m[2].length === 2 ? 2000 + +m[2] : +m[2], month0: MONTHS[m[1].slice(0, 3)] - 1 };
    }
    return null;
  }
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const canUse = () => typeof CUD !== "undefined" && CUD && ALLOWED_ROLES.includes(CUD.role);
  window.budgetExcelCanUse = canUse;
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  const norm = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, " ");

  /* ---------------- Modal ---------------- */
  let modal, frame, dirty = false;
  function ensureModal() {
    if (modal) return;
    const css = document.createElement("style");
    css.textContent = `
      #vbx-modal{position:fixed;inset:0;z-index:10000;background:rgba(13,21,38,.6);display:none;backdrop-filter:blur(3px)}
      #vbx-modal.open{display:flex}
      #vbx-box{margin:auto;width:min(1440px,100%);height:100%;background:#eef0f2;display:flex;flex-direction:column;overflow:hidden}
      @media(min-width:900px){#vbx-box{height:94vh;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35)}}
      #vbx-bar{display:flex;align-items:center;gap:10px;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:#0d1526;color:#fff;font:600 14px Inter,system-ui,sans-serif}
      #vbx-bar .sp{flex:1}
      #vbx-proj{font-weight:500;opacity:.6;font-size:12px}
      #vbx-sync{font:500 12px Inter,system-ui,sans-serif;opacity:.85}
      #vbx-close{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:7px;padding:6px 14px;cursor:pointer;font:500 12px Inter,system-ui,sans-serif}
      #vbx-close:hover{background:rgba(255,255,255,.16)}
      #vbx-frame{flex:1;border:0;width:100%;background:#eef0f2}`;
    document.head.appendChild(css);
    modal = document.createElement("div");
    modal.id = "vbx-modal";
    modal.innerHTML = `<div id="vbx-box" role="dialog" aria-label="Excel Plan vs Actual">
        <div id="vbx-bar"><span>📊 Excel Plan vs Actual</span><span id="vbx-proj"></span><span class="sp"></span>
          <span id="vbx-sync">Not synced</span><button id="vbx-close">✕ Close</button></div>
        <iframe id="vbx-frame" title="Excel Plan vs Actual"></iframe></div>`;
    document.body.appendChild(modal);
    frame = modal.querySelector("#vbx-frame");
    modal.querySelector("#vbx-close").onclick = closeBudgetExcel;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) closeBudgetExcel(); });
  }

  window.openBudgetExcel = function (opts = {}) {
    if (!canUse()) return showToast("⚠️ You don't have access to Excel Plan vs Actual");
    if (!CPid || !CP) return showToast("⚠️ Select a project first");
    ensureModal();
    modal._tab = opts.tab;
    modal._pid = CPid;
    document.getElementById("vbx-proj").textContent = "· " + (CP.name || "");
    if (!frame.src) frame.src = PAGE_URL; // loaded once, state kept while app is open
    else sendInit();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  window.closeBudgetExcel = function () {
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (dirty && activeTab === "dash") { dirty = false; renderDash(); }
  };
  function sendInit() {
    frame.contentWindow.postMessage({ type: "veloxa-init",
      config: { otPassword: APP_CONFIG.otFilePassword || "", tab: modal._tab } }, location.origin);
  }
  function reply(ok, message) {
    frame?.contentWindow?.postMessage({ type: "veloxa-sync-result", ok, message }, location.origin);
    const el = document.getElementById("vbx-sync");
    if (el) el.textContent = (ok ? "✓ " : "⚠ ") + message;
  }

  /* ---------------- Messages from the module ---------------- */
  let queue = Promise.resolve();
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === "veloxa-budget-excel-ready") return sendInit();
    if (e.data.type !== "veloxa-budget-excel") return;
    const p = e.data.payload;
    queue = queue.then(() => syncPayload(p)).catch((err) => {
      console.error("[budget-excel]", err);
      reply(false, err.code === "permission-denied" ? "No write permission for this project (check Firestore rules)" : (err.message || String(err)));
    });
  });

  async function syncPayload(p) {
    const ym = parseYM(p.sheet, p.title);
    if (!ym) return reply(false, `Could not detect the month from "${p.sheet}"`);
    const pid = modal._pid || CPid;
    const ref = db.collection("workspaces").doc(wsId()).collection("projects").doc(pid);
    const snap = await ref.get(); // fresh copy — never write back a stale CP
    const mb = JSON.parse(JSON.stringify((snap.data() || {}).monthlyBudget || {}));
    const { year, month0 } = ym;
    if (!mb[year]) mb[year] = {};
    if (!mb[year][month0]) mb[year][month0] = { categories: {} };
    const mo = mb[year][month0];
    if (!mo.categories) mo.categories = {};
    const now = new Date().toISOString();
    const by = CUD.name || CUD.email || "";
    const setCat = (name, plan, actual) => {
      mo.categories[name] = { ...(mo.categories[name] || {}), allocated: r2(plan), used: r2(actual) };
      if (!CAT_ICONS[name]) CAT_ICONS[name] = name === "Stationery" ? "📎" : "📦";
    };
    let msg;

    if (p.kind === "budget") {
      const done = [];
      for (const s of p.summary || []) {
        if (SKIP.test(s.desc)) continue;
        const hit = CAT_MAP.find(([re]) => re.test(s.desc.trim()));
        if (!hit) continue;
        const cat = hit[1];
        if (cat === "Overtime" && mo.otExcel) continue;          // MAINT file is the OT source of truth
        if (cat === "Fixed Asset" && !s.plan && !s.actual) continue;
        setCat(cat, s.plan, s.actual);
        done.push(cat);
      }
      mo.excel = { file: p.file, sheet: p.sheet, title: p.title, planTotal: p.planTotal, actualTotal: p.actualTotal,
                   sections: p.sections, summary: p.summary, syncedAt: now, syncedBy: by };
      msg = `Budget Monitor ${MN[month0]} ${year} updated (${done.join(", ")})`;
    }

    if (p.kind === "ot") {
      // Excel list replaces the month's individuals; ids of matching names are kept
      const old = (mo.otHrs && mo.otHrs.individuals) || [];
      const individuals = p.individuals
        .filter((x) => x.planned || x.actual)
        .map((x) => {
          const hit = old.find((o) => norm(o.name) === norm(x.name));
          return { id: hit ? hit.id : "p" + Date.now() + Math.random().toString(36).slice(2, 6),
                   name: hit ? hit.name : x.name, planned: r2(x.planned), actual: r2(x.actual) };
        });
      const planned = r2(individuals.reduce((a, x) => a + x.planned, 0));
      const actual = r2(individuals.reduce((a, x) => a + x.actual, 0));
      mo.otHrs = { ...(mo.otHrs || {}), individuals, planned, actual };
      setCat("Overtime", p.totalPlanRM, p.totalActualRM);
      mo.otExcel = { file: p.file, sheet: p.sheet, title: p.title, totalPlanRM: p.totalPlanRM, totalActualRM: p.totalActualRM,
                     totalPlanHours: p.totalPlanHours, totalActualHours: p.totalActualHours, individuals: p.individuals,
                     syncedAt: now, syncedBy: by };
      msg = `OT ${MN[month0]} ${year}: ${actual}/${planned} hrs · RM${r2(p.totalActualRM).toLocaleString("en-MY")} updated`;
    }

    // same totals logic as editProjBudget()._budSave
    let totalAlloc = 0, totalUsed = 0;
    Object.values(mb).forEach((yr) => Object.values(yr).forEach((m) =>
      Object.values(m?.categories || {}).forEach((cd) => { totalAlloc += cd.allocated || 0; totalUsed += cd.used || 0; })));
    totalAlloc = r2(totalAlloc); totalUsed = r2(totalUsed);

    await ref.update({ monthlyBudget: mb, budgetAllocated: totalAlloc, budgetUsed: totalUsed });
    projects = projects.map((x) => (x.id === pid ? { ...x, monthlyBudget: mb, budgetAllocated: totalAlloc, budgetUsed: totalUsed } : x));
    if (CPid === pid) CP = { ...CP, monthlyBudget: mb, budgetAllocated: totalAlloc, budgetUsed: totalUsed };
    if (year === new Date().getFullYear()) budgetSelectedMonth = month0; // show the synced month on the dashboard
    dirty = true;
    reply(true, msg);
    showToast("✅ " + msg);
  }

  window.__budgetExcel = { parseYM, syncPayload };
})();
