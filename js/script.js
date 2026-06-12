const State = {
  produtos:        [],
  filtroCategoria: 'Todos',
  filtroBusca:     '',
};

function $(id) { return document.getElementById(id); }
function show(id) { const e=$(id); if(e) e.classList.remove('hidden'); }
function hide(id) { const e=$(id); if(e) e.classList.add('hidden'); }

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v);
}

function showToast(msg, type='', ms=3000) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' '+type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.initSite = function() {
  bindNavbar();
  bindProdutos();
  iniciarListenerProdutos();
  initReveal();
};

function bindNavbar() {
  const navbar = $('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  const ham  = $('hamburger');
  const menu = $('mobile-menu');
  if (ham && menu) {
    ham.addEventListener('click', () => menu.classList.toggle('hidden'));
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      fecharMenu();
      resetarFiltros();
      scrollSuave(target);
    });
  });
}

function scrollSuave(target) {
  const navH    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
  const inicio  = window.scrollY;
  const destino = target.getBoundingClientRect().top + window.scrollY - navH;
  const dist    = destino - inicio;
  const dur     = Math.min(900, Math.max(400, Math.abs(dist) * 0.4));
  let startTime = null;

  function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function step(ts) {
    if (!startTime) startTime = ts;
    const p = Math.min((ts - startTime) / dur, 1);
    window.scrollTo(0, inicio + dist * ease(p));
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function resetarFiltros() {
  const inputBusca = $('input-busca');
  if (inputBusca && State.filtroBusca !== '') {
    inputBusca.value = '';
    State.filtroBusca = '';
    hide('btn-limpar');
  }

  if (State.filtroCategoria !== 'Todos') {
    State.filtroCategoria = 'Todos';
    document.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
    const todos = document.querySelector('.filtro[data-cat="Todos"]');
    if (todos) todos.classList.add('active');
    renderizarProdutos();
  }
}

window.fecharMenu = function() {
  const menu = $('mobile-menu');
  if (menu) menu.classList.add('hidden');
};

function bindProdutos() {
  const input  = $('input-busca');
  const limpar = $('btn-limpar');
  const resetBtn = $('btn-reset-filtros');

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (input) input.value = '';
      State.filtroBusca = '';
      State.filtroCategoria = 'Todos';
      hide('btn-limpar');
      document.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
      const todos = document.querySelector('.filtro[data-cat="Todos"]');
      if (todos) todos.classList.add('active');
      renderizarProdutos();
    });
  }

  if (input) {
    input.addEventListener('input', (e) => {
      State.filtroBusca = e.target.value.toLowerCase();
      limpar && (e.target.value ? show('btn-limpar') : hide('btn-limpar'));
      renderizarProdutos();
    });
  }

  if (limpar) {
    limpar.addEventListener('click', () => {
      if (input) input.value = '';
      State.filtroBusca = '';
      hide('btn-limpar');
      renderizarProdutos();
    });
  }

  const filtros = $('filtros');
  if (filtros) {
    filtros.addEventListener('click', (e) => {
      const btn = e.target.closest('.filtro');
      if (!btn) return;
      filtros.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.filtroCategoria = btn.dataset.cat;
      renderizarProdutos();
    });
  }
}

function iniciarListenerProdutos() {
  if (!window._db || !window._ref || !window._onValue) return;

  show('produtos-loading');
  hide('produtos-grid');
  hide('produtos-vazio');

  window._onValue(window._ref(window._db, 'produtos'), (snap) => {
    hide('produtos-loading');
    const val = snap.val();
    if (!val) {
      State.produtos = [];
    } else {
      State.produtos = Object.entries(val)
        .map(([id, d]) => parseProduto(id, d))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    renderizarProdutos();
  }, () => {
    hide('produtos-loading');
    showToast('Erro ao carregar produtos.', 'danger');
  });
}

function parseProduto(id, d) {
  return {
    id,
    nome:       d.nome       || '',
    preco:      Number(d.preco)  || 0,
    descricao:  d.descricao  || '',
    imagem:     d.imagem     || '',
    categoria:  (d.categoria || '').toLowerCase(),
    disponivel: d.disponivel !== false,
    oculto:     d.oculto     === true,
    quantidade: Number(d.quantidade) || 0,
  };
}

function renderizarProdutos() {
  const grid  = $('produtos-grid');
  const vazio = $('produtos-vazio');
  if (!grid) return;

  const lista = State.produtos.filter(p => {
    if (p.oculto) return false;
    const bOk = p.nome.toLowerCase().includes(State.filtroBusca);
    const cOk = State.filtroCategoria === 'Todos' || p.categoria === State.filtroCategoria;
    return bOk && cOk;
  });

  if (lista.length === 0) {
    grid.innerHTML = '';
    hide('produtos-grid');
    show('produtos-vazio');
    return;
  }

  hide('produtos-vazio');
  show('produtos-grid');
  grid.innerHTML = lista.map(cardHTML).join('');
  bindImgFallbacks();
  animarCards();
}

const FALLBACK_IMG = '<div class="produto-img-fallback"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a5c89a" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';

const catLabelMap = { maco:'Maço', unidade:'Unidade', bandeja:'Bandeja', pacote:'Pacote', kg:'Kg' };

function cardHTML(p) {
  const indisp    = !p.disponivel;
  const imgSrc    = 'assets/images/produtos/' + p.imagem;
  const tagIndisp = indisp
    ? '<span class="produto-tag produto-tag-indisponivel">Indisponível</span>' : '';
  const tagQtd = (p.disponivel && p.quantidade > 0)
    ? '<span class="produto-tag produto-tag-qtd">x' + p.quantidade + '</span>' : '';

  return (
    '<article class="produto-card' + (indisp ? ' indisponivel' : '') + '">' +
      '<div class="produto-img-wrap" data-fallback="1">' +
        '<img src="' + imgSrc + '" alt="' + escHtml(p.nome) + '" loading="lazy" />' +
        tagIndisp + tagQtd +
      '</div>' +
      '<div class="produto-info">' +
        '<p class="produto-nome">' + escHtml(p.nome) + '</p>' +
        '<p class="produto-desc">' + escHtml(p.descricao) + '</p>' +
        '<div class="produto-preco-row">' +
          '<span class="produto-preco">' + formatBRL(p.preco) + '</span>' +
          '<span class="produto-cat-badge">' + (catLabelMap[p.categoria] || p.categoria) + '</span>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

function bindImgFallbacks() {
  document.querySelectorAll('.produto-img-wrap[data-fallback] img').forEach(img => {
    img.addEventListener('error', function() {
      this.parentElement.innerHTML = FALLBACK_IMG;
    });
  });
}

function animarCards() {
  const cards = document.querySelectorAll('#produtos-grid .produto-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 40);
  });
}

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    observer.observe(el);
  });
}
