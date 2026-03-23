const PRESENTER_CHANNEL_NAME = "instore-demo-presenter";
const PRESENTER_SNAPSHOT_KEY = "instore-demo-presenter-snapshot";

const elements = {
  stagePill: document.querySelector("#notesStagePill"),
  stageLabel: document.querySelector("#notesStageLabel"),
  speakerSummary: document.querySelector("#notesSpeakerSummary"),
  statusText: document.querySelector("#notesStatusText"),
  previewLink: document.querySelector("#notesPreviewLink"),
  notesList: document.querySelector("#notesList"),
  proofPoints: document.querySelector("#proofPoints"),
  cards: document.querySelector("#notesCards"),
  stageDescription: document.querySelector("#notesStageDescription"),
  planSummary: document.querySelector("#notesPlanSummary"),
  telemetry: document.querySelector("#notesTelemetry")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readStoredSnapshot() {
  try {
    const raw = window.localStorage.getItem(PRESENTER_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function renderSnapshot(snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};
  const notes = Array.isArray(data.presenterNotes) && data.presenterNotes.length > 0
    ? data.presenterNotes
    : ["Open the shared demo tab and move through the stages to hydrate these notes."];
  const proofPoints = Array.isArray(data.proofPoints) ? data.proofPoints : [];
  const cards = Array.isArray(data.cards) ? data.cards : [];

  document.title = data.stageLabel ? `${data.stageLabel} | Presenter Notes` : "Presenter Notes";
  elements.stagePill.textContent = String(data.stagePill || "Waiting");
  elements.stageLabel.textContent = String(data.stageLabel || "Presenter Notes");
  elements.speakerSummary.textContent = String(
    data.speakerSummary || "Open the demo page and this tab will follow the active stage automatically."
  );
  elements.statusText.textContent = String(data.statusText || "Waiting for the shared demo tab.");
  elements.previewLink.href = String(data.previewUrl || "/screen.html");
  elements.previewLink.textContent = data.previewLabel
    ? `Open ${String(data.previewLabel)}`
    : "Open current screen";

  elements.notesList.innerHTML = notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");

  elements.proofPoints.innerHTML = proofPoints.length > 0
    ? proofPoints.map((point) => `<span>${escapeHtml(point)}</span>`).join("")
    : "<span>Waiting for stage proof points.</span>";

  elements.cards.innerHTML = cards.length > 0
    ? cards
        .map(
          (card) => `<article class="metric-card">
            <strong>${escapeHtml(card.value || "")}</strong>
            <span>${escapeHtml(card.label || "")}</span>
          </article>`
        )
        .join("")
    : `<article class="metric-card"><strong>0</strong><span>Waiting for live demo data</span></article>`;

  elements.stageDescription.textContent = String(data.stageDescription || "The companion notes update as the active stage changes.");
  elements.planSummary.textContent = String(
    data.planSummary || data.planScopeMessage || `Scope ${String(data.planScope || "All mapped pages")}`
  );
  elements.telemetry.textContent = String(data.telemetryText || "Plays 0 | Exposure 0s");
}

renderSnapshot(readStoredSnapshot());

if ("BroadcastChannel" in window) {
  const channel = new BroadcastChannel(PRESENTER_CHANNEL_NAME);
  channel.addEventListener("message", (event) => {
    renderSnapshot(event.data);
  });
  window.addEventListener("beforeunload", () => {
    channel.close();
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === PRESENTER_SNAPSHOT_KEY) {
    renderSnapshot(readStoredSnapshot());
  }
});
