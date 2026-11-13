/* Telegram Mini App front-end prototype. Production economy/payments must be server-authoritative. */
(() => {
  'use strict';
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  tg?.setHeaderColor?.('#071b26');
  tg?.setBackgroundColor?.('#071b26');

  const STORE_KEY = 'duck-harbor-save-v1';
  const MAX_ENERGY = 100;
  const ENERGY_REGEN_MS = 60_000;
  const upgrades = [
    { id: 'net', title: 'Ловкая сеть', description: 'Больше ракушек за каждый тап', icon: '🕸️', baseCost: 100, tap: 1, income: 0 },
    { id: 'dock', title: 'Новый причал', description: 'Ракушки капают, пока тебя нет', icon: '🛶', baseCost: 250, tap: 0, income: 8 },
    { id: 'pond', title: 'Тёплый пруд', description: 'Уткам уютно — доход растёт', icon: '🌿', baseCost: 650, tap: 2, income: 20 },
    { id: 'lighthouse', title: 'Маяк бухты', description: 'Свет привлекает новых гостей', icon: '🗼', baseCost: 1600, tap: 3, income: 55 }
  ];
  const freshState = () => ({ coins: 0, energy: MAX_ENERGY, tapPower: 1, income: 0, level: 1, taps: 0, upgrades: {}, claimedDaily: '', tapTaskClaimed: false, lastEnergyAt: Date.now(), lastSeenAt: Date.now() });
  let state = loadState();
  let toastTimer;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!saved || typeof saved !== 'object') return freshState();
      return { ...freshState(), ...saved, upgrades: saved.upgrades || {} };
    } catch { return freshState(); }
  }
  function save() {
    state.lastSeenAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }
  function fmt(value) { return Math.floor(Number(value) || 0).toLocaleString('ru-RU'); }
  function levelThreshold(level) { return level * 100; }
  function levelTotal() { return Math.max(0, state.taps * state.tapPower); }
  function currentLevelProgress() { return levelTotal() % levelThreshold(state.level); }
  function costFor(item) { return Math.floor(item.baseCost * Math.pow(1.65, state.upgrades[item.id] || 0)); }

  function applyOfflineAndEnergy() {
    const now = Date.now();
    const elapsed = Math.max(0, now - (Number(state.lastSeenAt) || now));
    state.coins += Math.floor(state.income * elapsed / 3_600_000);
    const regenElapsed = Math.max(0, now - (Number(state.lastEnergyAt) || now));
    state.energy = Math.min(MAX_ENERGY, state.energy + Math.floor(regenElapsed / ENERGY_REGEN_MS));
    state.lastEnergyAt = now;
    state.lastSeenAt = now;
  }

  function render() {
    document.querySelector('#coins').textContent = fmt(state.coins);
    document.querySelector('#energy').textContent = `${fmt(state.energy)} / ${MAX_ENERGY}`;
    document.querySelector('#income').textContent = fmt(state.income);
    document.querySelector('#level-label').textContent = `Уровень ${state.level}`;
    const progress = currentLevelProgress();
    const threshold = levelThreshold(state.level);
    document.querySelector('#level-progress-label').textContent = `${fmt(progress)} / ${fmt(threshold)}`;
    document.querySelector('#level-progress').style.width = `${Math.min(100, progress / threshold * 100)}%`;
    document.querySelector('#tap-task-reward').textContent = `${Math.min(state.taps, 10)} / 10 · +100 🪙`;
    const taskButton = document.querySelector('#tap-task-button');
    taskButton.disabled = state.taps < 10 || state.tapTaskClaimed;
    taskButton.textContent = state.tapTaskClaimed ? 'Получено' : state.taps >= 10 ? 'Забрать' : 'В процессе';
    const today = new Date().toISOString().slice(0, 10);
    const dailyButton = document.querySelector('#daily-button');
    dailyButton.disabled = state.claimedDaily === today;
    dailyButton.textContent = dailyButton.disabled ? 'Получено' : 'Забрать';
    renderUpgrades();
  }

  function renderUpgrades() {
    const list = document.querySelector('#upgrade-list');
    list.replaceChildren();
    upgrades.forEach(item => {
      const level = state.upgrades[item.id] || 0;
      const cost = costFor(item);
      const card = document.createElement('article');
      card.className = 'upgrade-card';
      const icon = document.createElement('div'); icon.className = 'upgrade-icon'; icon.textContent = item.icon;
      const info = document.createElement('div'); info.className = 'upgrade-info';
      const title = document.createElement('strong'); title.textContent = `${item.title} · ур. ${level}`;
      const desc = document.createElement('small'); desc.textContent = item.description;
      const effect = document.createElement('b'); effect.textContent = item.tap ? `+${item.tap} за тап` : `+${fmt(item.income)} в час`;
      info.append(title, desc, effect);
      const buy = document.createElement('button'); buy.className = 'upgrade-buy'; buy.textContent = `🪙 ${fmt(cost)}`; buy.disabled = state.coins < cost;
      buy.addEventListener('click', () => purchaseUpgrade(item));
      card.append(icon, info, buy); list.append(card);
    });
  }

  function showToast(message) {
    const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function purchaseUpgrade(item) {
    const cost = costFor(item);
    if (state.coins < cost) return showToast('Пока не хватает ракушек');
    state.coins -= cost; state.upgrades[item.id] = (state.upgrades[item.id] || 0) + 1;
    state.tapPower += item.tap; state.income += item.income;
    save(); render(); showToast(`${item.title} улучшен!`); tg?.HapticFeedback?.notificationOccurred?.('success');
  }

  document.querySelector('#tap-duck').addEventListener('click', event => {
    if (state.energy < 1) return showToast('Энерг��я восстановится со временем');
    state.energy -= 1; state.lastEnergyAt = Date.now(); state.taps += 1; state.coins += state.tapPower;
    while (levelTotal() >= state.level * 100) { state.level += 1; showToast(`Новый уровень: ${state.level}!`); }
    const rect = event.currentTarget.getBoundingClientRect();
    const float = document.createElement('span'); float.className = 'float-number'; float.textContent = `+${fmt(state.tapPower)} 🪙`;
    float.style.left = `${rect.left + rect.width / 2 + (Math.random() * 40 - 20)}px`; float.style.top = `${rect.top + 10}px`; document.body.append(float); setTimeout(() => float.remove(), 850);
    tg?.HapticFeedback?.impactOccurred?.('light'); save(); render();
  });

  document.querySelector('#daily-button').addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.claimedDaily === today) return;
    state.claimedDaily = today; state.coins += 250; save(); render(); showToast('Ежедневный улов: +250 ракушек!');
  });
  document.querySelector('#tap-task-button').addEventListener('click', () => {
    if (state.taps < 10 || state.tapTaskClaimed) return;
    state.tapTaskClaimed = true; state.coins += 100; save(); render(); showToast('Задание выполнено: +100 ракушек!');
  });

  function invite() {
    const botUsername = window.DUCK_HARBOR_BOT_USERNAME || '';
    const link = botUsername ? `https://t.me/${botUsername}?startapp=invite` : window.location.href;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Залетай в мою Утиную бухту! 🦆')}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl); else window.open(shareUrl, '_blank', 'noopener');
  }
  document.querySelector('#share-button').addEventListener('click', invite);
  document.querySelector('#invite-button').addEventListener('click', invite);

  document.querySelector('#buy-hat').addEventListener('click', async () => {
    const endpoint = window.DUCK_HARBOR_INVOICE_ENDPOINT;
    if (!endpoint) return showToast('Покупки появятся после подключения сервера');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: 'captain_hat', initData: tg?.initData || '' }) });
      if (!response.ok) throw new Error('invoice');
      const { invoiceLink } = await response.json();
      if (!invoiceLink || !tg?.openInvoice) throw new Error('invoice');
      tg.openInvoice(invoiceLink, status => {
        if (status === 'paid') showToast('Спасибо за поддержку бухты!');
        else if (status === 'failed') showToast('Не удалось завершить оплату');
      });
    } catch { showToast('Оплата временно недоступна'); }
  });

  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.view;
    document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `${view}-view`));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('selected', item.dataset.view === view));
    if (view === 'upgrades') renderUpgrades();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));

  const user = tg?.initDataUnsafe?.user;
  document.querySelector('#profile').textContent = user ? (user.first_name || user.username || 'Игрок') : 'Гость';
  applyOfflineAndEnergy(); render(); save();
  setInterval(() => {
    const now = Date.now();
    const regen = Math.floor((now - state.lastEnergyAt) / ENERGY_REGEN_MS);
    if (regen > 0) { state.energy = Math.min(MAX_ENERGY, state.energy + regen); state.lastEnergyAt += regen * ENERGY_REGEN_MS; }
    const earned = Math.floor(state.income / 60);
    if (earned > 0) state.coins += earned;
    save(); render();
  }, 60_000);
})();
