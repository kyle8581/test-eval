/* Human audit of crossed instruction–trajectory groups (Prolific + DataPipe).
 *
 * URL parameters
 *   PROLIFIC_PID, STUDY_ID, SESSION_ID   added by Prolific
 *   list=NN     force a list (top-up runs for lists that lack three valid raters)
 *   debug=1     no DataPipe calls; the data file is offered for download at the end
 */
(async function () {
  const cfg = window.AUDIT_CONFIG;
  const jsPsych = initJsPsych({});
  const url = (k) => jsPsych.data.getURLVariable(k);
  const DEBUG = url("debug") === "1";
  const pid = url("PROLIFIC_PID") || (DEBUG ? "debug" : "no_pid_" + jsPsych.randomization.randomID(8));
  const study = url("STUDY_ID") || "", session = url("SESSION_ID") || jsPsych.randomization.randomID(8);
  const saving = !DEBUG && cfg.DATAPIPE_EXPERIMENT_ID;

  const getJSON = async (p) => { const r = await fetch(p, { cache: "no-store" }); if (!r.ok) throw new Error(p); return r.json(); };
  const manifest = await getJSON("data/manifest.json");
  const extra = await getJSON("data/practice.json");

  let listIdx, listSource;
  if (url("list") != null) { listIdx = parseInt(url("list"), 10) % manifest.n_lists; listSource = "url"; }
  else if (saving) {
    const c = await jsPsychPipe.getCondition(cfg.DATAPIPE_EXPERIMENT_ID);
    if (Number.isInteger(c)) { listIdx = c % manifest.n_lists; listSource = "datapipe"; }
    else { listIdx = Math.floor(Math.random() * manifest.n_lists); listSource = "random_fallback"; }
  } else { listIdx = Math.floor(Math.random() * manifest.n_lists); listSource = "random_debug"; }
  // Debug preview: index.html?debug=1&sample=select opens a fixed set of selection items directly
  // (no consent, quiz, practice or attention checks, nothing saved).
  const SAMPLE = DEBUG ? url("sample") : null;
  if (SAMPLE) { listIdx = "debug_" + SAMPLE; listSource = "debug_sample"; }
  const list = await getJSON(SAMPLE ? `data/lists/debug_${SAMPLE}.json`
                                    : `data/lists/list_${String(listIdx).padStart(2, "0")}.json`);

  jsPsych.data.addProperties({ prolific_pid: pid, study_id: study, session_id: session, list: listIdx,
    list_source: listSource, item_version: manifest.version, started_at: new Date().toISOString() });

  const page = (html) => `<div class="page">${html}</div>`;
  const endWith = (code, msg) => ({
    type: jsPsychHtmlButtonResponse, choices: DEBUG ? ["Download data"] : ["Return to Prolific"],
    stimulus: page(`<h1>Thank you</h1><p>${msg}</p>` + (DEBUG ? `<p class="muted">Debug mode: nothing was saved.</p>` : "")),
    on_finish: () => {
      if (DEBUG) { jsPsych.data.get().localSave("json", `audit_debug_list${listIdx}.json`); return; }
      window.location.href = `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(code)}`;
    },
  });
  const save = (suffix) => ({
    timeline: [{ type: jsPsychPipe, action: "save", experiment_id: cfg.DATAPIPE_EXPERIMENT_ID,
      filename: `${pid}_${session}${suffix}.json`, data_string: () => jsPsych.data.get().json() }],
    conditional_function: () => !!saving,
  });

  // ---------- intro ----------
  const browser = {
    type: jsPsychBrowserCheck, minimum_width: 1000, minimum_height: 600,
    inclusion_function: (d) => !d.mobile,
    exclusion_message: (d) => d.mobile
      ? page("<p>This study needs a desktop or laptop computer. Please return the study on Prolific.</p>")
      : page("<p>Please make your browser window larger (at least 1000 × 600) and reload the page.</p>"),
  };
  const consent = {
    type: jsPsychHtmlButtonResponse, choices: ["I agree to take part", "I do not agree"],
    stimulus: page(`<h1>Checking instructions for a computer assistant</h1>${cfg.CONSENT_HTML}
      <p>The study takes about <b>${cfg.STUDY_MINUTES} minutes</b>. Please do not use AI tools or other people's help.</p>`),
    data: { phase: "consent" },
    on_finish: (d) => { consentGiven = d.response === 0; d.consent = consentGiven; },
  };
  let consentGiven = false;
  const noConsent = { timeline: [{ type: jsPsychHtmlButtonResponse, choices: [],
    stimulus: page("<h1>Thank you</h1><p>You did not consent, so the study ends here. Please <b>return</b> the study on Prolific; no data were recorded.</p>") }],
    conditional_function: () => !consentGiven };

  const instructions = {
    type: jsPsychInstructions, show_clickable_nav: true, allow_backward: true,
    pages: [
      page(`<h1>What you will do</h1>
        <p>A computer assistant is carrying out a task for a user by calling tools (for example, searching flights or moving files).
        On each screen you see:</p>
        <ol><li>the user's <b>instruction</b>;</li>
        <li>what the assistant has <b>done so far</b>: its tool calls and what the tools returned;</li>
        <li><b>two possible next actions</b>, which differ in one detail (highlighted).</li></ol>
        <p>Your job: decide <b>which action the instruction calls for next</b>, using only the instruction and the history shown.</p>`),
      page(`<h1>Your answer options</h1>
        <ul><li><b>Action 1</b> or <b>Action 2</b> – the instruction calls for that action.</li>
        <li><b>Both actions are acceptable</b> – either action would satisfy the instruction equally well.</li>
        <li><b>Neither action</b> – both actions contradict the instruction.</li>
        <li><b>Cannot be determined from the history</b> – the instruction and history do not contain what you need to decide.</li></ul>
        <p>If you choose one of the last three, write a short note saying why.</p>
        <p>You will also say whether the history is a reasonable start for the instruction, and how confident you are.</p>`),
      page(`<h1>Things to know</h1>
        <ul><li>Some answers are stated in the instruction; others must be read from the <b>tool output</b> (for example, which flight is cheapest).
        Long tool outputs scroll; click “Show the whole output” to expand them.</li>
        <li>When an action picks one option from a list (a flight, a product, a reminder), you also get a table of
        <b>all listed options</b> with their prices, times and features; click a column header to sort it (for example, by price).
        The rows the two actions pick are labelled, and their original entries are copied under each action in a yellow box.</li>
        <li>Some tool calls are written as short computer code with long random IDs (like <code>chatcmpl_tool_91df…</code>). Ignore the IDs; look at the values.</li>
        <li>The assistant's clock gives the time as a <b>Unix timestamp</b> (a number such as 1789578016). Each timestamp is followed by its
        date and time in square brackets, e.g. <code>1789578016 [= Wed Sep 16 2026, 11:20:16 AM]</code>.
        A timestamp converter and a calculator are on the right if you need them.</li>
        <li>Judge whether the action does what the <b>user asked for</b>. Ignore politeness, formatting, and company rules.</li>
        <li>The two actions appear in random order. Nothing on the page tells you which is intended.</li></ul>`),
      page(`<h1>Before you start</h1><p>Next come three short questions about these instructions, then four practice items with feedback,
        then the main items (about ${list.rows.length}). Two items check attention: they tell you exactly what to answer.</p>`),
    ],
  };

  const QUIZ = [
    { prompt: "What should you base your answer on?", options: ["What I think the user probably wants in general", "Only the instruction and the history shown on the page", "Which action looks more common"], correct: 1 },
    { prompt: "The history does not contain the information needed to choose. What do you answer?", options: ["Action 1", "Neither action", "Cannot be determined from the history"], correct: 2 },
    { prompt: "The clock shows 1789578016 [= Wed Sep 16 2026, 11:20:16 AM]. What day is 'tomorrow'?", options: ["Tuesday, September 15", "Thursday, September 17", "It cannot be known"], correct: 1 },
  ];
  let quizAttempts = 0, quizPassed = false;
  const quiz = {
    timeline: [{
      type: jsPsychSurveyMultiChoice,
      preamble: () => page(quizAttempts === 0 ? "<h1>Check your understanding</h1>" : "<h1>Check your understanding</h1><p class='err'>Some answers were not right. Please re-read and try once more.</p>"),
      questions: QUIZ.map((q, i) => ({ prompt: q.prompt, options: q.options, required: true, name: "q" + i })),
      data: { phase: "quiz" },
      on_finish: (d) => { quizAttempts++; quizPassed = QUIZ.every((q, i) => d.response["q" + i] === q.options[q.correct]); d.quiz_passed = quizPassed; d.quiz_attempt = quizAttempts; },
    }, {
      timeline: [{ type: jsPsychInstructions, show_clickable_nav: true, pages: () => [page("<h1>Please review</h1><p>Here are the instructions again.</p>")].concat(instructions.pages) }],
      conditional_function: () => !quizPassed && quizAttempts < cfg.MAX_QUIZ_ATTEMPTS,
    }],
    loop_function: () => !quizPassed && quizAttempts < cfg.MAX_QUIZ_ATTEMPTS,
  };
  const screenOut = { timeline: [save("_screenout"), endWith(cfg.SCREENOUT_CODE,
    "Unfortunately the comprehension questions were not answered correctly, so the study ends here. You will receive the screen-out payment.")],
    conditional_function: () => !quizPassed };

  // ---------- items ----------
  const rowTrial = (row, mode, extraParams = {}) => ({ type: jsPsychAuditRow, row, mode, time_zone: cfg.CLOCK_TIME_ZONE, ...extraParams });
  const practice = extra.practice.map((p, i) => rowTrial(p, "practice", { answer: p.answer, explanation: p.explanation, progress: `Practice ${i + 1} of ${extra.practice.length}` }));
  const practiceIntro = { type: jsPsychHtmlButtonResponse, choices: ["Start practice"], stimulus: page("<h1>Practice</h1><p>Four practice items. After each one you will see the expected answer.</p>") };
  const mainIntro = { type: jsPsychHtmlButtonResponse, choices: ["Start"], stimulus: page(`<h1>Main items</h1><p>You will now see ${list.rows.length + extra.attention.length} items without feedback. Take the time you need.</p>`) };

  const main = jsPsych.randomization.shuffle(list.rows.slice()).map((r) => ({ row: r, mode: "main" }));
  const n = main.length;
  main.splice(Math.round(n * 2 / 3), 0, { row: extra.attention[1], mode: "attention", answer: extra.attention[1].answer });
  main.splice(Math.round(n / 3), 0, { row: extra.attention[0], mode: "attention", answer: extra.attention[0].answer });
  const total = main.length, half = Math.floor(total / 2);
  const mainTimeline = [];
  main.forEach((m, i) => {
    mainTimeline.push(rowTrial(m.row, m.mode, { answer: m.answer ?? null, progress: `Item ${i + 1} of ${total}` }));
    if (i === half) mainTimeline.push(save("_part"));
  });

  const feedback = { type: jsPsychSurveyText, questions: [{ prompt: "Optional: was anything confusing or broken? (Leave empty if not.)", rows: 3, name: "comments" }], data: { phase: "comments" } };

  const study_ = { timeline: [practiceIntro, ...practice, mainIntro, ...mainTimeline, feedback, save(""),
    endWith(cfg.COMPLETION_CODE, "Your answers have been saved. Click below to return to Prolific.")],
    conditional_function: () => quizPassed };

  const consented = { timeline: [instructions, quiz, screenOut, study_],
    conditional_function: () => consentGiven };

  if (SAMPLE) {
    const rows = list.rows.map((r, i) => rowTrial(r, "main", { progress: `Debug sample: item ${i + 1} of ${list.rows.length}` }));
    await jsPsych.run([...rows, endWith(cfg.COMPLETION_CODE, "End of the debug sample.")]);
    return;
  }
  await jsPsych.run([browser, consent, noConsent, consented]);
})();
