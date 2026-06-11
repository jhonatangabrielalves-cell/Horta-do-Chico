const Admin = {
  produtos:        [],
  produtoEditando: null,
  filtroBusca:     '',
  filtroStatus:    'todos',
  listenerAtivo:   false,
  ordenarPor:      'nome',
  ordenarDir:      'asc',
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

function showErro(id, msg) { const e=$(id); e.textContent=msg; e.classList.remove('hidden'); }
function hideErro(id) { $(id).classList.add('hidden'); }

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.initAdmin = function() {
  const { auth, fns } = window._firebase;

  bindLogin();

  fns.onAuthStateChanged(auth, user => {
    hide('admin-carregando');

    if (user) {
      hide('admin-login');
      show('admin-painel');
      const n = $('navbar-user-nome');
      if (n) n.textContent = user.displayName || user.email;
      show('navbar-user');

      if (!Admin.listenerAtivo) {
        Admin.listenerAtivo = true;
        bindPainel();
        bindForm();
        requestAnimationFrame(() => iniciarListener());
      }
    } else {
      hide('admin-painel');
      show('admin-login');
      hide('navbar-user');
      Admin.listenerAtivo = false;
    }
  });
};

function bindLogin() {
  $('btn-eye').addEventListener('click', () => {
    const inp = $('adm-senha');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  $('btn-adm-login').addEventListener('click', fazerLogin);

  [$('adm-email'), $('adm-senha')].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); })
  );

  const logoutNavbar = $('btn-logout');
  if (logoutNavbar) {
    logoutNavbar.addEventListener('click', () => window._firebase.fns.signOut(window._firebase.auth));
  }
}

async function fazerLogin() {
  const email = $('adm-email').value.trim();
  const senha = $('adm-senha').value.trim();
  hideErro('adm-erro');

  if (!email || !senha) { showErro('adm-erro', 'Preencha e-mail e senha.'); return; }

  const btn = $('btn-adm-login');
  btn.textContent = 'Entrando...';
  btn.disabled = true;

  try {
    const { auth, fns } = window._firebase;
    await fns.signInWithEmailAndPassword(auth, email, senha);
  } catch(e) {
    showErro('adm-erro', traduzirErro(e.code));
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

function traduzirErro(code) {
  const m = {
    'auth/user-not-found':     'Usuário não encontrado.',
    'auth/wrong-password':     'Senha incorreta.',
    'auth/invalid-email':      'E-mail inválido.',
    'auth/too-many-requests':  'Muitas tentativas.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
  };
  return m[code] || 'Erro de autenticação.';
}

function iniciarListener() {
  const { db, fns } = window._firebase;
  show('adm-loading');
  hide('adm-table');
  hide('adm-vazio');

  fns.onValue(fns.ref(db, 'produtos'), snap => {
    hide('adm-loading');
    const val = snap.val();
    Admin.produtos = val
      ? Object.entries(val)
          .map(([id, d]) => parseProduto(id, d))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      : [];
    atualizarStats();
    renderizarTabela();
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

function atualizarStats() {
  const l = Admin.produtos;
  $('stat-total').textContent         = l.length;
  $('stat-disponiveis').textContent   = l.filter(p => p.disponivel && !p.oculto).length;
  $('stat-indisponiveis').textContent = l.filter(p => !p.disponivel).length;
  $('stat-ocultos').textContent       = l.filter(p => p.oculto).length;
}

function bindPainel() {
  $('btn-novo-produto').addEventListener('click', () => abrirForm(null));

  document.querySelectorAll('.th-sort').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (Admin.ordenarPor === col) {
        Admin.ordenarDir = Admin.ordenarDir === 'asc' ? 'desc' : 'asc';
      } else {
        Admin.ordenarPor = col;
        Admin.ordenarDir = 'asc';
      }
      renderizarTabela();
    });
  });

  const logoutSide = $('btn-logout-side');
  if (logoutSide) {
    logoutSide.addEventListener('click', () =>
      window._firebase.fns.signOut(window._firebase.auth)
    );
  }

  $('adm-busca').addEventListener('input', e => {
    Admin.filtroBusca = e.target.value.toLowerCase();
    renderizarTabela();
  });

  document.querySelectorAll('.admin-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-filtro').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Admin.filtroStatus = btn.dataset.status;
      renderizarTabela();
    });
  });
}

function renderizarTabela() {
  let lista = Admin.produtos.filter(p =>
    p.nome.toLowerCase().includes(Admin.filtroBusca)
  );

  if (Admin.filtroStatus === 'disponiveis')   lista = lista.filter(p => p.disponivel && !p.oculto);
  if (Admin.filtroStatus === 'indisponiveis') lista = lista.filter(p => !p.disponivel);
  if (Admin.filtroStatus === 'ocultos')       lista = lista.filter(p => p.oculto);

  lista = ordenarLista(lista);

  if (lista.length === 0) {
    hide('adm-table');
    show('adm-vazio');
    return;
  }

  hide('adm-vazio');
  show('adm-table');
  $('adm-tbody').innerHTML = lista.map(linhaHTML).join('');
  bindLinhas(lista);
  atualizarIconesOrdenacao();
}

function ordenarLista(lista) {
  return [...lista].sort((a, b) => {
    let va = a[Admin.ordenarPor];
    let vb = b[Admin.ordenarPor];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return Admin.ordenarDir === 'asc' ? -1 : 1;
    if (va > vb) return Admin.ordenarDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function atualizarIconesOrdenacao() {
  document.querySelectorAll('.th-sort').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.dataset.col === Admin.ordenarPor) {
      icon.textContent = Admin.ordenarDir === 'asc' ? ' ↑' : ' ↓';
    } else {
      icon.textContent = ' ↕';
    }
  });
}

