// jsPsych 8 plugin: one audit row (instruction, history, two candidate actions, three questions).
var jsPsychAuditRow = (function (jspsych) {
  "use strict";
  const P = jspsych.ParameterType;

  const info = {
    name: "audit-row",
    version: "1.0.0",
    parameters: {
      row: { type: P.OBJECT, default: undefined },          // {row, instruction, history, candidates}
      mode: { type: P.STRING, default: "main" },             // main | practice | attention
      answer: { type: P.STRING, default: null },             // practice/attention: expected choice
      explanation: { type: P.HTML_STRING, default: null },   // practice feedback text
      progress: { type: P.STRING, default: "" },
      time_zone: { type: P.STRING, default: "America/Chicago" },
    },
    data: {
      row: { type: P.STRING }, mode: { type: P.STRING }, display_order: { type: P.STRING, array: true },
      choice: { type: P.STRING }, choice_slot: { type: P.STRING }, prefix_ok: { type: P.STRING },
      confidence: { type: P.STRING }, note: { type: P.STRING }, rt: { type: P.INT },
      correct: { type: P.BOOL }, converter_uses: { type: P.INT }, calculator_uses: { type: P.INT },
      expanded_outputs: { type: P.INT },
    },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Token-level diff of the two candidate actions: marks what differs between them. It shows
  // where the candidates differ, not which one is right.
  function diffMarks(a, b) {
    const tok = (s) => s.match(/[A-Za-z0-9_.]+|\s+|[^A-Za-z0-9_.\s]/g) || [];
    const x = tok(a), y = tok(b), n = x.length, m = y.length;
    if (n * m > 4e6) return [esc(a), esc(b)];
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0; const ox = [], oy = [];
    while (i < n && j < m) {
      if (x[i] === y[j]) { ox.push(esc(x[i])); oy.push(esc(y[j])); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { ox.push(`<mark>${esc(x[i])}</mark>`); i++; }
      else { oy.push(`<mark>${esc(y[j])}</mark>`); j++; }
    }
    while (i < n) ox.push(`<mark>${esc(x[i++])}</mark>`);
    while (j < m) oy.push(`<mark>${esc(y[j++])}</mark>`);
    const tidy = (h) => h.replace(/<\/mark><mark>/g, "");
    return [tidy(ox.join("")), tidy(oy.join(""))];
  }

  function historyHtml(history) {
    if (!history || history.length === 0)
      return `<p class="muted">Nothing has happened yet: the next action is the assistant's first.</p>`;
    return history.map((h) => {
      if (h.kind === "user")
        return `<div class="h-user"><div class="h-label">User says</div><div class="h-text">${esc(h.text)}</div></div>`;
      const obs = h.observation == null ? "" :
        `<div class="h-label">Tool output</div><pre class="h-obs" data-long="${h.observation.length > 1500}">${esc(h.observation)}</pre>` +
        (h.observation.length > 1500 ? `<button type="button" class="linkbtn expand">Show the whole output</button>` : "");
      return `<div class="h-agent"><div class="h-label">Assistant action ${h.step + 1}</div>` +
        `<pre class="h-act">${esc(h.action)}</pre>${obs}</div>`;
    }).join("");
  }

  const Q1 = [
    ["action_1", "Action 1"], ["action_2", "Action 2"], ["both", "Both actions are acceptable"],
    ["neither", "Neither action"], ["cannot_tell", "Cannot be determined from the history"],
  ];
  const Q2 = [["yes", "Yes"], ["no", "No"], ["unsure", "Unsure"]];
  const Q3 = [["sure", "Sure"], ["fairly_sure", "Fairly sure"], ["guessing", "Guessing"]];
  const radios = (name, opts) => opts.map(([v, l]) =>
    `<label class="opt"><input type="radio" name="${name}" value="${v}"><span>${l}</span></label>`).join("");

  class AuditRowPlugin {
    static info = info;
    constructor(jsPsych) { this.jsPsych = jsPsych; }

    trial(el, trial) {
      const t0 = performance.now();
      const r = trial.row;
      const order = this.jsPsych.randomization.shuffle([0, 1]).map((k) => r.candidates[k]);
      const [m1, m2] = diffMarks(order[0].action, order[1].action);
      let convUses = 0, calcUses = 0, expanded = 0;

      el.innerHTML = `
      <div class="ar">
        <div class="ar-main">
          ${trial.progress ? `<div class="progress">${esc(trial.progress)}</div>` : ""}
          ${trial.mode === "practice" ? `<div class="badge">Practice item</div>` : ""}
          <section class="card instr"><h2>Instruction</h2><div class="instr-text">${esc(r.instruction)}</div></section>
          <section class="card"><h2>What the assistant has done so far</h2>${historyHtml(r.history)}</section>
          <section class="card"><h2>Two possible next actions</h2>
            <p class="muted small">Highlighted text marks where the two actions differ. The order is random.</p>
            <div class="cands">
              <div class="cand"><div class="cand-h">Action 1</div><pre>${m1}</pre></div>
              <div class="cand"><div class="cand-h">Action 2</div><pre>${m2}</pre></div>
            </div>
          </section>
          <section class="card qs">
            <fieldset><legend>1. Given the instruction and the history, which action does the instruction call for next?</legend>${radios("q1", Q1)}</fieldset>
            <div class="note-wrap"><label for="note" class="small">Note <span id="note-req" class="muted">(optional; required if you did not pick Action 1 or Action 2)</span></label>
              <textarea id="note" rows="2" placeholder="What made this unclear, or what is missing?"></textarea></div>
            <fieldset><legend>2. Is the history so far a reasonable way to start working on this instruction?</legend>${radios("q2", Q2)}</fieldset>
            <fieldset><legend>3. How confident are you in your answer to question 1?</legend>${radios("q3", Q3)}</fieldset>
            <div id="err" class="err" role="alert"></div>
            <div id="fb" class="feedback" hidden></div>
            <div class="actions"><button type="button" id="submit" class="jspsych-btn primary">Submit answer</button></div>
          </section>
        </div>
        <aside class="ar-tools">
          <div class="card tool"><h3>Timestamp converter</h3>
            <p class="small muted">Paste a Unix timestamp (e.g. 1789578016.09) to see the date and time in the assistant's local time zone.</p>
            <input id="conv-in" type="text" inputmode="decimal" placeholder="timestamp">
            <button type="button" id="conv-go" class="jspsych-btn small-btn">Convert</button>
            <div id="conv-out" class="tool-out"></div></div>
          <div class="card tool"><h3>Calculator</h3>
            <p class="small muted">Numbers and + − × ÷ ( ) only, e.g. <code>105 + 190</code>.</p>
            <input id="calc-in" type="text" placeholder="expression">
            <button type="button" id="calc-go" class="jspsych-btn small-btn">Calculate</button>
            <div id="calc-out" class="tool-out"></div></div>
        </aside>
      </div>`;
      window.scrollTo(0, 0);

      el.querySelectorAll(".expand").forEach((b) => b.addEventListener("click", () => {
        b.previousElementSibling.dataset.long = "false"; b.remove(); expanded++;
      }));
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: trial.time_zone, weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", second: "2-digit",
      });
      el.querySelector("#conv-go").addEventListener("click", () => {
        const v = parseFloat(el.querySelector("#conv-in").value.trim());
        const out = el.querySelector("#conv-out");
        if (!isFinite(v)) { out.textContent = "Not a number."; return; }
        convUses++; out.textContent = fmt.format(new Date(v * 1000));
      });
      el.querySelector("#calc-go").addEventListener("click", () => {
        const s = el.querySelector("#calc-in").value.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
        const out = el.querySelector("#calc-out");
        if (!/^[\d\s.+\-*/()]+$/.test(s)) { out.textContent = "Use numbers and + - * / ( ) only."; return; }
        try { const v = Function(`"use strict"; return (${s});`)(); calcUses++;
          out.textContent = isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : "Not a number."; }
        catch (e) { out.textContent = "Could not read that expression."; }
      });

      const val = (n) => (el.querySelector(`input[name="${n}"]:checked`) || {}).value;
      const submit = el.querySelector("#submit");
      const finish = (data) => { el.innerHTML = ""; this.jsPsych.finishTrial(data); };

      submit.addEventListener("click", () => {
        const q1 = val("q1"), q2 = val("q2"), q3 = val("q3");
        const note = el.querySelector("#note").value.trim();
        const err = el.querySelector("#err");
        if (!q1 || !q2 || !q3) { err.textContent = "Please answer all three questions."; return; }
        if (!["action_1", "action_2"].includes(q1) && note.length < 5 && trial.mode !== "attention") {
          err.textContent = "Please add a short note explaining your answer to question 1."; return;
        }
        err.textContent = "";
        const choice = q1 === "action_1" ? order[0].id : q1 === "action_2" ? order[1].id : q1;
        const data = {
          row: r.row, mode: trial.mode, display_order: order.map((c) => c.id), choice, choice_slot: q1,
          prefix_ok: q2, confidence: q3, note, rt: Math.round(performance.now() - t0),
          correct: trial.answer == null ? null : choice === trial.answer,
          converter_uses: convUses, calculator_uses: calcUses, expanded_outputs: expanded,
        };
        if (trial.mode !== "practice") { finish(data); return; }
        el.querySelectorAll("input, textarea").forEach((x) => (x.disabled = true));
        const fb = el.querySelector("#fb");
        const slotOf = (id) => order[0].id === id ? "Action 1" : order[1].id === id ? "Action 2" : null;
        const want = slotOf(trial.answer) || (Q1.find(([v]) => v === trial.answer) || [null, trial.answer])[1];
        fb.hidden = false;
        fb.className = "feedback " + (data.correct ? "ok" : "no");
        fb.innerHTML = `<b>${data.correct ? "Correct." : "Not quite."}</b> The expected answer is <b>${esc(want)}</b>. ${trial.explanation || ""}`;
        submit.textContent = "Continue";
        submit.onclick = null;
        submit.replaceWith(submit.cloneNode(true));
        el.querySelector("#submit").addEventListener("click", () => finish(data));
      });
    }
  }
  return AuditRowPlugin;
})(jsPsychModule);
