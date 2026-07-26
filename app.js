(async function () {
  const state = { dances: [], moves: {}, filtered: [] };

  const el = (sel) => document.querySelector(sel);
  const danceGrid = el('#dance-grid');
  const listView = el('#dance-list-view');
  const detailView = el('#dance-detail-view');
  const detailBody = el('#dance-detail');
  const backBtn = el('#back-btn');
  const searchInput = el('#search');
  const modal = el('#move-modal');
  const modalTitle = el('#modal-title');
  const modalDesc = el('#modal-desc');
  const modalVideo = el('#modal-video');
  const modalYtLink = el('#modal-yt-link');
  const modalClose = el('#modal-close');
  const modalDiagram = el('#modal-diagram');
  const modalDiagramImg = el('#modal-diagram-img');

  async function loadData() {
    const [dancesRes, movesRes] = await Promise.all([
      fetch('dances.json'),
      fetch('moves.json')
    ]);
    const dancesJson = await dancesRes.json();
    const movesJson = await movesRes.json();
    state.dances = dancesJson.dances;
    movesJson.moves.forEach((m) => { state.moves[m.id] = m; });
    state.filtered = state.dances;
  }

  function renderGrid() {
    danceGrid.innerHTML = '';
    state.filtered.forEach((dance) => {
      const card = document.createElement('button');
      card.className = 'dance-card';
      card.innerHTML = `
        <h3>${dance.title}</h3>
        <div class="meta">${dance.music}</div>
        <div class="meta">${dance.count} count · ${dance.wall}-wall</div>
        <span class="badge">${dance.level}</span>
      `;
      card.addEventListener('click', () => openDance(dance.slug));
      danceGrid.appendChild(card);
    });
  }

  function openDance(slug) {
    const dance = state.dances.find((d) => d.slug === slug);
    if (!dance) return;
    location.hash = `#${slug}`;
    listView.classList.add('hidden');
    detailView.classList.remove('hidden');

    const rows = dance.sequence.map((step) => {
      const move = state.moves[step.moveId];
      const diagramDot = move && move.diagram ? '<span class="diagram-dot" title="Diagram available"></span>' : '';
      return `
        <li class="move-row" data-move-id="${step.moveId}">
          <span class="count-tag">${step.counts}</span>
          <span class="move-label">${step.label}${diagramDot}</span>
          <span class="play-icon">▶ watch</span>
        </li>
      `;
    }).join('');

    detailBody.innerHTML = `
      <h2>${dance.title}</h2>
      <div class="detail-meta">
        ${dance.music} · Choreographer: ${dance.choreographer} · ${dance.count} count · ${dance.wall}-wall · ${dance.level}
      </div>
      <ul class="move-list">${rows}</ul>
    `;

    detailBody.querySelectorAll('.move-row').forEach((row) => {
      row.addEventListener('click', () => openMoveModal(row.dataset.moveId));
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeDance() {
    location.hash = '';
    detailView.classList.add('hidden');
    listView.classList.remove('hidden');
  }

  function openMoveModal(moveId) {
    const move = state.moves[moveId];
    if (!move) return;
    modalTitle.textContent = move.name;
    modalDesc.textContent = move.description;
    const start = move.video.start || 0;
    modalVideo.src = `https://www.youtube.com/embed/${move.video.id}?start=${start}&autoplay=1`;
    modalYtLink.href = `https://www.youtube.com/watch?v=${move.video.id}&t=${start}s`;
    if (move.diagram) {
      modalDiagramImg.src = move.diagram;
      modalDiagram.classList.remove('hidden');
    } else {
      modalDiagram.classList.add('hidden');
      modalDiagramImg.src = '';
    }
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modalVideo.src = '';
  }

  modalClose.addEventListener('click', closeModal);
  el('.modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  backBtn.addEventListener('click', closeDance);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    state.filtered = state.dances.filter((d) =>
      d.title.toLowerCase().includes(q) || d.music.toLowerCase().includes(q)
    );
    renderGrid();
  });

  await loadData();
  renderGrid();

  const initialSlug = location.hash.replace('#', '');
  if (initialSlug) openDance(initialSlug);
})();
