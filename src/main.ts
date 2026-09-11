import { clinicAttractions } from './clinic-identity';
import { stations } from './emergency-map';
import { CareSkill, isCareTool } from './care-skill';
import { CareSkillView } from './care-skill-view';
import { zoneLabel, checkInstruction } from './game';
import './style.css';
import { World } from './world';
import { advanceActiveTime } from './active-time';
import { Audio } from './audio';
import { TownSimulation } from './town-simulation';
import { icon, petIcon } from './icons';
import {
  visits,
  toolInfo,
  upgrades,
  loadProgress,
  saveProgress,
  purchase,
  clinicCapacity,
  reward,
  examine,
  type Visit,
  type Tool,
  type Zone,
} from './game';

type Mode =
  | 'town'
  | 'reception'
  | 'examine'
  | 'diagnose'
  | 'place-vaccine'
  | 'treat'
  | 'result';
const app = document.querySelector<HTMLDivElement>('#app')!;
const progress = loadProgress();
const simulation = new TownSimulation(visits);
if (!simulation.restore(progress.town)) simulation.seedClinic();
let townRevision = simulation.revision;
let lastTownSave = 0;
const audio = new Audio();
audio.enabled = progress.sound;
let pendingPatient: number | null = null;
let clinicView = 'reception';
let mode: Mode = 'reception';
let modal: 'shop' | 'guide' | 'casebook' | null = null;
let queue = simulation.queue;
let patient: Visit | null = null;
let patientId = 0;
let findings = new Set<number>();
let notebookTab: 'clues' | 'notes' = 'clues';
let cluePulseUntil = 0;
let cluePulseTimer: ReturnType<typeof setTimeout> | undefined;
let observations = new Map<
  string,
  { text: string; label: string; keyClue: boolean }
>();
let selectedTool: Tool | null = null;
let mistakes = 0;
let timing = false;
let careActivity: CareSkillView | null = null;
let receipt: ReturnType<typeof reward> | null = null;
let ready = false;
let world: World;
let toastUntil = 0;
let enteringTown = false;
let selectedHome: number | undefined;
let townStatusAt = 0;
let officeTab: 'patients' | 'activities' = 'patients';
let patientPage = 0;
let activityPage = 0;
let townTab: 'homes' | 'details' | 'news' = 'homes';
let homePage = 0;
let newsPage = 0;

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Louise's Vet Office home"><span class="brand-mark">${icon('paw')}</span><h1>Louise’s<span class="brand-sub">VET OFFICE</span></h1></a>
    <div class="day-heading"><span class="sun-badge">${icon('sun')}</span><div><strong id="day-label"></strong><span>A lovely day to lend a paw.</span></div></div>
    <div id="stats" class="stats"></div>
    <div class="header-actions"><button id="sound-button" class="icon-button" data-action="sound"></button><button class="icon-button" data-action="guide" aria-label="How to play">${icon('help')}</button></div>
  </header>
  <main class="workspace">
    <aside id="sidebar" class="sidebar" aria-label="Patient information"></aside>
    <section class="stage" aria-label="Clinic game view">
      <div id="world" class="world">
        <div id="scene-title" class="scene-title"></div><div id="scene-goal" class="scene-goal"></div>
        <div id="zones" class="zones"></div><div id="scene-controls" class="scene-controls"></div>
        <div id="precision"></div><div id="scene-caption" class="scene-caption"></div>
        <div id="loading" class="loading"><span class="loading-paw">${icon('paw')}</span><h2>Opening the clinic…</h2><p>Making everything cosy for our little visitors.</p></div>
      </div>
      <div id="stage-footer" class="stage-footer"></div>
    </section>
  </main>
  <section id="clue-summary" class="clue-summary" aria-label="Care notebook" hidden></section>
  <div id="visit-actions" class="visit-actions" role="region" aria-label="Visit actions" hidden></div>
  <footer class="bottom-bar"><nav aria-label="Clinic navigation"><button class="nav-button active" data-action="reception">${icon('home')}<span>My clinic</span></button><button class="nav-button" data-action="town">${icon('home')}<span>Hookville</span></button><button class="nav-button" data-action="shop">${icon('bag')}<span>Clinic shop</span><span class="tiny-label">UPGRADES</span></button><button class="nav-button" data-action="casebook">${icon('book')}<span>Care notebook</span></button></nav><span id="save-note" class="save-note">${icon('check')} Progress saved on this browser</span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root"></div><div id="skill-root"></div>`;

