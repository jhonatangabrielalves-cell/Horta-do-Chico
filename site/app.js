const State = {
  produtos:        [],
  filtroCategoria: 'Todos',
  filtroBusca:     '',
};

function $(id) { return document.getElementById(id); }
function show(id) { const e = $(id); if (e) e.classList.remove('hidden'); }
function hide(id) { const e = $(id); if (e) e.classList.add('hidden'); }

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function showToast(msg, type = '', ms = 3000) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Ponto de entrada ────────────────────────────────────
window.initSite = function () {
  bindNavbar();
  bindProdutos();
  iniciarListenerProdutos();
  initReveal();
};

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

// ── Navbar scroll + hamburger ────────────────────────────
function bindNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  const ham  = $('hamburger');
  const menu = $('mobile-menu');
  if (ham && menu) {
    ham.addEventListener('click', () => {
      menu.classList.toggle('hidden');
    });
  }
}

window.fecharMenu = function () {
  const menu = $('mobile-menu');
  if (menu) menu.classList.add('hidden');
};

// ── Produtos ─────────────────────────────────────────────
function bindProdutos() {
  const input  = $('input-busca');
  const limpar = $('btn-limpar');
  const resetFiltros = $('btn-reset-filtros');
  if (resetFiltros) {
    resetFiltros.addEventListener('click', () => {
      input.value = '';
      State.filtroBusca = '';
      State.filtroCategoria = 'Todos';
      hide('btn-limpar');
      document.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
      document.querySelector('.filtro[data-cat="Todos"]')?.classList.add('active');
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
      input.value = '';
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
    nome:       d.nome      || '',
    preco:      Number(d.preco) || 0,
    descricao:  d.descricao || '',
    imagem:     d.imagem    || '',
    categoria:  (d.categoria || '').toLowerCase(),
    disponivel: d.disponivel !== false,
    oculto:     d.oculto === true,
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
  animarCards();
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

function cardHTML(p) {
  const indisp = !p.disponivel;
  const imgSrc = `assets/images/produtos/${escHtml(p.imagem)}`;
  const tagIndisp = indisp
    ? `<span class="produto-tag produto-tag-indisponivel">Indisponível</span>` : '';
  const tagQtd = (p.disponivel && p.quantidade > 0)
    ? `<span class="produto-tag produto-tag-qtd">x${p.quantidade}</span>` : '';
  const catLabel = { maco:'Maço', unidade:'Unidade', bandeja:'Bandeja', pacote:'Pacote', kg:'Kg' };

  return `
    <article class="produto-card${indisp ? ' indisponivel' : ''}">
      <div class="produto-img-wrap">
        <img src="${imgSrc}" alt="${escHtml(p.nome)}"
             onerror="this.parentElement.innerHTML='<div class=\\'produto-img-fallback\\'>🥦</div>'" />
        ${tagIndisp}${tagQtd}
      </div>
      <div class="produto-info">
        <p class="produto-nome">${escHtml(p.nome)}</p>
        <p class="produto-desc">${escHtml(p.descricao)}</p>
        <div class="produto-preco-row">
          <span class="produto-preco">${formatBRL(p.preco)}</span>
          <span class="produto-cat-badge">${catLabel[p.categoria] || p.categoria}</span>
        </div>
      </div>
    </article>`;
}