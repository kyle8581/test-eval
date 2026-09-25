// Study configuration. Edit this file only; experiment.js reads everything from here.
window.AUDIT_CONFIG = {
  // DataPipe experiment ID (12 characters, from pipe.jspsych.org). Leave "" to run without saving.
  DATAPIPE_EXPERIMENT_ID: "",

  // Prolific completion codes (Study -> Completion paths).
  COMPLETION_CODE: "REPLACE_ME",
  SCREENOUT_CODE: "REPLACE_ME_SCREENOUT",   // failed the comprehension check twice

  // Shown on the consent page and in the Prolific study description.
  STUDY_MINUTES: 40,

  // Paste the IRB-approved consent text here (HTML allowed).
  CONSENT_HTML: `
    <p><b>Consent to participate.</b> REPLACE WITH THE IRB-APPROVED CONSENT TEXT
    (study title, investigators, purpose, procedures, time, compensation, risks,
    confidentiality, voluntary participation, contact information, IRB protocol number).</p>`,

  // The epoch converter shows times in this zone. ToolSandbox's clock runs in US Central time
  // (tools/analysis/predicates.py: SANDBOX_TZ = America/Chicago).
  CLOCK_TIME_ZONE: "America/Chicago",

  // Quality rules applied in the page (the analysis re-applies them from the saved data).
  MAX_QUIZ_ATTEMPTS: 2,
};