const byId = (id: string) => document.getElementById(id)!;
function announce(text: string) {
  byId('toast').textContent = text;
  byId('toast').classList.add('show');
  toastUntil = performance.now() + 4600;
}
function clearAnnouncement() {
  byId('toast').textContent = '';
  byId('toast').classList.remove('show');
  toastUntil = 0;
}
function save() {
  progress.town = simulation.snapshot();
  const okay = saveProgress(progress);
  byId('save-note').innerHTML = okay
    ? `${icon('check')} Progress saved on this browser`
    : `${icon('help')} Saving unavailable · keep this tab open`;
}
const visitFor = (id: number) => simulation.visit(id);
const button = (
  label: string,
  action: string,
  cls = 'primary',
  disabled = false,
) =>
  `<button class="${cls}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;

function renderStats() {
  byId('day-label').textContent =
    `YOUR CLINIC · DAY ${Math.floor(progress.treated / 3) + 1}`;
  byId('stats').innerHTML =
    `<div class="stat happiness" title="Average animal and customer satisfaction">${icon('heart')}<span><strong data-testid="happiness">${progress.happiness}%</strong><small>HAPPY HEARTS</small></span></div><div class="stat wallet">${icon('coin')}<span><strong data-testid="coins">${progress.coins.toLocaleString()}</strong><small>CLINIC COINS</small></span></div>`;
  const sound = byId('sound-button');
  sound.innerHTML = icon(audio.enabled ? 'sound' : 'mute');
  sound.setAttribute(
    'aria-label',
    audio.enabled ? 'Turn sound off' : 'Turn sound on',
  );
  sound.setAttribute('aria-pressed', String(audio.enabled));
}
function renderReception() {
  patientPage = Math.min(
    patientPage,
    Math.max(0, Math.ceil(queue.length / 2) - 1),
  );
  const sidebarMarkup = `
    <div class="panel-heading louise-welcome"><img class="louise-portrait" src="/images/louise-portrait.png" alt="Louise in her mint vet coat and pink headband" width="76" height="76" /><div><p class="eyebrow">MADE JUST FOR YOU</p><h2>Welcome, <br />Louise.</h2></div></div>
    <nav class="office-tabs" aria-label="Waiting room information"><button class="secondary" data-action="office-tab" data-tab="patients" aria-pressed="${officeTab === 'patients'}">Patients · ${queue.length}</button><button class="secondary" data-action="office-tab" data-tab="activities" aria-pressed="${officeTab === 'activities'}">While you wait</button></nav>
    <div id="clinic-call" aria-live="polite"></div><section class="office-patients" ${officeTab !== 'patients' ? 'hidden' : ''}><div class="queue-heading"><h3>In the waiting room</h3><span class="count">${queue.length}</span></div>
    <div class="patient-list">${
      queue
        .map((id, i) => {
          const p = visitFor(id);
          return `<button class="patient-card ${i === 0 ? 'next' : ''}" data-action="patient" data-id="${id}" ${Math.floor(i / 2) !== patientPage ? 'hidden' : ''} ${!ready ? 'disabled' : ''} aria-label="See ${p.name}"><span class="pet-avatar ${p.color}">${petIcon(p.species)}</span><span class="patient-card-text"><strong>${p.name}<small>${p.breed}</small></strong><span>${p.symptom}</span></span><span class="queue-order">${i === 0 ? 'NEXT' : String(i + 1).padStart(2, '0')}</span></button>`;
        })
        .join('') ||
      '<div class="empty-queue">A quiet little moment.<br />A new visitor will be here soon.</div>'
    }</div>
    <nav class="office-pages" aria-label="Patient pages"><button class="secondary" data-action="patient-page" data-step="-1" ${patientPage === 0 ? 'disabled' : ''} aria-label="Previous patients">←</button><span>${patientPage + 1} / ${Math.max(1, Math.ceil(queue.length / 2))}</span><button class="secondary" data-action="patient-page" data-step="1" ${patientPage >= Math.ceil(queue.length / 2) - 1 ? 'disabled' : ''} aria-label="Next patients">→</button></nav>
    ${queue.length ? button(`See ${visitFor(queue[0]).name} ${icon('arrow')}`, 'next', 'primary call-next', !ready) : button('Welcome a visitor', 'invite', 'primary call-next', !ready)}
    </section><div class="shelf-summary"><span>${icon('jar')} Treats on the shelf</span><strong>${progress.stock}</strong></div>`;
  // Town events should not replace unchanged controls under a pointer or keyboard.
  const sidebar = byId('sidebar');
  const replaceSidebar =
    sidebar.dataset.receptionMarkup !== sidebarMarkup ||
    !sidebar.querySelector('[data-action="office-tab"]');
  if (replaceSidebar) {
    sidebar.innerHTML = sidebarMarkup;
    sidebar.dataset.receptionMarkup = sidebarMarkup;
  }
  renderClinicTitle();
  byId('scene-goal').innerHTML =
    `<span class="goal-icon">${icon('star')}</span><div><small>TODAY’S LITTLE GOAL</small><strong>Help 3 animal friends</strong><div class="goal-dots">${[0, 1, 2].map((i) => `<span class="${progress.treated % 3 > i ? 'done' : ''}">${progress.treated % 3 > i ? icon('check') : ''}</span>`).join('')}</div></div>`;
  const cameraControls = `<button data-action="clinic-left" aria-label="Pan clinic left">←</button><button data-action="clinic-right" aria-label="Pan clinic right">→</button><button data-action="clinic-up" aria-label="Pan clinic up">↑</button><button data-action="clinic-down" aria-label="Pan clinic down">↓</button><button data-action="clinic-in" aria-label="Zoom into clinic">+</button><button data-action="clinic-out" aria-label="Zoom out of clinic">−</button>`;
  if (byId('scene-controls').innerHTML !== cameraControls)
    byId('scene-controls').innerHTML = cameraControls;
  byId('zones').innerHTML = '';
  byId('precision').innerHTML = '';
  if (replaceSidebar)
    sidebar.insertAdjacentHTML(
      'beforeend',
      `<section id="clinic-leisure" class="clinic-leisure" aria-label="Waiting room activities" ${officeTab !== 'activities' ? 'hidden' : ''}></section>`,
    );
  renderLeisure();
  byId('stage-footer').innerHTML =
    `<span class="footer-tip">${icon('paw')} Choose a patient to begin their visit.</span><span class="clinic-total">${progress.treated} friends helped <span>·</span> ${progress.earned} coins earned</span>`;
}
function renderClinicTitle() {
  const focused = (document.activeElement as HTMLElement)?.dataset.view;
  const label =
    clinicView === 'free'
      ? 'YOUR CLINIC'
      : clinicView === 'exam'
        ? 'EXAMINATION ROOM'
        : clinicView === 'escort'
          ? 'FOLLOW LOUISE'
          : clinicView === 'courtyard'
            ? 'Sunshine courtyard'
            : clinicView === 'annex'
              ? 'PLAY GARDEN'
              : clinicView === 'play'
                ? 'PET PLAYGROUND'
                : clinicView === 'lounge'
                  ? 'CUSTOMER LOUNGE'
                  : clinicView === 'all'
                    ? 'YOUR GROWING CLINIC'
                    : 'RECEPTION';
  const heading =
    clinicView === 'free'
      ? 'Take a look around'
      : clinicView === 'exam'
        ? 'A calm place for gentle care'
        : clinicView === 'escort'
          ? 'Let’s go to the examination room'
          : clinicView === 'courtyard'
            ? 'Bubbles, birds and cosy corners'
            : clinicView === 'annex'
              ? 'Wings, whiskers and little adventures'
              : clinicView === 'play'
                ? 'Little adventures while we wait'
                : clinicView === 'lounge'
                  ? 'Make yourself comfortable'
                  : 'Your happy little clinic';
  byId('scene-title').innerHTML =
    `<span class="room-pill"><i></i> ${label}</span><h2>${heading}</h2>`;
  const caption = `<nav class="clinic-views" aria-label="Clinic rooms">${[['reception', 'Reception'], ['exam', 'Exam room'], ...(progress.upgrades.includes('expansion') ? [['lounge', 'Customer lounge']] : []), ...(progress.upgrades.includes('pet-room') ? [['play', 'Pet playground']] : []), ...(progress.upgrades.includes('play-annex') ? [['annex', 'Play garden']] : []), ...(progress.upgrades.includes('sun-courtyard') ? [['courtyard', 'Courtyard']] : []), ['all', 'Whole clinic']].map(([id, name]) => `<button class="secondary" data-action="clinic-view" data-view="${id}" aria-label="${name}" aria-pressed="${clinicView === id}"><span class="room-name-full">${name}</span><span class="room-name-short" aria-hidden="true">${({ lounge: 'Lounge', play: 'Playground', all: 'All rooms' } as Record<string, string>)[id] ?? name}</span></button>`).join('')}</nav>`;
  if (byId('scene-caption').innerHTML !== caption)
    byId('scene-caption').innerHTML = caption;
  if (focused)
    byId('scene-caption')
      .querySelector<HTMLButtonElement>(`[data-view="${focused}"]`)
      ?.focus({ preventScroll: true });
}
function renderLeisure() {
  const panel = document.getElementById('clinic-leisure');
  if (!panel || !world) return;
  const callNext = document.querySelector<HTMLButtonElement>('.call-next');
  if (callNext) callNext.hidden = pendingPatient !== null;
  const call = document.getElementById('clinic-call');
  const escortStage =
    simulation.escort.ticket === pendingPatient
      ? simulation.escort.phase
      : 'collecting';
  if (call) call.dataset.stage = pendingPatient === null ? 'idle' : escortStage;
  const callMessage =
    pendingPatient === null
      ? ''
      : escortStage === 'lead'
        ? `Louise is leading ${visitFor(pendingPatient).name} and their owner into the examination room.`
        : escortStage === 'approach'
          ? 'Louise is coming around the counter to meet you.'
          : `${visitFor(pendingPatient).name} and their owner are coming to the desk.`;
  const callContent =
    pendingPatient !== null
      ? `<p>${callMessage} <button class="secondary" data-action="cancel-call">Cancel call</button></p>`
      : '';
  if (call && call.dataset.content !== callContent) {
    call.innerHTML = callContent;
    call.dataset.content = callContent;
  }
  const states = simulation.leisure.summary();
  const activities = states.map(
    (s) =>
      `<strong>${clinicAttractions[s.id].name}</strong><p>${s.using === undefined ? 'Ready for a turn' : visitFor(s.using).name + ' is playing'} · ${s.queued} in line</p>`,
  );
  for (const a of simulation.leisure.owners.values()) {
    const action =
      a.phase === 'read'
        ? 'reading'
        : a.phase === 'game'
          ? 'playing a board game'
          : a.phase === 'sit'
            ? 'sitting comfortably'
            : a.phase === 'walk'
              ? 'finding their waiting place'
              : a.phase === 'stand'
                ? 'waiting for a seat'
                : a.phase === 'check-in'
                  ? 'checking in'
                  : a.phase === 'desk'
                    ? 'walking to Louise'
                    : a.phase === 'ready'
                      ? 'at Louise’s desk'
                      : a.phase === 'escort'
                        ? 'following Louise'
                        : a.phase === 'in-room'
                          ? 'in the examination room'
                          : 'waiting for their pet';
    activities.push(
      `<strong>${simulation.households[a.household].owner}</strong><p>${action}</p>`,
    );
  }
  if (!activities.length)
    activities.push(
      '<strong>A cosy place to wait</strong><p>Add books, games and rides in the clinic shop.</p>',
    );
  activityPage = Math.min(activityPage, Math.ceil(activities.length / 2) - 1);
  const content = `<h3>While you wait</h3><ul>${activities.map((entry, i) => `<li ${Math.floor(i / 2) !== activityPage ? 'hidden' : ''}>${entry}</li>`).join('')}</ul><nav class="office-pages" aria-label="Activity pages"><button class="secondary" data-action="activity-page" data-step="-1" ${activityPage === 0 ? 'disabled' : ''} aria-label="Previous activities">←</button><span>${activityPage + 1} / ${Math.ceil(activities.length / 2)}</span><button class="secondary" data-action="activity-page" data-step="1" ${activityPage >= Math.ceil(activities.length / 2) - 1 ? 'disabled' : ''} aria-label="Next activities">→</button></nav>`;
  if (panel.dataset.content !== content) {
    const focused = panel.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)?.dataset.step
      : undefined;
    panel.innerHTML = content;
    panel.dataset.content = content;
    if (focused)
      panel
        .querySelector<HTMLButtonElement>(`[data-step="${focused}"]`)
        ?.focus({ preventScroll: true });
  }
}
let pointedResident: string | undefined;
function showHome(id: number | undefined) {
  if (id !== undefined) {
    selectedHome = id;
    townTab = 'details';
    renderTownPanels();
  }
  const panel = document.getElementById('town-home');
  if (!panel || !world.town) return;
  const h =
    selectedHome === undefined
      ? undefined
      : world.town.simulation.households[selectedHome];
  const neighbours = h
    ? simulation.households.filter((other) => other.lot === h.lot)
    : [];
  const homeLabel = document.getElementById('town-label');
  if (homeLabel)
    homeLabel.textContent =
      pointedResident ??
      (selectedHome === -1
        ? 'Louise’s Vet Office'
        : h
          ? h.label
          : 'Hover or tap a person, pet or home to meet your neighbours');
  const markup =
    selectedHome === -1
      ? `<h3>Louise’s Vet Office</h3><p>The heart of Hookville. ${queue.length} pets are waiting.</p>${button('Enter the clinic', 'reception')}`
      : h
        ? `<h3>${h.label}</h3><p>${simulation.status(h)}</p><p>${h.pets.map((p) => `${p.name} · ${p.species}`).join(' · ')}</p><button class="secondary" data-action="follow-family" data-id="${h.id}">Follow ${h.owner}</button>${neighbours.length > 1 ? `<p class="flat-neighbours">Shared flat · ${neighbours.map((n) => `<button class="secondary" data-action="home" data-id="${n.id}" aria-pressed="${n.id === h.id}">${n.owner}</button>`).join('')}</p>` : ''}`
        : '<h3>Every home has a story</h3><p>Hover or tap a house, or choose a family below.</p>';
  if (panel.dataset.markup !== markup) {
    panel.innerHTML = markup;
    panel.dataset.markup = markup;
  }
}
function renderTown() {
  pointedResident = undefined;
  byId('sidebar').innerHTML =
    `<div class="panel-heading"><h2>Hookville</h2></div><nav class="office-tabs" aria-label="Town information">${[
      ['homes', 'Homes'],
      ['details', 'Home info'],
      ['news', 'Town news'],
    ]
      .map(
        ([id, label]) =>
          `<button class="secondary" data-action="town-tab" data-tab="${id}" aria-pressed="${townTab === id}">${label}</button>`,
      )
      .join(
        '',
      )}</nav><section id="town-directory" aria-label="Your neighbours"><div class="household-list">${world.town!.simulation.households.map((h, i) => `<button class="secondary" data-action="home" data-id="${h.id}" ${Math.floor(i / 4) !== homePage ? 'hidden' : ''}>${h.label}</button>`).join('')}</div><nav class="office-pages" aria-label="Home pages"><button class="secondary" data-action="home-page" data-step="-1" ${homePage === 0 ? 'disabled' : ''} aria-label="Previous homes">←</button><span>${homePage + 1} / ${Math.ceil(simulation.households.length / 4)}</span><button class="secondary" data-action="home-page" data-step="1" ${homePage >= Math.ceil(simulation.households.length / 4) - 1 ? 'disabled' : ''} aria-label="Next homes">→</button></nav></section><div id="town-home" class="town-home" aria-live="polite"></div><section id="town-news" class="town-news" aria-label="Hookville happenings"></section>`;
  byId('scene-title').innerHTML =
    '<span class="room-pill"><i></i> HOOKVILLE · V2</span><h2 id="weather-title">A lovely day in town</h2>';
  byId('scene-goal').innerHTML = '';
  byId('scene-caption').innerHTML =
    '<span id="town-label" class="orbit-hint" aria-live="polite">Hover or tap a person, pet or home to meet your neighbours</span>';
  byId('scene-controls').innerHTML =
    `<button data-action="town-left" aria-label="Pan town left">←</button><button data-action="town-right" aria-label="Pan town right">→</button><button data-action="town-up" aria-label="Pan town up">↑</button><button data-action="town-down" aria-label="Pan town down">↓</button><button data-action="town-in" aria-label="Zoom into town">+</button><button data-action="town-out" aria-label="Zoom out of town">−</button><button data-action="town-park">Pet park</button><button data-action="town-reset">Whole town</button>`;
  byId('stage-footer').innerHTML =
    `${button('Back to the clinic', 'reception', 'secondary')}<span class="clinic-total">High Street · Willow Crescent · Orchard Lane</span>`;
  byId('zones').innerHTML = '';
  byId('precision').innerHTML = '';
  showHome(undefined);
  renderTownWeather();
  renderTownNews();
  renderTownPanels();
}
function renderTownWeather() {
  const el = document.getElementById('weather-title');
  if (el)
    el.textContent =
      simulation.weather.phase === 'rain'
        ? 'A little shower · cats seek shelter'
        : 'Sunny skies in Hookville';
}
function renderTownPanels() {
  if (!document.getElementById('town-directory')) return;
  for (const [tab, id] of [
    ['homes', 'town-directory'],
    ['details', 'town-home'],
    ['news', 'town-news'],
  ])
    byId(id).hidden = townTab !== tab;
  byId('sidebar')
    .querySelectorAll<HTMLButtonElement>('[data-action="town-tab"]')
    .forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.tab === townTab),
      ),
    );
}
function renderTownNews() {
  const el = document.getElementById('town-news');
  if (!el) return;
  newsPage = Math.min(
    newsPage,
    Math.max(0, Math.min(4, simulation.events.length) - 1),
  );
  if (!el.querySelector('.emergency-services'))
    el.innerHTML = `<h3>Around Hookville</h3><nav class="emergency-services" aria-label="Community helpers"><button class="secondary" data-action="town-fire">Fire station</button><button class="secondary" data-action="town-police">Police station</button><button class="secondary" data-action="town-rescue">Watch rescue</button></nav><div class="town-news-live"></div>`;
  const markup = `<p class="emergency-status">${simulation.emergencies.description()}</p><ul>${
    simulation.events
      .slice(-4)
      .reverse()
      .map((e, i) => {
        const h = simulation.households.find((h) =>
          h.pets.some((p) => p.name === e.pet),
        )!;
        return `<li ${i !== newsPage ? 'hidden' : ''}>${simulation.eventText(e)} <button class="secondary" data-action="follow-family" data-id="${h.id}">Find ${h.owner}</button></li>`;
      })
      .join('') || '<li>A lovely day for a walk.</li>'
  }</ul><nav class="office-pages" aria-label="News pages"><button class="secondary" data-action="news-page" data-step="-1" ${newsPage === 0 ? 'disabled' : ''} aria-label="Newer news">←</button><span>${newsPage + 1} / ${Math.max(1, Math.min(4, simulation.events.length))}</span><button class="secondary" data-action="news-page" data-step="1" ${newsPage >= Math.min(4, simulation.events.length) - 1 ? 'disabled' : ''} aria-label="Older news">→</button></nav>`;
  if (el.dataset.markup !== markup) {
    el.querySelector('.town-news-live')!.innerHTML = markup;
    el.dataset.markup = markup;
  }
}
function renderCase() {
  if (!patient) return;
  const vaccination = patient.treatment === 'vaccine';
  const steps = vaccination
    ? ['Find a spot', 'Gentle vaccine']
    : patient.purpose === 'checkup'
      ? ['Standard checks', 'Healthy checkup']
      : ['Examine', 'Diagnose', 'Treat'];
  const step = vaccination
    ? timing
      ? 1
      : 0
    : mode === 'examine'
      ? 0
      : mode === 'diagnose'
        ? 1
        : 2;
  const diagnosticTools: Tool[] =
    patient.species === 'goldfish'
      ? ['water-test', 'inspect', 'xray']
      : patient.species === 'bird'
        ? ['listen', 'inspect', 'thermometer', 'xray']
        : ['listen', 'inspect', 'ear', 'xray', 'mouth', 'thermometer'];
  const treatments = [
    ...new Set<Tool>([patient.treatment, 'cream', 'bandage', 'comb']),
  ];
  byId('sidebar').innerHTML = `
    <div class="case-heading"><span class="pet-avatar large ${patient.color}">${petIcon(patient.species)}</span><div><p class="eyebrow">YOUR LITTLE PATIENT</p><h2>${patient.name}</h2><p>${patient.breed} · ${patient.age}</p></div></div>
    <div class="owner-note"><p>“${patient.quote}”</p><span>— ${patient.owner}, ${patient.name}’s person</span></div>
    <ol class="case-steps">${steps.map((label, i) => `<li class="${i === step ? 'current' : i < step ? 'complete' : ''}"><span>${i < step ? icon('check') : i + 1}</span>${label}</li>`).join('')}</ol>
    ${vaccination ? `<div class="care-plan"><span>${icon('heart')} VACCINATION VISIT</span><h3>${timing ? 'A gentle touch' : 'Find a comfy spot'}</h3><p>${timing ? 'You found the spot! Now keep your hand steady.' : `The vaccine is ready. Find the soft patch of fur on ${patient.name}’s upper body. Turn her around and tap the matching body marker.`}</p></div><p class="instruction">${timing ? 'Begin gently, then pause in the striped pressure patch. A wobbly try gives no vaccine and you can try again.' : 'No mystery to solve today — just a little practice with careful hands.'}</p>` : ''}
    ${mode === 'examine' ? `<div class="section-title"><h3>${patient.purpose === 'checkup' ? 'Standard checks' : 'Look & listen'}</h3><span>${findings.size}/${patient.checks.length} key clues</span></div>${patient.purpose === 'checkup' ? `<p class="instruction">Two standard checks for ${patient.name}. Choose a check below, then use its tool at the listed spot or choose the labelled body guide. Both ticks unlock Finish healthy checkup.</p><ol class="routine-checks" aria-label="Standard checks">${patient.checks.map((check, i) => `<li><button class="secondary ${findings.has(i) ? 'check-done' : ''}" data-action="tool" data-tool="${check.tool}" aria-pressed="${selectedTool === check.tool}">${icon(findings.has(i) ? 'check' : 'search')}<span>${checkInstruction(check, patient!.species)}${findings.has(i) ? '<strong>Done</strong>' : ''}</span></button></li>`).join('')}</ol>` : `<p class="instruction">Choose a tool, then hold and drag it over ${patient.name}. Look closely at what you see and hear. The body guides can help you place your tool.</p>`}<div class="tool-grid">${diagnosticTools.map(toolButton).join('')}</div>` : ''}
    ${
      mode === 'diagnose'
        ? `<h3 class="diagnosis-heading">What do your clues suggest?</h3><div class="diagnosis-choices">${diagnoses()
            .map(
              (d) =>
                `<button class="choice" data-action="diagnosis" data-diagnosis="${d}">${d}${icon('arrow')}</button>`,
            )
            .join('')}</div>`
        : ''
    }
    ${mode === 'treat' && !vaccination ? `<div class="care-plan"><span>${icon('check')} CARE PLAN</span><h3>${patient.diagnosis}</h3><p>${toolInfo[patient.treatment].name} → <strong>${zoneLabel(patient.zone, patient.species)}</strong></p></div><p class="instruction">Choose the right care tool and place it at the spot in your plan.</p><div class="tool-grid">${treatments.map(toolButton).join('')}</div>` : ''}
