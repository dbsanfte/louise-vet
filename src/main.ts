import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('The game mount point is missing.');

app.innerHTML = `
  <main class="welcome">
    <span class="paw" aria-hidden="true">🐾</span>
    <p class="eyebrow">VET GAME · THE BEGINNING</p>
    <h1>Hello, world!</h1>
    <p class="intro">Every little life deserves a little care.<br />Our adventure starts here.</p>
    <button type="button">Say hello</button>
    <p class="greeting" role="status" aria-live="polite">Ready when you are.</p>
  </main>
`;

const button = app.querySelector<HTMLButtonElement>('button')!;
const greeting = app.querySelector<HTMLParagraphElement>('[role="status"]')!;
button.addEventListener('click', () => {
  greeting.textContent = 'Hello, future vet! Your adventure is on its way.';
  button.textContent = 'Hello again';
});
