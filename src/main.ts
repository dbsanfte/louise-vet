import './style.css';
import { World } from './world';
import { Audio } from './audio';
import { icon, petIcon } from './icons';
import {
  visits,
  toolInfo,
  zoneNames,
  upgrades,
  loadProgress,
  saveProgress,
  purchase,
  reward,
  examine,
  type Visit,
  type Tool,
  type Zone,
} from './game';

type Mode =
  'reception' | 'examine' | 'diagnose' | 'place-vaccine' | 'treat' | 'result';
const app = document.querySelector<HTMLDivElement>('#app')!;
const progress = loadProgress();
const audio = new Audio();
audio.enabled = progress.sound;
let mode: Mode = 'reception';
let modal: 'shop' | 'guide' | 'casebook' | null = null;
let queue = [0, 1, 2];
let nextArrival = 3;
let arrivalTime = 0;
let patient: Visit | null = null;
let patientId = 0;
let findings = new Set<number>();
let observations = new Map<
  string,
  { text: string; label: string; keyClue: boolean }
>();
let selectedTool: Tool | null = null;
let mistakes = 0;
let timing = false;
let meter = 0.5;
let meterStart = 0;
let receipt: ReturnType<typeof reward> | null = null;
let ready = false;
let world: World;
let toastUntil = 0;

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
  <div id="visit-actions" class="visit-actions" role="region" aria-label="Visit actions" hidden></div>
  <footer class="bottom-bar"><nav aria-label="Clinic navigation"><button class="nav-button active" data-action="reception">${icon('home')}<span>My clinic</span></button><button class="nav-button" data-action="shop">${icon('bag')}<span>Clinic shop</span><span class="tiny-label">UPGRADES</span></button><button class="nav-button" data-action="casebook">${icon('book')}<span>Care notebook</span></button></nav><span id="save-note" class="save-note">${icon('check')} Progress saved on this browser</span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>`;

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
  const okay = saveProgress(progress);
  byId('save-note').innerHTML = okay
    ? `${icon('check')} Progress saved on this browser`
    : `${icon('help')} Saving unavailable · keep this tab open`;
}
const visitFor = (id: number) => visits[id % visits.length];
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
  byId('sidebar').innerHTML = `
    <div class="panel-heading louise-welcome"><img class="louise-portrait" src="/images/louise-portrait.png" alt="Louise in her mint vet coat and pink headband" width="76" height="76" /><div><p class="eyebrow">MADE JUST FOR YOU</p><h2>Welcome,<br />Louise.</h2></div></div>
    <p class="panel-intro">Your neighbours and their little companions are in good hands.</p>
    <div class="queue-heading"><h3>In the waiting room</h3><span class="count">${queue.length}</span></div>
    <div class="patient-list">${
      queue
        .map((id, i) => {
          const p = visitFor(id);
          return `<button class="patient-card ${i === 0 ? 'next' : ''}" data-action="patient" data-id="${id}" ${!ready ? 'disabled' : ''} aria-label="See ${p.name}"><span class="pet-avatar ${p.color}">${petIcon(p.species)}</span><span class="patient-card-text"><strong>${p.name}<small>${p.breed}</small></strong><span>${p.symptom}</span></span><span class="queue-order">${i === 0 ? 'NEXT' : String(i + 1).padStart(2, '0')}</span></button>`;
        })
        .join('') ||
      '<div class="empty-queue">A quiet little moment.<br />A new visitor will be here soon.</div>'
    }</div>
    ${queue.length ? button(`See ${visitFor(queue[0]).name} ${icon('arrow')}`, 'next', 'primary call-next', !ready) : button('Welcome a visitor', 'invite', 'primary call-next', !ready)}
    <div class="kindness-note"><span>${icon('heart')}</span><p><strong>Small paws. Big feelings.</strong>There’s no rush. Take your time and help every patient feel safe.</p></div>
    <div class="shelf-summary"><span>${icon('jar')} Treats on the shelf</span><strong>${progress.stock}</strong></div>`;
  byId('scene-title').innerHTML =
    '<span class="room-pill"><i></i> RECEPTION</span><h2>Your happy little clinic</h2>';
  byId('scene-goal').innerHTML =
    `<span class="goal-icon">${icon('star')}</span><div><small>TODAY’S LITTLE GOAL</small><strong>Help 3 animal friends</strong><div class="goal-dots">${[0, 1, 2].map((i) => `<span class="${progress.treated % 3 > i ? 'done' : ''}">${progress.treated % 3 > i ? icon('check') : ''}</span>`).join('')}</div></div>`;
  byId('scene-caption').innerHTML =
    `<span class="open-badge">${icon('sun')} Open for little adventures</span>`;
  byId('scene-controls').innerHTML = '';
  byId('zones').innerHTML = '';
  byId('precision').innerHTML = '';
  byId('stage-footer').innerHTML =
    `<span class="footer-tip">${icon('paw')} Choose a patient to begin their visit.</span><span class="clinic-total">${progress.treated} friends helped <span>·</span> ${progress.earned} coins earned</span>`;
}
function renderCase() {
  if (!patient) return;
  const vaccination = patient.treatment === 'vaccine';
  const steps = vaccination
    ? ['Find a spot', 'Gentle vaccine']
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
      ? ['water-test', 'inspect']
      : ['listen', 'inspect', 'ear', 'xray', 'mouth'];
  const treatments = [
    ...new Set<Tool>([patient.treatment, 'cream', 'bandage', 'comb']),
  ];
  byId('sidebar').innerHTML = `
    <div class="case-heading"><span class="pet-avatar large ${patient.color}">${petIcon(patient.species)}</span><div><p class="eyebrow">YOUR LITTLE PATIENT</p><h2>${patient.name}</h2><p>${patient.breed} · ${patient.age}</p></div></div>
    <div class="owner-note"><p>“${patient.quote}”</p><span>— ${patient.owner}, ${patient.name}’s person</span></div>
    <ol class="case-steps">${steps.map((label, i) => `<li class="${i === step ? 'current' : i < step ? 'complete' : ''}"><span>${i < step ? icon('check') : i + 1}</span>${label}</li>`).join('')}</ol>
    ${vaccination ? `<div class="care-plan"><span>${icon('heart')} VACCINATION VISIT</span><h3>${timing ? 'A gentle touch' : 'Find a comfy spot'}</h3><p>${timing ? 'You found the spot! Now keep your hand steady.' : `The vaccine is ready. Find the soft patch of fur on ${patient.name}’s upper body. Turn her around and tap the matching body marker.`}</p></div><p class="instruction">${timing ? 'Tap Give vaccine in the green patch. A wobbly try pauses the vaccine so you can try again.' : 'No mystery to solve today — just a little practice with careful hands.'}</p>` : ''}
    ${mode === 'examine' ? `<div class="section-title"><h3>Look & listen</h3><span>${findings.size}/${patient.checks.length} key clues</span></div><p class="instruction">Pick a tool, then tap a spot on ${patient.name}. Healthy checks help too. Find two key clues about the problem in their person’s story.</p><div class="tool-grid">${diagnosticTools.map(toolButton).join('')}</div>` : ''}
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
    ${mode === 'treat' && !vaccination ? `<div class="care-plan"><span>${icon('check')} CARE PLAN</span><h3>${patient.diagnosis}</h3><p>${toolInfo[patient.treatment].name} → <strong>${zoneNames[patient.zone]}</strong></p></div><p class="instruction">Choose the right care tool and place it at the spot in your plan.</p><div class="tool-grid">${treatments.map(toolButton).join('')}</div>` : ''}
    ${!vaccination ? `<div class="section-title"><h3>Care notes</h3>${icon('book')}</div><ul class="findings" tabindex="0" aria-label="Care notes">${[...observations.values()].map((o) => `<li>${icon(o.keyClue ? 'check' : 'search')}<span><strong>${o.label}${o.keyClue ? ' · Key clue' : ''}</strong>${o.text}</span></li>`).join('') || '<li class="no-clues">Your observations will appear here.<br />Start with the story from their person.</li>'}</ul>` : ''}`;
  byId('scene-title').innerHTML =
    `<span class="room-pill treatment-pill">${icon('plus')} TREATMENT ROOM</span><h2>A little help for ${patient.name}</h2>`;
  byId('scene-goal').innerHTML =
    `<div class="comfort-badge">${icon('heart')} <span>Safe, cosy & cared for</span></div>`;
  byId('scene-caption').innerHTML =
    `<span class="orbit-hint">${icon('rotate')} Drag to look around · scroll to zoom</span>`;
  byId('scene-controls').innerHTML =
    `<button class="icon-button" data-action="rotate-left" aria-label="Rotate animal left">↶</button><button class="icon-button" data-action="rotate-right" aria-label="Rotate animal right">↷</button><button class="icon-button" data-action="reset-camera" aria-label="Reset camera">${icon('rotate')}</button>`;
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
              `<button class="body-spot" data-action="zone" data-zone="${zone}" aria-label="${zoneNames[zone]} on ${patient!.name}"><span class="spot-dot">${icon('plus')}</span><span class="spot-label">${zoneNames[zone]}</span></button>`,
          )
          .join('')
      : '';
  byId('stage-footer').innerHTML =
    `<span class="footer-tip">${icon(selectedTool ? toolInfo[selectedTool].icon : 'heart')} ${selectedTool ? `${toolInfo[selectedTool].name} selected · ${toolInfo[selectedTool].hint}` : mode === 'diagnose' ? 'Use both clues to choose your diagnosis.' : 'Choose a tool to begin. Every good vet starts by listening.'}</span><span class="clinic-total">${queue.length} waiting patiently</span>`;
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
function renderPrecision() {
  byId('precision').innerHTML = timing
    ? `<div class="precision-card"><div class="precision-heading"><span class="mini-badge">${icon(toolInfo[patient!.treatment].icon)}</span><div><p class="eyebrow">A GENTLE TOUCH</p><h3>Steady paws, Louise!</h3></div><button class="icon-button" data-action="cancel-timing" aria-label="Cancel treatment timing">${icon('close')}</button></div><p>Tap <strong>${patient!.treatment === 'vaccine' ? 'Give vaccine' : 'Apply care'}</strong> when the dot reaches the green patch.</p><div class="timing-track ${progress.upgrades.includes('equipment') ? 'upgraded' : ''}" role="meter" aria-label="Treatment timing" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><div class="green-zone"></div><span id="timing-dot"></span></div>${button(`${patient!.treatment === 'vaccine' ? 'Give vaccine' : 'Apply care'} ${icon('heart')}`, 'apply', 'primary full-width')}</div>`
    : '';
}

function renderModal() {
  const root = byId('modal-root');
  if (mode === 'result' && receipt && patient) {
    const stars =
      receipt.satisfaction >= 90 ? 3 : receipt.satisfaction >= 75 ? 2 : 1;
    root.innerHTML = `<div class="modal-scrim"><section class="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="result-stars">${[0, 1, 2].map((i) => icon('star', i < stars ? 'filled' : '')).join('')}</div><span class="pet-avatar result-pet ${patient.color}">${petIcon(patient.species)}</span><p class="eyebrow">ANOTHER HAPPY LITTLE HEART</p><h2 id="result-title">${patient.name} ${patient.treatment === 'vaccine' ? 'is all set' : 'feels better'}!</h2><p>${patient.aftercare}</p><div class="result-happiness">${icon('heart')} ${receipt.satisfaction}% patient & customer happiness</div><dl class="receipt"><div><dt>Wonderful care</dt><dd>+${receipt.fee}</dd></div><div><dt>A thank-you from ${patient.owner}</dt><dd>+${receipt.tip}</dd></div>${receipt.retail ? `<div><dt>A treat for the trip home</dt><dd>+${receipt.retail}</dd></div>` : ''}<div class="receipt-total"><dt>Coins earned</dt><dd>${icon('coin')} +${receipt.total}</dd></div></dl>${button(`Back to reception ${icon('arrow')}`, 'finish', 'primary full-width')}<small>${progress.treated} animal friend${progress.treated === 1 ? '' : 's'} helped. You’re making a difference.</small></section></div>`;
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
        return `<article class="shop-card"><span class="shop-art ${u.id}">${icon(u.icon)}</span><small>${u.kind}</small><h3>${u.name}</h3><p>${u.description}</p><button class="${owned ? 'owned' : 'secondary'}" data-action="buy" data-upgrade="${u.id}" ${owned || progress.coins < u.price ? 'disabled' : ''}>${owned ? `${icon('check')} In your clinic` : `${icon('coin')} ${u.price} ${progress.coins < u.price ? '· Save a little more' : ''}`}</button></article>`;
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
        'search',
        'Be a little detective',
        'For a poorly pet, choose tools and tap body markers to collect two key clues. Drag to rotate; scroll or pinch to zoom.',
      ],
      [
        'book',
        'Join the clues together',
        'Pick the diagnosis that matches your findings. It is always okay to try again.',
      ],
      [
        'heart',
        'Give a gentle helping hand',
        'Choose the care tool, tap the right body spot, then stop the moving dot in the green zone. Vaccination visits go straight to finding the spot and giving a gentle vaccine.',
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
    content = `<p class="modal-intro">A good vet stays curious. These friendly reminders can help you put the clues together.</p><div class="notebook-grid">${visits.map((p) => `<article><span class="pet-avatar ${p.color}">${petIcon(p.species)}</span><div><h3>${p.diagnosis}</h3><p>${p.treatment === 'vaccine' ? 'Find the soft fur patch, then give the vaccine with a steady hand in the green timing zone.' : p.checks[0].finding}</p><small>${toolInfo[p.treatment].name} · ${zoneNames[p.zone]}</small></div></article>`).join('')}</div>`;
  }
  root.innerHTML = `<div class="modal-scrim"><section class="modal ${modal}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p class="eyebrow">LOUISE’S VET OFFICE</p><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close ${modal}">${icon('close')}</button></header>${content}</section></div>`;
}
function renderVisitActions() {
  const actions = byId('visit-actions');
  actions.hidden =
    !patient || mode === 'reception' || mode === 'result' || Boolean(modal);
  if (actions.hidden) {
    actions.innerHTML = '';
    return;
  }
  actions.innerHTML = `${button('← Stop visit', 'back', 'secondary stop-visit')}
    <span class="visit-action-hint">${mode === 'examine' ? `${findings.size}/${patient!.checks.length} key clues found` : timing ? 'Take your time. Aim for green!' : mode === 'diagnose' ? 'Choose the answer that fits your clues.' : 'Tap a spot on your patient.'}</span>
    ${mode === 'examine' ? button(`Choose a diagnosis ${icon('arrow')}`, 'diagnose', 'primary', findings.size < patient!.checks.length) : ''}`;
}
function render() {
  app.dataset.mode = mode;
  renderStats();
  if (mode === 'reception') renderReception();
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
              : 'reception'),
      ),
    );
}
function returnToReception(requeue = false) {
  clearAnnouncement();
  const returnedName = requeue ? patient?.name : null;
  if (requeue && patient) queue.unshift(patientId);
  mode = 'reception';
  patient = null;
  timing = false;
  receipt = null;
  modal = null;
  world.showReception();
  world.setQueue(queue);
  world.setUpgrades(progress.upgrades);
  render();
  window.scrollTo(0, 0);
  if (returnedName)
    announce(
      `${returnedName} is back in the waiting room. You can try this visit again any time.`,
    );
}
function startVisit(id: number) {
  if (!ready || mode !== 'reception' || !queue.includes(id)) return;
  clearAnnouncement();
  patientId = id;
  patient = visitFor(id);
  queue = queue.filter((n) => n !== id);
  findings = new Set();
  observations = new Map();
  mistakes = 0;
  selectedTool = null;
  timing = false;
  mode = patient.treatment === 'vaccine' ? 'place-vaccine' : 'examine';
  if (mode === 'place-vaccine') selectedTool = 'vaccine';
  world.showTreatment(patient.species);
  audio.play('hello');
  render();
}
function useZone(zone: Zone | null) {
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
    const result = examine(patient, selectedTool, zone);
    if (result.kind === 'guidance') {
      announce(result.text);
      return;
    }
    if (result.clueIndex >= 0) findings.add(result.clueIndex);
    observations.set(`${selectedTool}:${zone}`, {
      text: result.text,
      label: `${toolInfo[selectedTool].name} · ${zoneNames[zone]}`,
      keyClue: result.clueIndex >= 0,
    });
    audio.play('tap');
    announce(result.text);
    render();
  } else {
    if (selectedTool !== patient.treatment || zone !== patient.zone) {
      mistakes++;
      announce(
        patient.treatment === 'vaccine'
          ? 'Not there — look for the soft fur on the upper body. Nothing has been given yet. Try another spot.'
          : `Check your care plan: ${toolInfo[patient.treatment].name} at the ${zoneNames[patient.zone].toLowerCase()}. You can try again.`,
      );
      return;
    }
    mode = 'treat';
    timing = true;
    meterStart = performance.now();
    render();
  }
}
function applyCare() {
  if (!timing || !patient || mode !== 'treat') return;
  const tolerance = progress.upgrades.includes('equipment') ? 0.24 : 0.16;
  if (Math.abs(meter - 0.5) > tolerance) {
    mistakes++;
    announce(
      patient.treatment === 'vaccine'
        ? 'Pause those paws! No vaccine given yet. Try again in the green patch for a gentle touch.'
        : 'A little wobbly! Let the dot come back to the green patch and try again.',
    );
    return;
  }
  timing = false;
  receipt = reward(
    progress,
    Math.max(50, 100 - mistakes * 4 - Math.round(Math.abs(meter - 0.5) * 40)),
  );
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
  if (action === 'next') startVisit(queue[0]);
  else if (action === 'patient') startVisit(Number(target.dataset.id));
  else if (action === 'invite') {
    queue.push(nextArrival++);
    world.setQueue(queue);
    render();
  } else if (action === 'tool') {
    selectedTool = target.dataset.tool as Tool;
    audio.play('tap');
    render();
  } else if (action === 'zone') useZone(target.dataset.zone as Zone);
  else if (
    action === 'diagnose' &&
    mode === 'examine' &&
    patient &&
    findings.size === patient.checks.length
  ) {
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
  else if (action === 'cancel-timing') {
    timing = false;
    if (patient?.treatment === 'vaccine') mode = 'place-vaccine';
    render();
  } else if (action === 'finish') returnToReception();
  else if (action === 'back' && patient && mode !== 'result')
    returnToReception(true);
  else if (action === 'reception') {
    if (mode === 'reception') {
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
  world = new World(byId('world'), useZone);
  void world
    .load()
    .then(() => {
      ready = true;
      byId('loading').remove();
      world.setQueue(queue);
      world.setUpgrades(progress.upgrades);
      render();
    })
    .catch(showLoadError);
  let last = performance.now();
  function frame(now: number) {
    const dt = document.hidden ? 0 : Math.min((now - last) / 1000, 0.06);
    last = now;
    if (!document.hidden) {
      // The timing challenge and dialogs use a still 3D backdrop, keeping the
      // care meter responsive even on devices with slower graphics.
      if (!timing && !modal && mode !== 'result') world.draw(now, dt);
      if (timing && !modal) {
        meter = (Math.sin((now - meterStart) * 0.0028) + 1) / 2;
        const dot = byId('precision').querySelector<HTMLElement>('#timing-dot');
        if (dot) dot.style.left = `${meter * 100}%`;
        byId('precision')
          .querySelector('[role="meter"]')
          ?.setAttribute('aria-valuenow', String(Math.round(meter * 100)));
      }
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
      if (ready && !modal && mode !== 'result') {
        arrivalTime += dt;
        if (arrivalTime > (progress.upgrades.includes('poster') ? 13 : 22)) {
          arrivalTime = 0;
          const limit =
            (progress.upgrades.includes('expansion') ? 6 : 4) -
            (patient ? 1 : 0);
          if (queue.length < limit) {
            queue.push(nextArrival++);
            if (mode === 'reception') {
              world.setQueue(queue);
              renderReception();
              audio.play('hello');
            }
          }
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
