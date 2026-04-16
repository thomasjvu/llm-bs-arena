export function createEffects() {
  function animateCardFlight(fromEl, toEl, count = 1) {
    if (!fromEl || !toEl || !window.CardRenderer) return;

    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    if (!from.width || !to.width) return;

    const flights = Math.max(1, Math.min(4, count));
    for (let index = 0; index < flights; index++) {
      const card = document.createElement('div');
      card.className = 'fx-card-flight';
      card.style.left = `${from.left + from.width * 0.5 - 20 + index * 6}px`;
      card.style.top = `${from.top + from.height * 0.45 - 28 - index * 3}px`;
      card.innerHTML = window.CardRenderer.getCardBackSVG();
      document.body.appendChild(card);

      requestAnimationFrame(() => {
        card.style.transform = `translate(${to.left - from.left + to.width * 0.5 - 12}px, ${to.top - from.top + to.height * 0.35 - 18}px) rotate(${8 - index * 5}deg) scale(0.86)`;
        card.style.opacity = '0';
      });

      window.setTimeout(() => card.remove(), 650);
    }
  }

  function showBurst(targetEl, text, variant = 'neutral') {
    if (!targetEl || !text) return;

    const rect = targetEl.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = `fx-burst fx-burst--${variant}`;
    burst.textContent = text;
    burst.style.left = `${rect.left + rect.width / 2}px`;
    burst.style.top = `${rect.top + Math.min(rect.height * 0.25, 72)}px`;
    document.body.appendChild(burst);

    requestAnimationFrame(() => {
      burst.classList.add('is-visible');
    });

    window.setTimeout(() => {
      burst.classList.remove('is-visible');
      window.setTimeout(() => burst.remove(), 260);
    }, 1400);
  }

  return {
    animateCardFlight,
    showBurst,
  };
}