`;
  byId('scene-title').innerHTML =
    `<span class="room-pill treatment-pill">${icon('plus')} TREATMENT ROOM</span><h2>A little help for ${patient.name}</h2>`;
  byId('scene-goal').innerHTML =
    `<div class="comfort-badge">${icon('heart')} <span>Safe, cosy & cared for</span></div>`;
  byId('scene-caption').innerHTML =
    `<span class="orbit-hint">${icon('rotate')} ${selectedTool && !world.orbitMode ? 'Hold and drag your tool over the animal' : 'Drag to look around · scroll to zoom'}</span>`;
  byId('scene-controls').innerHTML =
    `<button class="orbit-mode" data-action="orbit-mode" aria-pressed="${world.orbitMode}">${world.orbitMode ? 'Use tool' : 'Look around'}</button><button class="icon-button" data-action="rotate-left" aria-label="Rotate animal left">↶</button><button class="icon-button" data-action="rotate-right" aria-label="Rotate animal right">↷</button><button class="icon-button" data-action="reset-camera" aria-label="Reset camera">${icon('rotate')}</button>`;
  byId('zones').innerHTML =
    (mode === 'examine' || mode === 'treat' || mode === 'place-vaccine') &&
    !timing
      ? `<svg class="zone-leaders" aria-hidden="true">${world
          .availableZones()
          .map(
            (zone) =>
              `<line data-leader="${zone}" /><circle data-point="${zone}" r="4" />`,
          )
          .join('')}</svg>` +
        world
          .availableZones()
          .map(
            (zone) =>
              `<button class="body-spot" data-action="zone" data-zone="${zone}" aria-label="${zoneLabel(zone, patient?.species)} on ${patient!.name}"><span class="spot-dot">${icon('plus')}</span><span class="spot-label">${zoneLabel(zone, patient?.species)}</span></button>`,
          )
          .join('')
      : '';
  byId('stage-footer').innerHTML =
    `<span class="footer-tip">${icon(selectedTool ? toolInfo[selectedTool].icon : 'heart')} ${selectedTool ? `${toolInfo[selectedTool].name} selected · ${patient.species === 'goldfish' && selectedTool === 'inspect' ? 'Look closely at the fins and scales' : patient.species === 'bird' ? toolInfo[selectedTool].hint.replace(/coat/g, 'feathers') : toolInfo[selectedTool].hint}` : mode === 'diagnose' ? 'Use both clues to choose your diagnosis.' : patient.purpose === 'checkup' ? 'Follow the two standard checks.' : 'Choose a tool to begin. Take your time looking and listening.'}</span><span class="clinic-total">${queue.length} waiting patiently</span>`;
  world.setInstrument(
    selectedTool,
    !timing && ['examine', 'treat', 'place-vaccine'].includes(mode),
  );
  renderPrecision();
}
function toolButton(tool: Tool) {
  return `<button class="tool-button ${selectedTool === tool ? 'selected' : ''}" data-action="tool" data-tool="${tool}" aria-pressed="${selectedTool === tool}" ${timing ? 'disabled' : ''}>${icon(toolInfo[tool].icon)}<span>${toolInfo[tool].name}</span></button>`;
}
function diagnoses() {
  const a = [patient!.diagnosis, ...patient!.alternatives];
  for (let i = 0; i < patientId % 3; i++) a.push(a.shift()!);
  return a;
}
function cancelCareActivity() {
  if (careActivity) mistakes += careActivity.skill.misses;
  careActivity?.dispose();
  careActivity = null;
  timing = false;
  if (patient?.treatment === 'vaccine') mode = 'place-vaccine';
  render();
  byId('sidebar')
    .querySelector<HTMLButtonElement>('.tool-button.selected')
    ?.focus();
}
function renderPrecision() {
  byId('precision').innerHTML = '';
  if (!timing) {
    careActivity?.dispose();
    careActivity = null;
    return;
  }
  if (!careActivity && patient && isCareTool(patient.treatment))
    careActivity = new CareSkillView(
      new CareSkill(
        patient.treatment,
        progress.upgrades.includes('equipment'),
        patient.zone,
      ),
      byId('skill-root'),
      {
        finish: applyCare,
        cancel: cancelCareActivity,
        stop: () => returnToReception(true),
      },
    );
}

function renderModal() {
  if (ready && (modal || mode !== 'reception')) world.clearClinicPick();
  const root = byId('modal-root');
  const previousShop = root.querySelector<HTMLElement>('.modal.shop');
  const shopScroll = previousShop?.scrollTop ?? 0;
  const focusedUpgrade = root.contains(document.activeElement)
    ? (document.activeElement as HTMLElement)?.dataset.upgrade
    : undefined;
  if (mode === 'result' && receipt && patient) {
    const stars =
      receipt.satisfaction >= 90 ? 3 : receipt.satisfaction >= 75 ? 2 : 1;
    root.innerHTML = `<div class="modal-scrim"><section class="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="result-stars">${[0, 1, 2].map((i) => icon('star', i < stars ? 'filled' : '')).join('')}</div><span class="pet-avatar result-pet ${patient.color}">${petIcon(patient.species)}</span><p class="eyebrow">ANOTHER HAPPY LITTLE HEART</p><h2 id="result-title">${patient.name} ${patient.purpose === 'checkup' ? 'has a healthy checkup' : patient.treatment === 'vaccine' ? 'is all set' : 'feels better'}!</h2><p>${patient.aftercare}</p><div class="result-happiness">${icon('heart')} ${receipt.satisfaction}% patient & customer happiness</div><dl class="receipt"><div><dt>Wonderful care</dt><dd>+${receipt.fee}</dd></div><div><dt>A thank-you from ${patient.owner}</dt><dd>+${receipt.tip}</dd></div>${receipt.retail ? `<div><dt>A treat for the trip home</dt><dd>+${receipt.retail}</dd></div>` : ''}<div class="receipt-total"><dt>Coins earned</dt><dd>${icon('coin')} +${receipt.total}</dd></div></dl>${button(`Back to reception ${icon('arrow')}`, 'finish', 'primary full-width')}<small>${progress.treated} animal friend${progress.treated === 1 ? '' : 's'} helped. You’re making a difference.</small></section></div>`;
    return;
  }
  if (!modal) {
    root.innerHTML = '';
    return;
  }
  let content = '';
  let title = '';
  if (modal === 'shop') {
    title = 'Make it feel like home';
    content = `<p class="modal-intro">A happier clinic, one little upgrade at a time.</p><div class="shop-balance">${icon('coin')} <strong>${progress.coins}</strong> coins to spend</div><div class="shop-grid">${upgrades
      .map((u) => {
        const owned = u.id !== 'stock' && progress.upgrades.includes(u.id);
        const required =
          'requires' in u && !progress.upgrades.includes(u.requires)
            ? upgrades.find((item) => item.id === u.requires)!.name
            : '';
        return `<article class="shop-card"><span class="shop-art ${u.id}">${icon(u.icon)}</span><small>${u.kind}</small><h3>${u.name}</h3><p>${u.description}</p><button class="${owned ? 'owned' : 'secondary'}" data-action="buy" data-upgrade="${u.id}" ${owned || required || progress.coins < u.price ? 'disabled' : ''}>${owned ? `${icon('check')} In your clinic` : required ? `Build ${required} first` : `${icon('coin')} ${u.price} ${progress.coins < u.price ? '· Save a little more' : ''}`}</button></article>`;
      })
      .join('')}</div>`;
  } else if (modal === 'guide') {
    title = 'Every little patient matters';
    content = `<p class="modal-intro">Welcome to Louise’s Vet Office. You bring the kindness. We’ll show you the rest.</p><div class="guide-steps">${[
      [
        'paw',
        'Welcome a neighbour',
        'Choose an animal in the waiting room. Read what their person has noticed.',
      ],
      [
        'rotate',
        'Take a look around',
        'In the clinic or Hookville, drag to look around and use the arrows to move. Scroll or pinch to zoom. Right-drag on a computer, or move two fingers on a phone, to pan. The room buttons jump straight to your favourite places. Hover or tap clinic friends and attractions for a little bubble above their head. It follows them for five seconds. Friends also share their thoughts as they play and explore!',
      ],
      [
        'search',
        'Be a little detective',
        'For a poorly pet, choose tools and tap body markers to collect two key clues. Drag to rotate; scroll or pinch to zoom.',
      ],
      [
        'book',
        'Join the clues together',
        'Pick the diagnosis that matches your findings. A routine checkup only needs healthy checks, then Finish healthy checkup. It is always okay to try again.',
      ],
      [
        'heart',
        'Give a gentle helping hand',
        'Choose the care tool and body spot, then follow its activity: spread, wrap, brush, aim or use gentle control. Start when ready and choose Finish care after success. Vaccination visits go straight to placement and gentle pressure.',
      ],
      [
        'bag',
        'Grow your happy place',
        'Earn coins and happiness. Refill treats, add furniture, or make room for more neighbours. Need a break? Stop visit returns your patient to the waiting room to start again later.',
      ],
    ]
      .map(
        ([i, h, p]) =>
          `<div>${icon(i)}<span><h3>${h}</h3><p>${p}</p></span></div>`,
      )
      .join(
        '',
      )}</div><p class="parent-note">Made for ages 7+. This is storybook animal care; a real animal needs a real veterinarian. Progress is saved in this browser. Sound is optional.</p>`;
  } else {
    title = 'Louise’s care notebook';
    content = `<p class="modal-intro">A good vet stays curious. These friendly reminders can help you put the clues together.</p><div class="notebook-grid">${visits.map((p) => `<article><span class="pet-avatar ${p.color}">${petIcon(p.species)}</span><div><h3>${p.diagnosis}</h3><p>${p.treatment === 'vaccine' ? 'Find the soft fur patch, then control the vaccine pressure and pause in the striped patch.' : p.checks[0].finding}</p><small>${toolInfo[p.treatment].name} · ${zoneLabel(p.zone, p.species)}</small></div></article>`).join('')}</div>`;
  }
  root.innerHTML = `<div class="modal-scrim"><section class="modal ${modal}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p class="eyebrow">LOUISE’S VET OFFICE</p><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close ${modal}">${icon('close')}</button></header>${content}</section></div>`;
  if (modal === 'shop' && previousShop) {
    const shop = root.querySelector<HTMLElement>('.modal.shop')!;
    const card =
      focusedUpgrade &&
      shop.querySelector<HTMLButtonElement>(
        `[data-upgrade="${focusedUpgrade}"]`,
      );
    if (card) {
      card.closest('article')!.setAttribute('tabindex', '-1');
      (card.disabled ? card.closest<HTMLElement>('article')! : card).focus({
        preventScroll: true,
      });
    }
    shop.scrollTop = shopScroll;
  }
}
function renderVisitActions() {
  const summary = byId('clue-summary');
  const cluesComplete = Boolean(
    patient?.checks.length && findings.size >= patient.checks.length,
  );
  const pulseRemaining = Math.max(0, cluePulseUntil - performance.now());
  summary.hidden =
    !patient ||
    patient.treatment === 'vaccine' ||
    !['examine', 'diagnose', 'treat'].includes(mode) ||
    timing ||
    Boolean(modal);
  summary.innerHTML = summary.hidden
    ? ''
    : `<div class="notebook-tabs" role="group" aria-label="Care notebook pages">
        <button class="secondary ${cluesComplete ? 'clues-complete' : ''} ${pulseRemaining ? 'clue-discovered' : ''}" style="--clue-delay: -${2400 - pulseRemaining}ms" data-action="notebook" data-tab="clues" aria-pressed="${notebookTab === 'clues'}">Key clues · ${findings.size}/${patient!.checks.length}${cluesComplete ? ' · ✓ Ready' : ''}</button>
        <button class="secondary" data-action="notebook" data-tab="notes" aria-pressed="${notebookTab === 'notes'}">Care notes · ${observations.size}</button>
      </div>
      <section class="notebook-page" aria-label="Key clues" ${notebookTab !== 'clues' ? 'hidden' : ''} tabindex="0"><ul>${
        [...observations.values()]
          .filter((o) => o.keyClue)
          .map((o) => `<li>${o.text}</li>`)
          .join('') || '<li>Look and listen. Your discoveries stay here.</li>'
      }</ul></section>
      <ul class="findings notebook-page" tabindex="0" aria-label="Care notes" ${notebookTab !== 'notes' ? 'hidden' : ''}>${
        [...observations.values()]
          .reverse()
          .map(
            (o) =>
              `<li>${icon(o.keyClue ? 'check' : 'search')}<span><strong>${o.label}${o.keyClue ? ' · Key clue' : ''}</strong>${o.text}</span></li>`,
          )
          .join('') ||
        '<li class="no-clues">Your observations will appear here.</li>'
      }</ul>`;
  const actions = byId('visit-actions');
  actions.hidden =
    !patient || mode === 'reception' || mode === 'result' || Boolean(modal);
  if (actions.hidden) {
    actions.innerHTML = '';
    return;
  }
  actions.innerHTML = `${button('← Stop visit', 'back', 'secondary stop-visit')}
    <span class="visit-action-hint">${mode === 'examine' ? `${findings.size}/${patient!.checks.length} key clues found` : timing ? 'Take your time. Follow your tool’s activity.' : mode === 'diagnose' ? 'Choose the answer that fits your clues.' : 'Tap a spot on your patient.'}</span>
    ${mode === 'examine' ? button(patient!.purpose === 'checkup' ? 'Finish healthy checkup' : `Choose a diagnosis ${icon('arrow')}`, patient!.purpose === 'checkup' ? 'finish-checkup' : 'diagnose', 'primary', findings.size < patient!.checks.length) : ''}`;
}
function render() {
  queue = simulation.queue;
  app.dataset.mode = mode;
  renderStats();
  if (mode === 'reception') renderReception();
  else if (mode === 'town') renderTown();
  else if (mode !== 'result') renderCase();
  renderModal();
  renderVisitActions();
  document
    .querySelectorAll('.nav-button')
    .forEach((el) =>
      el.classList.toggle(
        'active',
        el.getAttribute('data-action') ===
          (modal === 'shop'
            ? 'shop'
            : modal === 'casebook'
              ? 'casebook'
              : mode === 'town'
                ? 'town'
                : 'reception'),
      ),
    );
}
function returnToReception(requeue = false) {
  patientPage = 0;
  officeTab = 'patients';
  clearAnnouncement();
  const returnedName = requeue ? patient?.name : null;
  if (requeue && patient) simulation.abortVisit(patientId);
  queue = simulation.queue;
  if (pendingPatient !== null) simulation.cancelCall(pendingPatient);
  pendingPatient = null;
  mode = 'reception';
  careActivity?.dispose();
  careActivity = null;
  patient = null;
  timing = false;
  receipt = null;
  modal = null;
  world.showReception();
  clinicView = 'reception';
  world.focusClinic(clinicView);
  world.setQueue(queue);
  world.setUpgrades(progress.upgrades);
  save();
  render();
  window.scrollTo(0, 0);
  if (returnedName)
    announce(
      `${returnedName} is back in the waiting room. You can try this visit again any time.`,
    );
}
function startVisit(id: number) {
  if (!ready || enteringTown || mode !== 'reception' || !queue.includes(id))
    return;
  if (pendingPatient !== null && pendingPatient !== id)
    simulation.cancelCall(pendingPatient);
  if (!simulation.startVisit(id)) {
    if (pendingPatient !== id)
      announce(`${visitFor(id).name} and their owner are coming to the desk.`);
    if (pendingPatient !== id) {
      clinicView = 'escort';
      world.focusClinic(clinicView);
      renderClinicTitle();
    }
    pendingPatient = id;
    renderLeisure();
    return;
  }
  clearAnnouncement();
  pendingPatient = null;
  patientId = id;
  patient = visitFor(id);
  queue = simulation.queue;
  save();
  findings = new Set();
  notebookTab = 'clues';
  cluePulseUntil = 0;
  clearTimeout(cluePulseTimer);
  observations = new Map();
  mistakes = 0;
  selectedTool = null;
  timing = false;
  mode = patient.treatment === 'vaccine' ? 'place-vaccine' : 'examine';
  if (mode === 'place-vaccine') selectedTool = 'vaccine';
  world.showTreatment(patient);
  audio.play('hello');
  render();
}
function useZone(zone: Zone | null, findingVisible = true) {
  if (
    !patient ||
    timing ||
    modal ||
    !['examine', 'treat', 'place-vaccine'].includes(mode)
  )
    return;
  if (!selectedTool) {
    announce('Choose a tool first, then a spot on your patient.');
    return;
  }
  if (!zone) {
    announce('Try a little closer to a body marker.');
    return;
  }
  if (mode === 'examine') {
    const result = examine(patient, selectedTool, zone, findingVisible);
    if (result.kind === 'guidance') {
      announce(result.text);
      return;
    }
    const newKeyClue = result.clueIndex >= 0 && !findings.has(result.clueIndex);
    if (result.clueIndex >= 0) findings.add(result.clueIndex);
    if (newKeyClue) {
      cluePulseUntil = performance.now() + 2400;
      clearTimeout(cluePulseTimer);
      cluePulseTimer = setTimeout(() => {
        cluePulseUntil = 0;
        document
          .querySelector('[data-tab=clues]')
          ?.classList.remove('clue-discovered');
      }, 2400);
    }
    observations.delete(`${selectedTool}:${zone}`);
    notebookTab = 'notes';
    observations.set(`${selectedTool}:${zone}`, {
      text: result.text,
      label: `${toolInfo[selectedTool].name} · ${zoneLabel(zone, patient?.species)}`,
      keyClue: result.clueIndex >= 0,
    });
    audio.play('tap');
    announce(newKeyClue ? `Key clue found! ${result.text}` : result.text);
    render();
  } else {
    if (selectedTool !== patient.treatment || zone !== patient.zone) {
      mistakes++;
      announce(
        patient.treatment === 'vaccine'
          ? 'Not there — look for the soft fur on the upper body. Nothing has been given yet. Try another spot.'
          : `Check your care plan: ${toolInfo[patient.treatment].name} at the ${zoneLabel(patient.zone, patient.species).toLowerCase()}. You can try again.`,
      );
      return;
    }
    mode = 'treat';
    timing = true;
    render();
  }
}
function applyCare() {
  if (!timing || !patient || mode !== 'treat' || !careActivity?.skill.complete)
    return;
  if (!simulation.completeVisit(patientId)) return;
  const qualityLoss = careActivity.skill.qualityLoss;
  careActivity.dispose();
  careActivity = null;
  timing = false;
  receipt = reward(progress, Math.max(50, 100 - mistakes * 4 - qualityLoss));
  save();
  mode = 'result';
  audio.play('success');
  renderModal();
  app.dataset.mode = mode;
  renderVisitActions();
  renderStats();
  byId('zones').innerHTML = '';
  byId('precision').innerHTML = '';
  byId('modal-root').querySelector<HTMLButtonElement>('button')?.focus();
}
app.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLButtonElement>(
    '[data-action]',
  );
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'town') {
    if (!ready || enteringTown) return;
    if (mode !== 'reception' && mode !== 'town') {
      announce('Use Stop visit before exploring Hookville.');
      return;
    }
    if (mode === 'town') return;
    enteringTown = true;
    announce('Opening the gates to Hookville…');
    void world
      .showTown()
      .then(() => {
        mode = 'town';
        modal = null;
        clearAnnouncement();
        render();
        window.scrollTo(0, 0);
      })
      .catch(() => announce('Hookville could not load. Please try again.'))
      .finally(() => {
        enteringTown = false;
      });
    return;
  }
  if (action === 'cancel-call' && pendingPatient !== null) {
    simulation.cancelCall(pendingPatient);
    pendingPatient = null;
    renderLeisure();
    return;
  }
  if (action === 'clinic-view' && mode === 'reception') {
    clinicView = target.dataset.view ?? 'reception';
    world.focusClinic(clinicView);
    renderClinicTitle();
    renderLeisure();
    return;
  }
  if (action?.startsWith('clinic-') && mode === 'reception') {
    if (action === 'clinic-in') world.zoomClinic(0.8);
    else if (action === 'clinic-out') world.zoomClinic(1.25);
    else
      world.panClinicCamera(
        action === 'clinic-left' ? -1 : action === 'clinic-right' ? 1 : 0,
        action === 'clinic-up' ? -1 : action === 'clinic-down' ? 1 : 0,
      );
    return;
  }
  if (action === 'follow-family' && mode === 'town') {
    const h = simulation.households[Number(target.dataset.id)];
    if (h.inClinic && h.routine !== 'clinic-exit') {
      returnToReception();
      return;
    }
    world.focusFamily(h.id);
    showHome(h.id);
    return;
  }
  if (action === 'home' && mode === 'town') {
    world.focusHome(Number(target.dataset.id));
    return;
  }
  if (mode === 'town' && action === 'town-tab') {
    townTab = target.dataset.tab as typeof townTab;
    renderTownPanels();
    return;
  }
  if (mode === 'town' && (action === 'home-page' || action === 'news-page')) {
    if (action === 'home-page') homePage += Number(target.dataset.step);
    else newsPage += Number(target.dataset.step);
    renderTown();
    byId('sidebar')
      .querySelector<HTMLButtonElement>(
        `[data-action="${action}"][data-step="${target.dataset.step}"]`,
      )
      ?.focus({ preventScroll: true });
    return;
  }
  if (
    action === 'town-fire' ||
    action === 'town-police' ||
    action === 'town-rescue'
  ) {
    const p =
      action === 'town-fire'
        ? stations.fire
        : action === 'town-police'
          ? stations.police
          : simulation.emergencies.focus(simulation.households);
    if (p) world.focusEmergency(p, action === 'town-rescue');
    else
      announce(
        'Police and firefighters are ready. No rescue is needed right now.',
      );
    return;
  }
  if (action?.startsWith('town-') && mode === 'town') {
    if (action === 'town-park') world.focusPark();
    else if (action === 'town-reset') world.resetTownCamera();
    else if (action === 'town-in') world.zoomTown(0.8);
    else if (action === 'town-out') world.zoomTown(1.25);
    else
      world.panTownCamera(
        action === 'town-left' ? -4 : action === 'town-right' ? 4 : 0,
        action === 'town-up' ? -4 : action === 'town-down' ? 4 : 0,
      );
    return;
  }
  if (
    action === 'finish-checkup' &&
    mode === 'examine' &&
    patient?.purpose === 'checkup' &&
    findings.size === patient.checks.length
  ) {
    if (!simulation.completeVisit(patientId)) return;
    receipt = reward(progress, 100);
    save();
    mode = 'result';
    audio.play('success');
    render();
    return;
  }
  if (mode === 'reception' && action === 'office-tab') {
    world.clearClinicPick();
    officeTab = target.dataset.tab === 'activities' ? 'activities' : 'patients';
    renderReception();
    byId('sidebar')
      .querySelector<HTMLButtonElement>(`[data-tab="${officeTab}"]`)
      ?.focus({ preventScroll: true });
    return;
  }
  if (
    mode === 'reception' &&
    (action === 'patient-page' || action === 'activity-page')
  ) {
    world.clearClinicPick();
    if (action === 'patient-page') patientPage += Number(target.dataset.step);
    else activityPage += Number(target.dataset.step);
    renderReception();
    byId('sidebar')
      .querySelector<HTMLButtonElement>(
        `[data-action="${action}"][data-step="${target.dataset.step}"]`,
      )
      ?.focus({ preventScroll: true });
    return;
  }
  if (action === 'notebook') {
    notebookTab = target.dataset.tab === 'notes' ? 'notes' : 'clues';
    renderVisitActions();
    byId('clue-summary')
      .querySelector<HTMLButtonElement>(`[data-tab="${notebookTab}"]`)
      ?.focus({ preventScroll: true });
  } else if (action === 'next') startVisit(queue[0]);
  else if (action === 'patient') startVisit(Number(target.dataset.id));
  else if (action === 'invite') {
    simulation.inviteNext();
    announce(
      'A neighbour is getting ready to visit. You can watch their journey in Hookville.',
    );
    save();
    world.setQueue(queue);
    render();
  } else if (action === 'tool') {
    selectedTool = target.dataset.tool as Tool;
    audio.play('tap');
    render();
    if (window.innerWidth <= 700)
      byId('world').scrollIntoView({ block: 'center', behavior: 'instant' });
  } else if (action === 'zone')
    world.placeInstrument(target.dataset.zone as Zone);
  else if (action === 'orbit-mode') {
    world.toggleOrbit();
    render();
  } else if (action === 'instrument-zoom-in') world.changeInstrumentZoom(0.5);
  else if (action === 'instrument-zoom-out') world.changeInstrumentZoom(-0.5);
  else if (action === 'full-xray') world.toggleFullXray();
  else if (
    action === 'diagnose' &&
    mode === 'examine' &&
    patient &&
    findings.size === patient.checks.length
  ) {
    notebookTab = 'clues';
    mode = 'diagnose';
    selectedTool = null;
    render();
    byId('sidebar')
      .querySelector<HTMLButtonElement>('[data-action="diagnosis"]')
      ?.focus();
  } else if (action === 'diagnosis' && mode === 'diagnose' && patient) {
    if (target.dataset.diagnosis === patient.diagnosis) {
      mode = 'treat';
      audio.play('success');
      announce(
        'That fits both clues. Let’s help our little friend feel better.',
      );
      render();
    } else {
      mistakes++;
      announce(
        'That doesn’t quite fit both clues. Take another look at your care notes.',
      );
    }
  } else if (action === 'apply') applyCare();
  else if (action === 'cancel-timing') cancelCareActivity();
  else if (action === 'finish') returnToReception();
  else if (action === 'back' && patient && mode !== 'result')
    returnToReception(true);
  else if (action === 'reception') {
    if (mode === 'town') {
      returnToReception();
    } else if (mode === 'reception') {
      modal = null;
      render();
    } else
      announce(
        'Finish this visit, or use “Stop visit” to return your patient to the queue.',
      );
  } else if (action === 'shop' || action === 'guide' || action === 'casebook') {
    if (mode === 'result') return;
    modal = action;
    renderModal();
    renderVisitActions();
    byId('modal-root').querySelector<HTMLButtonElement>('button')?.focus();
  } else if (action === 'close-modal') {
    modal = null;
    render();
  } else if (action === 'buy') {
    if (purchase(progress, target.dataset.upgrade ?? '')) {
      save();
      simulation.configureLeisure(progress.upgrades);
      world.setUpgrades(progress.upgrades);
      audio.play('success');
      announce('A lovely addition to your clinic!');
      renderStats();
      renderModal();
      if (mode === 'reception') renderReception();
    }
  } else if (action === 'sound') {
    progress.sound = audio.toggle();
    save();
    renderStats();
  } else if (action === 'rotate-left') world.rotate(-Math.PI / 5);
  else if (action === 'rotate-right') world.rotate(Math.PI / 5);
  else if (action === 'reset-camera') world.resetCamera();
  else if (action === 'retry') location.reload();
});
document.querySelector('.brand')!.addEventListener('click', (e) => {
  e.preventDefault();
  if (mode === 'reception') {
    modal = null;
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mode === 'reception' && !modal)
    world.clearClinicPick();
  if (
    (mode === 'town' || mode === 'reception') &&
    ready &&
    !modal &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !(
      e.target instanceof Element &&
      e.target.closest(
        'input,textarea,select,[contenteditable="true"],[role="dialog"]',
      )
    )
  ) {
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-4, 0],
      ArrowRight: [4, 0],
      ArrowUp: [0, -4],
      ArrowDown: [0, 4],
    };
    const delta = direction[e.key];
    if (delta) {
      e.preventDefault();
      if (mode === 'town') world.panTownCamera(...delta);
      else world.panClinicCamera(delta[0] / 4, delta[1] / 4);
      return;
    }
  }
  if (e.key === 'Escape' && modal) {
    modal = null;
    render();
  }
  const dialog = byId('modal-root').querySelector('[role="dialog"]');
  if (e.key === 'Tab' && dialog) {
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]'),
    ];
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
renderStats();
renderReception();
try {
  world = new World(
    byId('world'),
    useZone,
    (bpm, now) => audio.heartbeat(now, bpm),
    simulation,
  );
  void world
    .load()
    .then(() => {
      ready = true;
      byId('loading').remove();
      world.setQueue(queue);
      simulation.configureLeisure(progress.upgrades);
      world.setUpgrades(progress.upgrades);
      render();
    })
    .catch(showLoadError);
  world.onTownPick = (pick) => {
    pointedResident = typeof pick === 'object' ? pick.label : undefined;
    showHome(typeof pick === 'number' ? pick : undefined);
  };
  world.onClinicMove = () => {
    if (mode !== 'reception' || clinicView === 'free') return;
    clinicView = 'free';
    renderClinicTitle();
  };
  let last = performance.now();
  function frame(now: number) {
    const elapsed = document.hidden ? 0 : (now - last) / 1000;
    const dt = Math.min(elapsed, 0.5);
    last = now;
    if (!document.hidden) {
      // Care activities and dialogs use a still 3D backdrop so their controls
      // stay responsive even on devices with slower graphics.
      if (!timing && !modal && mode !== 'result') world.draw(now, dt);
      audio.siren(
        now,
        mode === 'town' &&
          !modal &&
          simulation.emergencies.active?.phase === 'dispatch',
      );
      if (timing && !modal) careActivity?.update(dt);
      document.querySelectorAll<HTMLElement>('.body-spot').forEach((el) => {
        const zone = el.dataset.zone as Zone;
        const p = world.projectZone(zone);
        const anchors: Record<Zone, [number, number]> = {
          mouth: [0.18, 0.4],
          chest: [0.18, 0.57],
          paw: [0.18, 0.74],
          ear: [0.82, 0.4],
          coat: [0.82, 0.61],
          tank: [0.18, 0.6],
          fin: [0.82, 0.5],
        };
        const [ax, ay] = anchors[zone];
        const x = ax * byId('world').clientWidth,
          y = ay * byId('world').clientHeight;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.visibility = p.visible ? 'visible' : 'hidden';
        const line = byId('zones').querySelector<SVGLineElement>(
          `[data-leader="${zone}"]`,
        );
        if (line) {
          line.setAttribute('x1', String(x));
          line.setAttribute('y1', String(y));
          line.setAttribute('x2', String(p.x));
          line.setAttribute('y2', String(p.y));
          line.style.visibility = p.visible ? 'visible' : 'hidden';
        }
        const dot = byId('zones').querySelector<SVGCircleElement>(
          `[data-point="${zone}"]`,
        );
        if (dot) {
          dot.setAttribute('cx', String(p.x));
          dot.setAttribute('cy', String(p.y));
          dot.style.visibility = p.visible ? 'visible' : 'hidden';
        }
      });
      if (mode === 'town' && now - townStatusAt > 1500) {
        showHome(undefined);
        renderTownNews();
        renderTownWeather();
        townStatusAt = now;
      }
      if (ready && !modal && !timing && mode !== 'result') {
        simulation.configureClinic(
          clinicCapacity(progress.upgrades),
          progress.upgrades.includes('poster') ? 13 : 22,
        );
        simulation.configureLeisure(progress.upgrades);
        advanceActiveTime(elapsed, (step) => {
          simulation.update(step);
          world.recordOwnerPaths();
        });
        if (pendingPatient !== null && mode === 'reception')
          startVisit(pendingPatient);
        if (mode === 'reception' && now - townStatusAt > 1000) {
          renderLeisure();
          townStatusAt = now;
        }
        if (townRevision !== simulation.revision) {
          townRevision = simulation.revision;
          queue = simulation.queue;
          world.setQueue(queue);
          if (mode === 'reception') renderReception();
          save();
        }
        if (now - lastTownSave > 5000) {
          save();
          lastTownSave = now;
        }
      }
    }
    if (toastUntil && now > toastUntil) {
      byId('toast').classList.remove('show');
      toastUntil = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) {
  showLoadError(error);
}
function showLoadError(error: unknown) {
  console.error('The clinic could not load:', error);
  byId('loading').innerHTML =
    `${icon('paw')}<h2>The clinic needs a moment</h2><p>Check your connection and make sure your browser supports WebGL 2.</p>${button('Try again', 'retry')}`;
}

window.addEventListener('pagehide', () => {
  audio.heartbeat(0, null);
  save();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.heartbeat(0, null);
    save();
  }
});

window.addEventListener('blur', () => careActivity?.pause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) careActivity?.pause();
});
