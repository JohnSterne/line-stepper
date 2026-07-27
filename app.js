(async function () {
  const SUPABASE_URL = 'https://mwdxbnrxcssbcggkuyqy.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_s2PhTRGglmEh80sHv4cuhA_nnD4l2dz';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const state = {
    dances: [],
    moves: {},
    filtered: [],
    session: null,
    savedSlugs: new Set(),
    pages: [],
    view: 'list',
    currentDanceSlug: null,
    currentPageId: null,
    authMode: 'login'
  };

  const el = (sel) => document.querySelector(sel);
  const danceGrid = el('#dance-grid');
  const listView = el('#dance-list-view');
  const detailView = el('#dance-detail-view');
  const detailBody = el('#dance-detail');
  const myDancesView = el('#my-dances-view');
  const myDancesGrid = el('#my-dances-grid');
  const myDancesEmpty = el('#my-dances-empty');
  const pagesView = el('#pages-view');
  const pagesGrid = el('#pages-grid');
  const pagesEmpty = el('#pages-empty');
  const pageDetailView = el('#page-detail-view');
  const pageDetailGrid = el('#page-detail-grid');
  const pageDetailEmpty = el('#page-detail-empty');
  const pageDetailTitle = el('#page-detail-title');
  const searchInput = el('#search');

  const modal = el('#move-modal');
  const modalTitle = el('#modal-title');
  const modalDesc = el('#modal-desc');
  const modalVideo = el('#modal-video');
  const modalYtLink = el('#modal-yt-link');
  const modalClose = el('#modal-close');
  const modalDiagram = el('#modal-diagram');
  const modalDiagramImg = el('#modal-diagram-img');

  const authOpenBtn = el('#auth-open-btn');
  const authAccount = el('#auth-account');
  const authEmailEl = el('#auth-email');
  const navMyDances = el('#nav-my-dances');
  const navMyPages = el('#nav-my-pages');
  const logoutBtn = el('#logout-btn');
  const authModal = el('#auth-modal');
  const authModalClose = el('#auth-modal-close');
  const authTabLogin = el('#auth-tab-login');
  const authTabSignup = el('#auth-tab-signup');
  const authForm = el('#auth-form');
  const authEmailInput = el('#auth-email-input');
  const authPasswordInput = el('#auth-password-input');
  const authError = el('#auth-error');
  const authSubmit = el('#auth-submit');

  const newPageBtn = el('#new-page-btn');
  const pageModal = el('#page-modal');
  const pageModalClose = el('#page-modal-close');
  const pageForm = el('#page-form');
  const pageNameInput = el('#page-name-input');
  const pageError = el('#page-error');
  const deletePageBtn = el('#delete-page-btn');

  // ---------- data loading ----------

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

  async function loadUserData() {
    if (!state.session) { state.savedSlugs = new Set(); state.pages = []; return; }
    const [savedRes, pagesRes] = await Promise.all([
      sb.from('linestepper_saved_dances').select('dance_slug'),
      sb.from('linestepper_custom_pages').select('*').order('created_at', { ascending: true })
    ]);
    state.savedSlugs = new Set((savedRes.data || []).map((r) => r.dance_slug));
    state.pages = pagesRes.data || [];
  }

  // ---------- auth ----------

  function renderAuthBar() {
    if (state.session) {
      authOpenBtn.classList.add('hidden');
      authAccount.classList.remove('hidden');
      authEmailEl.textContent = state.session.user.email;
    } else {
      authOpenBtn.classList.remove('hidden');
      authAccount.classList.add('hidden');
    }
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    authTabLogin.classList.toggle('active', mode === 'login');
    authTabSignup.classList.toggle('active', mode === 'signup');
    authSubmit.textContent = mode === 'login' ? 'Log in' : 'Sign up';
    authPasswordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    authError.classList.add('hidden');
  }

  function openAuthModal() {
    authError.classList.add('hidden');
    authForm.reset();
    setAuthMode('login');
    authModal.classList.remove('hidden');
    authEmailInput.focus();
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
  }

  authOpenBtn.addEventListener('click', openAuthModal);
  authModalClose.addEventListener('click', closeAuthModal);
  el('#auth-modal .modal-backdrop').addEventListener('click', closeAuthModal);
  authTabLogin.addEventListener('click', () => setAuthMode('login'));
  authTabSignup.addEventListener('click', () => setAuthMode('signup'));

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    authSubmit.disabled = true;
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    try {
      const { error } = state.authMode === 'login'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
      if (error) throw error;
      closeAuthModal();
    } catch (err) {
      authError.textContent = err.message || 'Something went wrong. Try again.';
      authError.classList.remove('hidden');
    } finally {
      authSubmit.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await sb.auth.signOut();
    showListView();
  });

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    renderAuthBar();
    await loadUserData();
    rerenderCurrentView();
  });

  // ---------- saved dances ----------

  async function isSaved(slug) {
    return state.savedSlugs.has(slug);
  }

  async function toggleSaveDance(slug) {
    if (!state.session) { openAuthModal(); return; }
    if (state.savedSlugs.has(slug)) {
      await sb.from('linestepper_saved_dances').delete().eq('dance_slug', slug);
      state.savedSlugs.delete(slug);
    } else {
      await sb.from('linestepper_saved_dances').insert({ user_id: state.session.user.id, dance_slug: slug });
      state.savedSlugs.add(slug);
    }
    rerenderCurrentView();
  }

  function saveButtonHtml(slug) {
    const saved = state.savedSlugs.has(slug);
    return `<button class="save-btn ${saved ? 'saved' : ''}" data-save-slug="${slug}" title="${saved ? 'Remove from My Dances' : 'Save to My Dances'}">${saved ? '★ Saved' : '☆ Save'}</button>`;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save-slug]');
    if (btn) {
      e.stopPropagation();
      toggleSaveDance(btn.dataset.saveSlug);
    }
  });

  // ---------- custom pages ----------

  newPageBtn.addEventListener('click', () => openPageModal());
  pageModalClose.addEventListener('click', closePageModal);
  el('#page-modal .modal-backdrop').addEventListener('click', closePageModal);

  function openPageModal() {
    if (!state.session) { openAuthModal(); return; }
    pageError.classList.add('hidden');
    pageForm.reset();
    pageModal.classList.remove('hidden');
    pageNameInput.focus();
  }

  function closePageModal() {
    pageModal.classList.add('hidden');
  }

  pageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = pageNameInput.value.trim();
    if (!name) return;
    const { data, error } = await sb
      .from('linestepper_custom_pages')
      .insert({ user_id: state.session.user.id, name, dance_slugs: [] })
      .select()
      .single();
    if (error) {
      pageError.textContent = error.message;
      pageError.classList.remove('hidden');
      return;
    }
    state.pages.push(data);
    closePageModal();
    rerenderCurrentView();
  });

  async function addDanceToPage(pageId, slug) {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page || page.dance_slugs.includes(slug)) return;
    const newSlugs = [...page.dance_slugs, slug];
    await sb.from('linestepper_custom_pages').update({ dance_slugs: newSlugs, updated_at: new Date().toISOString() }).eq('id', pageId);
    page.dance_slugs = newSlugs;
    rerenderCurrentView();
  }

  async function removeDanceFromPage(pageId, slug) {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return;
    const newSlugs = page.dance_slugs.filter((s) => s !== slug);
    await sb.from('linestepper_custom_pages').update({ dance_slugs: newSlugs, updated_at: new Date().toISOString() }).eq('id', pageId);
    page.dance_slugs = newSlugs;
    rerenderCurrentView();
  }

  async function deletePage(pageId) {
    await sb.from('linestepper_custom_pages').delete().eq('id', pageId);
    state.pages = state.pages.filter((p) => p.id !== pageId);
    showPagesView();
  }

  deletePageBtn.addEventListener('click', () => {
    if (!state.currentPageId) return;
    if (confirm('Delete this page? This cannot be undone.')) deletePage(state.currentPageId);
  });

  function addToPageMenuHtml(slug) {
    if (!state.session) return '';
    if (!state.pages.length) {
      return `<div class="add-to-page"><span class="text-faint">No pages yet — </span><button class="link-btn" data-open-new-page>create one</button></div>`;
    }
    const rows = state.pages.map((p) => {
      const inPage = p.dance_slugs.includes(slug);
      return `<label class="page-check-row"><input type="checkbox" data-page-toggle="${p.id}" data-page-toggle-slug="${slug}" ${inPage ? 'checked' : ''}/> ${p.name}</label>`;
    }).join('');
    return `<div class="add-to-page"><span class="field-label-inline">Add to page:</span>${rows}<button class="link-btn" data-open-new-page>+ new page</button></div>`;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-new-page]')) openPageModal();
  });

  document.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-page-toggle]');
    if (!cb) return;
    const pageId = cb.dataset.pageToggle;
    const slug = cb.dataset.pageToggleSlug;
    if (cb.checked) addDanceToPage(pageId, slug);
    else removeDanceFromPage(pageId, slug);
  });

  // ---------- rendering: all dances ----------

  function danceCardHtml(dance) {
    return `
      <div class="dance-card-wrap">
        <button class="dance-card" data-open-dance="${dance.slug}">
          <h3>${dance.title}</h3>
          <div class="meta">${dance.music}</div>
          <div class="meta">${dance.count} count · ${dance.wall}-wall</div>
          <span class="badge">${dance.level}</span>
        </button>
        ${saveButtonHtml(dance.slug)}
      </div>
    `;
  }

  function renderGrid() {
    danceGrid.innerHTML = state.filtered.map(danceCardHtml).join('');
  }

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-dance]');
    if (openBtn) openDance(openBtn.dataset.openDance);
  });

  function openDance(slug) {
    const dance = state.dances.find((d) => d.slug === slug);
    if (!dance) return;
    state.currentDanceSlug = slug;
    location.hash = `#${slug}`;
    setView('detail');

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
      <div class="detail-title-row">
        <h2>${dance.title}</h2>
        ${saveButtonHtml(dance.slug)}
      </div>
      <div class="detail-meta">
        ${dance.music} · Choreographer: ${dance.choreographer} · ${dance.count} count · ${dance.wall}-wall · ${dance.level}
      </div>
      ${addToPageMenuHtml(dance.slug)}
      <ul class="move-list">${rows}</ul>
    `;

    detailBody.querySelectorAll('.move-row').forEach((row) => {
      row.addEventListener('click', () => openMoveModal(row.dataset.moveId));
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    state.filtered = state.dances.filter((d) =>
      d.title.toLowerCase().includes(q) || d.music.toLowerCase().includes(q)
    );
    renderGrid();
  });

  // ---------- rendering: my dances ----------

  function renderMyDances() {
    const dances = state.dances.filter((d) => state.savedSlugs.has(d.slug));
    myDancesGrid.innerHTML = dances.map(danceCardHtml).join('');
    myDancesEmpty.classList.toggle('hidden', dances.length > 0);
  }

  // ---------- rendering: pages ----------

  function renderPagesList() {
    pagesGrid.innerHTML = state.pages.map((p) => `
      <button class="dance-card" data-open-page="${p.id}">
        <h3>${p.name}</h3>
        <div class="meta">${p.dance_slugs.length} dance${p.dance_slugs.length === 1 ? '' : 's'}</div>
      </button>
    `).join('');
    pagesEmpty.classList.toggle('hidden', state.pages.length > 0);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-page]');
    if (btn) showPageDetailView(btn.dataset.openPage);
  });

  function renderPageDetail() {
    const page = state.pages.find((p) => p.id === state.currentPageId);
    if (!page) { showPagesView(); return; }
    pageDetailTitle.textContent = page.name;
    const dances = state.dances.filter((d) => page.dance_slugs.includes(d.slug));
    pageDetailGrid.innerHTML = dances.map(danceCardHtml).join('');
    pageDetailEmpty.classList.toggle('hidden', dances.length > 0);
  }

  // ---------- view switching ----------

  function setView(view) {
    state.view = view;
    listView.classList.toggle('hidden', view !== 'list');
    detailView.classList.toggle('hidden', view !== 'detail');
    myDancesView.classList.toggle('hidden', view !== 'my-dances');
    pagesView.classList.toggle('hidden', view !== 'pages');
    pageDetailView.classList.toggle('hidden', view !== 'page-detail');
  }

  function showListView() {
    location.hash = '';
    setView('list');
    renderGrid();
  }

  function showMyDancesView() {
    if (!state.session) { openAuthModal(); return; }
    location.hash = '#my-dances';
    setView('my-dances');
    renderMyDances();
  }

  function showPagesView() {
    if (!state.session) { openAuthModal(); return; }
    location.hash = '#my-pages';
    state.currentPageId = null;
    setView('pages');
    renderPagesList();
  }

  function showPageDetailView(pageId) {
    state.currentPageId = pageId;
    location.hash = `#page-${pageId}`;
    setView('page-detail');
    renderPageDetail();
  }

  function rerenderCurrentView() {
    if (state.view === 'list') renderGrid();
    else if (state.view === 'detail' && state.currentDanceSlug) openDance(state.currentDanceSlug);
    else if (state.view === 'my-dances') renderMyDances();
    else if (state.view === 'pages') renderPagesList();
    else if (state.view === 'page-detail') renderPageDetail();
  }

  navMyDances.addEventListener('click', showMyDancesView);
  navMyPages.addEventListener('click', showPagesView);

  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.back === 'pages') showPagesView();
      else showListView();
    });
  });

  // ---------- boot ----------

  await loadData();

  const { data: { session: initialSession } } = await sb.auth.getSession();
  state.session = initialSession;
  renderAuthBar();
  await loadUserData();

  const initialSlug = location.hash.replace('#', '');
  if (initialSlug === 'my-dances') showMyDancesView();
  else if (initialSlug === 'my-pages') showPagesView();
  else if (initialSlug.startsWith('page-')) showPageDetailView(initialSlug.replace('page-', ''));
  else if (initialSlug && state.dances.some((d) => d.slug === initialSlug)) openDance(initialSlug);
  else showListView();
})();