const catLabel = { maco:'Maço', unidade:'Unidade', bandeja:'Bandeja', pacote:'Pacote', kg:'Kg' };

function linhaHTML(p) {
  return `
    <tr data-id="${escHtml(p.id)}">
      <td>
        <div class="td-produto">
          <div class="td-img">
            <img src="assets/images/produtos/${escHtml(p.imagem)}" alt=""
                 onerror="this.style.display='none'" />
          </div>
          <div>
            <div class="td-nome">${escHtml(p.nome)}</div>
            <div class="td-desc">${escHtml(p.descricao)}</div>
          </div>
        </div>
      </td>
      <td class="td-preco">${formatBRL(p.preco)}</td>
      <td>${catLabel[p.categoria] || p.categoria}</td>
      <td>${p.quantidade || '—'}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" data-action="toggle-disponivel" ${p.disponivel ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <label class="toggle toggle-orange">
          <input type="checkbox" data-action="toggle-oculto" ${p.oculto ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <div class="td-actions">
          <button class="td-btn td-btn-edit" data-action="editar" title="Editar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="td-btn td-btn-del" data-action="excluir" title="Excluir">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function bindLinhas(produtos) {
  const tbody = $('adm-tbody');

  tbody.querySelectorAll('input[data-action]').forEach(inp => {
    inp.addEventListener('change', async e => {
      const id     = e.target.closest('[data-id]')?.dataset.id;
      const action = e.target.dataset.action;
      if (!id) return;
      const { db, fns } = window._firebase;
      try {
        if (action === 'toggle-disponivel') {
          await fns.update(fns.ref(db, `produtos/${id}`), { disponivel: e.target.checked });
          showToast(e.target.checked ? 'Produto marcado como disponível.' : 'Produto marcado como indisponível.');
        }
        if (action === 'toggle-oculto') {
          await fns.update(fns.ref(db, `produtos/${id}`), { oculto: e.target.checked });
          showToast(e.target.checked ? 'Produto ocultado do site.' : 'Produto visível no site.');
        }
      } catch(err) {
        showToast('Erro ao atualizar produto.', 'danger');
        e.target.checked = !e.target.checked;
      }
    });
  });

  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const row    = e.target.closest('[data-id]');
      const id     = row?.dataset.id;
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!id || !action) return;

      if (action === 'editar') {
        const p = produtos.find(x => x.id === id);
        if (p) abrirForm(p);
      } else if (action === 'excluir') {
        const nome = row.querySelector('.td-nome')?.textContent || 'produto';
        if (confirm(`Deseja excluir "${nome}"?`)) {
          const { db, fns } = window._firebase;
          await fns.remove(fns.ref(db, `produtos/${id}`));
          showToast(`"${nome}" excluído.`, 'danger');
        }
      }
    });
  });
}

function bindForm() {
  $('btn-fechar-form').addEventListener('click', fecharForm);
  $('modal-form').addEventListener('click', e => { if (e.target === $('modal-form')) fecharForm(); });
  $('btn-salvar-produto').addEventListener('click', salvarProduto);
}

function abrirForm(p) {
  Admin.produtoEditando = p ? p.id : null;
  hideErro('form-erro');
  $('form-titulo').textContent        = p ? 'Editar Produto' : 'Novo Produto';
  $('btn-salvar-produto').textContent = p ? 'Salvar alterações' : 'Adicionar produto';
  $('form-nome').value       = p ? p.nome : '';
  $('form-preco').value      = p ? p.preco.toFixed(2) : '';
  $('form-descricao').value  = p ? p.descricao : '';
  $('form-imagem').value     = p ? p.imagem : '';
  $('form-quantidade').value = p ? p.quantidade : '';
  $('form-categoria').value  = p ? p.categoria : 'unidade';
  $('form-disponivel').checked = p ? p.disponivel : true;
  $('form-oculto').checked     = p ? p.oculto : false;
  $('modal-form').classList.remove('hidden');
}

function fecharForm() {
  $('modal-form').classList.add('hidden');
  Admin.produtoEditando = null;
}

async function salvarProduto() {
  const nome       = $('form-nome').value.trim();
  const precoStr   = $('form-preco').value.trim().replace(',', '.');
  const descricao  = $('form-descricao').value.trim();
  const imagem     = $('form-imagem').value.trim();
  const quantidade = parseInt($('form-quantidade').value) || 0;
  const categoria  = $('form-categoria').value;
  const disponivel = $('form-disponivel').checked;
  const oculto     = $('form-oculto').checked;
  hideErro('form-erro');

  if (!nome || !precoStr || !descricao || !imagem) {
    showErro('form-erro', 'Preencha todos os campos obrigatórios.');
    return;
  }

  const preco = parseFloat(precoStr);
  if (isNaN(preco)) { showErro('form-erro', 'Preço inválido.'); return; }

  const btn = $('btn-salvar-produto');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  const dados = { nome, preco, descricao, imagem, categoria, disponivel, oculto, quantidade };

  try {
    const { db, fns } = window._firebase;
    if (Admin.produtoEditando) {
      await fns.update(fns.ref(db, `produtos/${Admin.produtoEditando}`), dados);
      showToast('Produto atualizado!', 'success');
    } else {
      await fns.set(fns.push(fns.ref(db, 'produtos')), dados);
      showToast(`"${nome}" adicionado!`, 'success');
    }
    fecharForm();
  } catch(e) {
    console.error(e);
    showErro('form-erro', 'Erro ao salvar. Tente novamente.');
  } finally {
    btn.textContent = Admin.produtoEditando ? 'Salvar alterações' : 'Adicionar produto';
    btn.disabled = false;
  }
}
