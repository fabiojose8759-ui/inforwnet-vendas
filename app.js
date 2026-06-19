// =============================================
// INFORWNET VENDAS - Firebase Auth + Firestore
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyDERPxEUQDLb-ylqU3ayd2qajZokz5v_Oc",
  authDomain: "comercial-vendas-6de88.firebaseapp.com",
  projectId: "comercial-vendas-6de88",
  storageBucket: "comercial-vendas-6de88.firebasestorage.app",
  messagingSenderId: "509793152272",
  appId: "1:509793152272:web:c1e1291b9f008a94db8995"
};

const isFirebaseConfigured = !firebaseConfig.apiKey.includes("COLE_") &&
  firebaseConfig.projectId !== "SEU_PROJETO";

let auth = null;
let db = null;
let currentUser = null;
let currentProfile = null;
let unsubscribeClientes = null;
let unsubscribeUsuarios = null;
let unsubscribeNotificacoes = null;
let clientesCache = [];
let usuariosCache = [];
let notificacoesCache = [];

if (isFirebaseConfigured && window.firebase) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
}

// ── DOM ──
const authShell = document.getElementById('authShell');
const firebaseConfigNotice = document.getElementById('firebaseConfigNotice');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const btnLogout = document.getElementById('btnLogout');

const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page-section');
const obs = document.getElementById('observacoes');
const charCount = document.getElementById('charCount');

const cadastroFields = {
  nome: document.getElementById('nome'),
  cpf: document.getElementById('cpf'),
  rg: document.getElementById('rg'),
  email: document.getElementById('email'),
  endereco: document.getElementById('endereco'),
  tel1: document.getElementById('tel1'),
  tel2: document.getElementById('tel2'),
  valorInstalacao: document.getElementById('valorInstalacao')
};

const planSelect = document.getElementById('plano');
const planPicker = document.getElementById('planPicker');
const planPickerBtn = document.getElementById('planPickerBtn');
const planPickerText = document.getElementById('planPickerText');
const planMenu = document.getElementById('planMenu');

// ── TEMA ──
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('inforwnet-theme', t);
  if (t === 'dark') {
    themeIcon.className = 'ti ti-sun';
    themeLabel.textContent = 'Claro';
  } else {
    themeIcon.className = 'ti ti-moon';
    themeLabel.textContent = 'Escuro';
  }
}

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('inforwnet-theme') || 'light');

// ── AUTENTICAÇÃO ──
function showAuthError(msg) {
  const box = document.getElementById('authError');
  const msgEl = document.getElementById('authErrorMsg');
  if (!box || !msgEl) return;
  msgEl.textContent = msg;
  box.classList.add('show');
}

function hideAuthError() {
  const box = document.getElementById('authError');
  if (box) box.classList.remove('show');
}

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  loginForm.classList.toggle('active', isLogin);
  registerForm.classList.toggle('active', !isLogin);
  const successEl = document.getElementById('registerSuccess');
  if (successEl) successEl.classList.remove('show');
  hideAuthError();
}

tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));

['loginEmail', 'loginSenha'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', hideAuthError);
});

btnLogin.addEventListener('click', async () => {
  hideAuthError();
  if (!ensureFirebaseReady()) return;
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  if (!email || !senha) return showAuthError('Informe email e senha.');

  btnLogin.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(email, senha);
  } catch (error) {
    showAuthError(getAuthErrorMessage(error));
    btnLogin.disabled = false;
  }
});

btnRegister.addEventListener('click', async () => {
  hideAuthError();
  if (!ensureFirebaseReady()) return;
  const nome = document.getElementById('registerNome').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const senha = document.getElementById('registerSenha').value;

  if (nome.length < 3) return showAuthError('Informe o nome completo.');
  if (!isValidEmail(email)) return showAuthError('Informe um email válido.');
  if (senha.length < 6) return showAuthError('A senha deve ter pelo menos 6 caracteres.');

  btnRegister.disabled = true;
  try {
    const credential = await auth.createUserWithEmailAndPassword(email, senha);
    await credential.user.updateProfile({ displayName: nome });
    await db.collection('users').doc(credential.user.uid).set({
      nome, email, role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await auth.signOut();
    document.getElementById('registerNome').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerSenha').value = '';
    document.getElementById('registerSuccess').classList.add('show');
  } catch (error) {
    showAuthError(getAuthErrorMessage(error));
  } finally {
    btnRegister.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  if (!auth) return;
  await auth.signOut();
});



function hideSplash() {
  const s = document.getElementById('appSplash');
  if (s) s.classList.add('hidden');
}

function startAuthListener() {
  document.body.classList.add('auth-active');

  if (!ensureFirebaseReady(false)) {
    firebaseConfigNotice.style.display = 'block';
    btnLogin.disabled = true;
    btnRegister.disabled = true;
    return;
  }

  firebaseConfigNotice.style.display = 'none';
  auth.onAuthStateChanged(async (user) => {
    if (unsubscribeClientes) unsubscribeClientes();
    if (unsubscribeUsuarios) unsubscribeUsuarios();
    if (unsubscribeNotificacoes) unsubscribeNotificacoes();

    currentUser = user;
    currentProfile = null;
    clientesCache = [];
    usuariosCache = [];
    notificacoesCache = [];
    renderNotificacoes();

    if (btnLogin) btnLogin.disabled = false;
    if (btnRegister) btnRegister.disabled = false;

    if (!user) {
      hideSplash();
      document.body.classList.add('auth-active');
      document.body.classList.remove('role-admin');
      renderClientes();
      atualizarDash();
      return;
    }

    currentProfile = await loadUserProfile(user);
    applyLoggedUser(user, currentProfile);
    document.body.classList.remove('auth-active');
    document.body.classList.toggle('role-admin', isAdmin());
    navigate('dashboard');
    hideSplash();
    listenClientes();
    listenNotificacoes();
    if (isAdmin()) listenUsuarios();
  });
}

async function loadUserProfile(user) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();

  const profile = {
    nome: user.displayName || user.email.split('@')[0],
    email: user.email,
    role: 'user',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(profile);
  return { ...profile, createdAt: null };
}

function applyLoggedUser(user, profile) {
  const nome = profile.nome || user.displayName || user.email;
  const roleLabel = isAdmin() ? 'ADMIN' : 'Usuário';
  const initials = getInitials(nome);

  document.querySelectorAll('.avatar').forEach((avatar) => { avatar.textContent = initials; });
  document.querySelectorAll('.sidebar-user .name, .topbar-user .uname').forEach((el) => { el.textContent = nome; });
  document.querySelectorAll('.sidebar-user .role').forEach((el) => { el.textContent = roleLabel; });

  setText('perfilNome', nome);
  setText('perfilEmail', user.email);
  setText('perfilRole', roleLabel);
}

function ensureFirebaseReady(showMessage = true) {
  const ready = isFirebaseConfigured && window.firebase && auth && db;
  if (!ready && showMessage) showToast('Configure o Firebase no app.js antes de usar login.', 'ti-alert-circle', true);
  return ready;
}

function getAuthErrorMessage(error) {
  const code = error && error.code ? error.code : '';
  const messages = {
    'auth/email-already-in-use': 'Este email já está cadastrado.',
    'auth/invalid-email': 'Email inválido.',
    'auth/invalid-login-credentials': 'Email ou senha incorretos.',
    'auth/invalid-credential': 'Email ou senha incorretos.',
    'auth/user-not-found': 'Email ou senha incorretos.',
    'auth/wrong-password': 'Email ou senha incorretos.',
    'auth/weak-password': 'Senha fraca. Use pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
    'auth/user-disabled': 'Esta conta foi desativada.'
  };
  return messages[code] || `Erro de autenticação (${code || 'desconhecido'}).`;
}

// ── SIDEBAR MOBILE ──
menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
});

overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
});

// ── NAVEGAÇÃO ──
function navigate(pageId) {
  if ((pageId === 'usuarios' || pageId === 'financeiro') && !isAdmin()) {
    showToast('Acesso permitido somente para ADMIN.', 'ti-alert-circle', true);
    pageId = 'dashboard';
  }

  pages.forEach(p => p.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  navItems.forEach(n => { if (n.dataset.page === pageId) n.classList.add('active'); });

  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

navItems.forEach(item => { item.addEventListener('click', () => navigate(item.dataset.page)); });

// ── CHAR COUNT TEXTAREA ──
if (obs && charCount) {
  obs.addEventListener('input', () => {
    charCount.textContent = obs.value.length + '/500';
    if (obs.value.length > 500) obs.value = obs.value.slice(0, 500);
  });
}

// ── MÁSCARAS ──
const onlyDigits = (value) => value.replace(/\D/g, '');

function maskCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function maskMoney(value) {
  const digits = onlyDigits(value).slice(0, 9);
  if (!digits) return '';
  const cents = Number(digits) / 100;
  return cents.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function showFieldError(field, message) {
  if (field && typeof field.focus === 'function') field.focus();
  showToast(message, 'ti-alert-circle', true);
  return false;
}

function bindInputRules() {
  const { nome, cpf, rg, email, endereco, tel1, tel2, valorInstalacao } = cadastroFields;

  nome.addEventListener('input', () => {
    nome.value = nome.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s']/g, '').replace(/\s{2,}/g, ' ').slice(0, 80);
  });
  cpf.addEventListener('input', () => { cpf.value = maskCpf(cpf.value); });
  rg.addEventListener('input', () => { rg.value = onlyDigits(rg.value).slice(0, 9); });
  email.addEventListener('input', () => { email.value = email.value.replace(/\s/g, '').slice(0, 120).toLowerCase(); });
  endereco.addEventListener('input', () => { endereco.value = endereco.value.replace(/\s{2,}/g, ' ').slice(0, 120); });
  [tel1, tel2].forEach((field) => { field.addEventListener('input', () => { field.value = maskPhone(field.value); }); });
  valorInstalacao.addEventListener('input', () => { valorInstalacao.value = maskMoney(valorInstalacao.value); });
}

function validateCadastro() {
  const { nome, cpf, rg, email, endereco, tel1, tel2, valorInstalacao } = cadastroFields;
  const nomeLimpo = nome.value.trim();
  const cpfDigits = onlyDigits(cpf.value);
  const rgDigits = onlyDigits(rg.value);
  const tel1Digits = onlyDigits(tel1.value);
  const tel2Digits = onlyDigits(tel2.value);
  const valorDigits = onlyDigits(valorInstalacao.value);

  if (!currentUser) return showFieldError(nome, 'Faça login para cadastrar clientes.');
  if (nomeLimpo.length < 3) return showFieldError(nome, 'Informe o nome completo do cliente.');
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s']+$/.test(nomeLimpo)) return showFieldError(nome, 'O nome deve conter apenas letras.');
  if (cpfDigits.length !== 11 || !isValidCpf(cpf.value)) return showFieldError(cpf, 'Informe um CPF válido com 11 números.');
  if (rgDigits && (rgDigits.length < 7 || rgDigits.length > 9)) return showFieldError(rg, 'O RG deve ter de 7 a 9 números.');
  if (email.value.trim() && !isValidEmail(email.value.trim())) return showFieldError(email, 'Informe um email válido.');
  if (endereco.value.trim() && endereco.value.trim().length < 5) return showFieldError(endereco, 'Informe um endereço mais completo.');
  if (!planSelect.value) return showFieldError(planPickerBtn || planSelect, 'Selecione o plano contratado.');
  if (tel1Digits.length < 10 || tel1Digits.length > 11) return showFieldError(tel1, 'O telefone 01 deve ter DDD e 10 ou 11 números.');
  if (tel2Digits && (tel2Digits.length < 10 || tel2Digits.length > 11)) return showFieldError(tel2, 'O telefone 02 deve ter DDD e 10 ou 11 números.');
  if (valorDigits && Number(valorDigits) <= 0) return showFieldError(valorInstalacao, 'Informe um valor de instalação maior que zero.');

  return true;
}

bindInputRules();

// ── SELETOR DE PLANOS ──
function syncPlanPicker() {
  if (!planSelect || !planPickerText) return;
  const selected = planSelect.options[planSelect.selectedIndex];
  planPickerText.textContent = selected && selected.value ? selected.textContent : 'Selecione o plano';
}

function closePlanPicker() {
  if (!planPicker || !planPickerBtn) return;
  planPicker.classList.remove('open');
  planPickerBtn.setAttribute('aria-expanded', 'false');
}

function initPlanPicker() {
  if (!planSelect || !planPicker || !planPickerBtn || !planMenu) return;

  planPickerBtn.setAttribute('aria-expanded', 'false');
  planPickerBtn.setAttribute('aria-haspopup', 'listbox');
  planMenu.setAttribute('role', 'listbox');

  Array.from(planSelect.children).forEach((item) => {
    if (item.tagName === 'OPTION' && item.value) { addPlanOption(item.textContent, item.value); return; }
    if (item.tagName === 'OPTGROUP') {
      const group = document.createElement('div');
      group.className = 'plan-group';
      group.textContent = item.label;
      planMenu.appendChild(group);
      Array.from(item.children).forEach((option) => { addPlanOption(option.textContent, option.value); });
    }
  });

  planPickerBtn.addEventListener('click', () => {
    const isOpen = planPicker.classList.toggle('open');
    planPickerBtn.setAttribute('aria-expanded', String(isOpen));
  });

  planMenu.addEventListener('click', (event) => {
    const option = event.target.closest('.plan-option');
    if (!option) return;
    planSelect.value = option.dataset.value;
    syncPlanPicker();
    closePlanPicker();
    planSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  document.addEventListener('click', (event) => { if (!planPicker.contains(event.target)) closePlanPicker(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePlanPicker(); });

  syncPlanPicker();
}

function addPlanOption(text, value) {
  const optionBtn = document.createElement('button');
  optionBtn.type = 'button';
  optionBtn.className = 'plan-option';
  optionBtn.dataset.value = value;
  optionBtn.setAttribute('role', 'option');
  optionBtn.textContent = text;
  planMenu.appendChild(optionBtn);
}

initPlanPicker();

// ── CLIENTES ──
document.getElementById('btnLimpar').addEventListener('click', () => {
  document.getElementById('formCadastro').reset();
  if (charCount) charCount.textContent = '0/500';
  syncPlanPicker();
  closePlanPicker();
  showToast('Formulário limpo.', 'ti-refresh');
});

document.getElementById('btnCadastrar').addEventListener('click', async () => {
  if (!validateCadastro()) return;

  const cliente = {
    nome: cadastroFields.nome.value.trim(),
    cpf: document.getElementById('cpf').value.trim(),
    rg: document.getElementById('rg').value.trim(),
    endereco: document.getElementById('endereco').value.trim(),
    plano: planSelect.value,
    vencimento: document.getElementById('vencimento').value,
    tel1: document.getElementById('tel1').value.trim(),
    tel2: document.getElementById('tel2').value.trim(),
    email: document.getElementById('email').value.trim(),
    pgto: document.getElementById('pgto').value,
    valorInstalacao: document.getElementById('valorInstalacao').value.trim(),
    parcelas: document.getElementById('parcelas').value,
    obs: obs ? obs.value.trim() : '',
    data: new Date().toLocaleDateString('pt-BR'),
    createdAtMs: Date.now(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'Pendente',
    userId: currentUser.uid,
    userEmail: currentUser.email,
    userNome: currentProfile.nome || currentUser.displayName || currentUser.email
  };

  try {
    await db.collection('clientes').add(cliente);
    document.getElementById('formCadastro').reset();
    if (charCount) charCount.textContent = '0/500';
    syncPlanPicker();
    closePlanPicker();
    showToast('Cliente cadastrado com sucesso!', 'ti-check');
    navigate('dashboard');
  } catch (error) {
    showToast('Erro ao salvar no Firestore.', 'ti-alert-circle', true);
  }
});

function listenClientes() {
  if (!db || !currentUser) return;
  let query = db.collection('clientes');
  if (!isAdmin()) query = query.where('userId', '==', currentUser.uid);

  unsubscribeClientes = query.onSnapshot((snapshot) => {
    clientesCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    clientesCache.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    renderClientes();
    atualizarDash();
  }, () => {
    showToast('Erro ao carregar clientes.', 'ti-alert-circle', true);
  });
}

// ── NOTIFICAÇÕES ──
function listenNotificacoes() {
  if (!db || !currentUser) return;

  unsubscribeNotificacoes = db.collection('notificacoes')
    .where('userId', '==', currentUser.uid)
    .onSnapshot((snapshot) => {
      notificacoesCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      notificacoesCache.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      renderNotificacoes();
    }, () => {
      // Notificações são um complemento; uma falha aqui não deve travar o app.
    });
}

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(ms).toLocaleDateString('pt-BR');
}

function renderNotificacoes() {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  const markAllBtn = document.getElementById('notifMarkAll');
  if (!badge || !list) return;

  const unread = notificacoesCache.filter(n => !n.lida).length;
  badge.style.display = unread > 0 ? 'flex' : 'none';
  badge.textContent = unread > 9 ? '9+' : String(unread);
  if (markAllBtn) markAllBtn.disabled = unread === 0;

  if (!notificacoesCache.length) {
    list.innerHTML = `<div class="notif-empty"><i class="ti ti-bell-off"></i>Nenhuma notificação por aqui.</div>`;
    return;
  }

  list.innerHTML = notificacoesCache.map((n) => `
    <div class="notif-item ${n.lida ? '' : 'unread'}" onclick="abrirNotificacao('${n.id}')">
      <div class="notif-icon"><i class="ti ti-circle-check"></i></div>
      <div class="notif-body">
        <div class="notif-msg">${escapeHtml(n.mensagem || '')}</div>
        <div class="notif-time">${timeAgo(n.createdAtMs)}</div>
      </div>
      ${n.lida ? '' : '<span class="notif-dot"></span>'}
    </div>
  `).join('');
}

window.abrirNotificacao = async function(id) {
  const n = notificacoesCache.find((x) => x.id === id);
  if (n && !n.lida) {
    try { await db.collection('notificacoes').doc(id).update({ lida: true }); }
    catch (err) { /* a marcação como lida é melhor-esforço */ }
  }
  const panel = document.getElementById('notifPanel');
  if (panel) panel.classList.remove('open');
  navigate('clientes');
};

const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
const notifMarkAllBtn = document.getElementById('notifMarkAll');

if (notifBtn && notifPanel) {
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifPanel.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('notifWrap');
    if (wrap && !wrap.contains(e.target)) notifPanel.classList.remove('open');
  });
}

if (notifMarkAllBtn) {
  notifMarkAllBtn.addEventListener('click', async () => {
    const naoLidas = notificacoesCache.filter((n) => !n.lida);
    if (!naoLidas.length) return;
    try {
      const batch = db.batch();
      naoLidas.forEach((n) => batch.update(db.collection('notificacoes').doc(n.id), { lida: true }));
      await batch.commit();
    } catch (err) {
      showToast('Erro ao marcar notificações como lidas.', 'ti-alert-circle', true);
    }
  });
}

function renderClientes() {
  const tbody = document.getElementById('tbodyClientes');
  if (!tbody) return;

  if (!currentUser) {
    tbody.innerHTML = emptyRow(7, 'Faça login para visualizar clientes.');
    return;
  }

  if (clientesCache.length === 0) {
    tbody.innerHTML = emptyRow(7, 'Nenhum cliente cadastrado ainda.');
    return;
  }

  tbody.innerHTML = clientesCache.map((c) => `
    <tr>
      <td data-label="Nome">
        <span class="cell-icon"><i class="ti ti-user"></i></span>
        <span class="cell-lbl">Nome</span>
        <span class="cell-val">${escapeHtml(c.nome)}</span>
      </td>
      <td data-label="CPF">
        <span class="cell-icon"><i class="ti ti-id-badge-2"></i></span>
        <span class="cell-lbl">CPF</span>
        <span class="cell-val">${escapeHtml(c.cpf)}</span>
      </td>
      <td data-label="Plano">
        <span class="cell-icon"><i class="ti ti-wifi"></i></span>
        <span class="cell-lbl">Plano</span>
        <span class="cell-val">${escapeHtml(c.plano)}</span>
      </td>
      <td data-label="Telefone">
        <span class="cell-icon"><i class="ti ti-phone"></i></span>
        <span class="cell-lbl">Telefone</span>
        <span class="cell-val">${escapeHtml(c.tel1)}</span>
      </td>
      <td data-label="Data">
        <span class="cell-icon"><i class="ti ti-calendar"></i></span>
        <span class="cell-lbl">Data</span>
        <span class="cell-val">${escapeHtml(c.data)}</span>
      </td>
      <td data-label="Status">
        <span class="cell-icon"><i class="ti ti-award"></i></span>
        <span class="cell-lbl">Status</span>
        <span class="cell-val">
          <span class="pill ${c.status === 'Ativo' ? 'pill-green' : 'pill-amber'}">${escapeHtml(c.status)}</span>
        </span>
      </td>
      <td class="table-actions">
        <div class="act-primary">
          <button class="btn btn-action btn-action-whatsapp" type="button" title="Exportar para WhatsApp" onclick="exportarClienteWhatsApp('${c.id}')">
            <i class="ti ti-brand-whatsapp"></i><span class="btn-lbl">WhatsApp</span>
          </button>
          <button class="btn btn-action btn-action-edit" type="button" title="Editar cliente" onclick="editarCliente('${c.id}')">
            <i class="ti ti-edit"></i><span class="btn-lbl">Editar</span>
          </button>
          <button class="btn btn-action btn-action-copy" type="button" tabindex="-1" title="Copiar texto" onclick="copiarClienteTexto('${c.id}', this)">
            <i class="ti ti-copy"></i><span class="btn-lbl">Copiar</span>
          </button>
        </div>
        <div class="act-secondary">
          <button class="btn btn-action btn-action-delete" type="button" title="Excluir cliente" onclick="removerCliente('${c.id}')">
            <i class="ti ti-trash"></i><span class="btn-lbl">Excluir</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── EDITAR CLIENTE ──
window.editarCliente = function(id) {
  const cliente = clientesCache.find(c => c.id === id);
  if (!cliente || !canAccessOwner(cliente.userId)) return showToast('Sem permissão para editar este cliente.', 'ti-alert-circle', true);

  let modal = document.getElementById('editModal');
  if (modal) modal.remove();

  const sel = (field, val) => {
    const opts = { vencimento: ['','5','10','15','20','25','30'], pgto: ['','Pix','Boleto','Cartão de Crédito','Cartão de Débito','Dinheiro'], parcelas: ['','À vista','2x','3x'], status: ['Pendente','Ativo'] };
    const labels = { vencimento: ['Selecione o dia','Dia 5','Dia 10','Dia 15','Dia 20','Dia 25','Dia 30'], pgto: ['Selecione a forma de pagamento','Pix','Boleto','Cartão de Crédito','Cartão de Débito','Dinheiro'], parcelas: ['Selecione o parcelamento','À vista','2x','3x'], status: ['Pendente','Ativo'] };
    return opts[field].map((v,i) => `<option value="${v}" ${v == val ? 'selected' : ''}>${labels[field][i]}</option>`).join('');
  };

  const inputStyle = 'width:100%;padding:10px 10px 10px 38px;border:1px solid var(--input-border);border-radius:var(--radius);background:var(--bg-card);color:var(--txt-primary);font-family:var(--font);font-size:13.5px;outline:none;box-sizing:border-box;';
  const selectStyle = 'width:100%;padding:10px 10px 10px 38px;border:1px solid var(--input-border);border-radius:var(--radius);background:var(--bg-card);color:var(--txt-primary);font-family:var(--font);font-size:13.5px;outline:none;box-sizing:border-box;appearance:none;';

  modal = document.createElement('div');
  modal.id = 'editModal';
  modal.className = 'edit-modal-overlay';
  modal.innerHTML = `
    <div class="edit-modal-card" style="max-width:780px;width:96%;max-height:92vh;overflow-y:auto;padding:0;">

      <div class="edit-modal-header">
        <span><i class="ti ti-edit"></i> Editar Cliente</span>
        <button class="edit-modal-close" onclick="document.getElementById('editModal').remove()">
          <i class="ti ti-x"></i>
        </button>
      </div>

      <div style="padding:20px 20px 0;">

        <div class="card">
          <div class="card-title"><i class="ti ti-id-badge"></i> Dados do Cliente</div>
          <div class="form-grid">

            <div class="form-group">
              <label>Nome: *</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-user"></i></span>
                <input type="text" id="editNome" value="${escapeHtml(cliente.nome)}" placeholder="Digite o nome completo" maxlength="80">
              </div>
            </div>

            <div class="form-group">
              <label>CPF: *</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-id-badge-2"></i></span>
                <input type="text" id="editCpf" value="${escapeHtml(cliente.cpf || '')}" placeholder="000.000.000-00" maxlength="14" inputmode="numeric">
              </div>
            </div>

            <div class="form-group">
              <label>RG:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-id-badge"></i></span>
                <input type="text" id="editRg" value="${escapeHtml(cliente.rg || '')}" placeholder="Digite o RG" maxlength="9" inputmode="numeric">
              </div>
            </div>

            <div class="form-group">
              <label>Email:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-mail"></i></span>
                <input type="email" id="editEmail" value="${escapeHtml(cliente.email || '')}" placeholder="email@exemplo.com" maxlength="120">
              </div>
            </div>

            <div class="form-group">
              <label>Endereço:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-map-pin"></i></span>
                <input type="text" id="editEndereco" value="${escapeHtml(cliente.endereco || '')}" placeholder="Digite o endereço completo" maxlength="120">
              </div>
            </div>

            <div class="form-group">
              <label>Dia de Vencimento:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-calendar"></i></span>
                <select id="editVencimento">${sel('vencimento', cliente.vencimento)}</select>
              </div>
            </div>

            <div class="form-group col3">
              <label>Plano Contratado: *</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-wifi"></i></span>
                <input type="text" id="editPlano" value="${escapeHtml(cliente.plano || '')}" placeholder="Ex: 600 Mega – R$ 119,99/mês" maxlength="100">
              </div>
            </div>

            <div class="form-group">
              <label>Telefone 01: *</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-phone"></i></span>
                <input type="text" id="editTel1" value="${escapeHtml(cliente.tel1 || '')}" placeholder="(00) 00000-0000" maxlength="15" inputmode="numeric">
              </div>
            </div>

            <div class="form-group">
              <label>Telefone 02:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-phone"></i></span>
                <input type="text" id="editTel2" value="${escapeHtml(cliente.tel2 || '')}" placeholder="(00) 00000-0000" maxlength="15" inputmode="numeric">
              </div>
            </div>

          </div>
        </div>

        <div class="card">
          <div class="card-title"><i class="ti ti-credit-card"></i> Forma de Pagamento da Instalação</div>
          <div class="form-grid">

            <div class="form-group">
              <label>Forma de Pagamento:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-credit-card"></i></span>
                <select id="editPgto">${sel('pgto', cliente.pgto)}</select>
              </div>
            </div>

            <div class="form-group">
              <label>Valor da Instalação:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-currency-dollar"></i></span>
                <input type="text" id="editValorInstalacao" value="${escapeHtml(cliente.valorInstalacao || '')}" placeholder="R$ 0,00" maxlength="14" inputmode="numeric">
              </div>
            </div>

            <div class="form-group">
              <label>Parcelamento:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-credit-card"></i></span>
                <select id="editParcelas">${sel('parcelas', cliente.parcelas)}</select>
              </div>
            </div>

            <div class="form-group">
              <label>Status:</label>
              ${isAdmin() ? `
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-award"></i></span>
                <select id="editStatus">${sel('status', cliente.status)}</select>
              </div>
              ` : `
              <div class="input-wrap" style="padding:10px 12px;">
                <span class="inp-icon"><i class="ti ti-award"></i></span>
                <span class="pill ${cliente.status === 'Ativo' ? 'pill-green' : 'pill-amber'}">${escapeHtml(cliente.status || 'Pendente')}</span>
                <span id="editStatusReadonly" data-value="${escapeHtml(cliente.status || 'Pendente')}" style="display:none;"></span>
              </div>
              `}
            </div>

            <div class="form-group col3">
              <label>Observações:</label>
              <textarea id="editObs" placeholder="Digite observações adicionais (opcional)" maxlength="500">${escapeHtml(cliente.obs || '')}</textarea>
              <div class="char-count" id="editObsCount">${(cliente.obs || '').length}/500</div>
            </div>

          </div>
        </div>

      </div>

      <div class="edit-modal-footer" style="position:sticky;bottom:0;background:var(--bg-card);border-top:1px solid var(--border);padding:14px 20px;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-danger-outline" onclick="document.getElementById('editModal').remove()">
          <i class="ti ti-x"></i> Cancelar
        </button>
        <button class="btn btn-primary" onclick="salvarEdicao('${id}')">
          <i class="ti ti-device-floppy"></i> Salvar Alterações
        </button>
      </div>

    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Máscaras
  const f = (elId, fn) => { const el = document.getElementById(elId); if (el) el.addEventListener('input', () => { el.value = fn(el.value); }); };
  f('editCpf', maskCpf);
  f('editTel1', maskPhone);
  f('editTel2', maskPhone);
  f('editValorInstalacao', maskMoney);
  f('editRg', v => onlyDigits(v).slice(0, 9));
  const obsEl = document.getElementById('editObs');
  const obsCount = document.getElementById('editObsCount');
  if (obsEl && obsCount) obsEl.addEventListener('input', () => {
    if (obsEl.value.length > 500) obsEl.value = obsEl.value.slice(0, 500);
    obsCount.textContent = obsEl.value.length + '/500';
  });
};

window.salvarEdicao = async function(id) {
  const clienteOriginal = clientesCache.find((c) => c.id === id);
  const nome = document.getElementById('editNome').value.trim();
  const cpf = document.getElementById('editCpf').value.trim();
  const rg = document.getElementById('editRg').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const endereco = document.getElementById('editEndereco').value.trim();
  const plano = document.getElementById('editPlano').value.trim();
  const tel1 = document.getElementById('editTel1').value.trim();
  const tel2 = document.getElementById('editTel2').value.trim();
  const vencimento = document.getElementById('editVencimento').value;
  const pgto = document.getElementById('editPgto').value;
  const valorInstalacao = document.getElementById('editValorInstalacao').value.trim();
  const parcelas = document.getElementById('editParcelas').value;
  const statusEl = document.getElementById('editStatus');
  const status = statusEl ? statusEl.value : document.getElementById('editStatusReadonly').dataset.value;
  const obs = document.getElementById('editObs').value.trim();

  if (nome.length < 3) return showToast('Nome inválido. Mínimo 3 caracteres.', 'ti-alert-circle', true);
  if (!plano) return showToast('Informe o plano contratado.', 'ti-alert-circle', true);
  if (cpf && onlyDigits(cpf).length !== 11) return showToast('CPF inválido. Informe 11 dígitos.', 'ti-alert-circle', true);
  if (email && !isValidEmail(email)) return showToast('Email inválido.', 'ti-alert-circle', true);
  const tel1Digits = onlyDigits(tel1);
  if (tel1Digits.length < 10 || tel1Digits.length > 11) return showToast('Telefone 01 inválido.', 'ti-alert-circle', true);

  const payload = {
    nome, cpf, rg, email, endereco, plano, tel1, tel2,
    vencimento, pgto, valorInstalacao, parcelas, obs,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (isAdmin()) payload.status = status;

  try {
    await db.collection('clientes').doc(id).update(payload);
    document.getElementById('editModal').remove();
    showToast('Cliente atualizado com sucesso!', 'ti-check');

    // Instalação acabou de ser confirmada pelo admin → avisa o vendedor responsável
    const acabouDeAtivar = isAdmin() && status === 'Ativo' && clienteOriginal && clienteOriginal.status !== 'Ativo';
    if (acabouDeAtivar && clienteOriginal.userId && clienteOriginal.userId !== currentUser.uid) {
      try {
        await db.collection('notificacoes').add({
          userId: clienteOriginal.userId,
          clienteId: id,
          clienteNome: nome,
          tipo: 'instalacao_ativada',
          mensagem: `A instalação do cliente ${nome} foi confirmada! 🎉`,
          lida: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAtMs: Date.now()
        });
      } catch (err) {
        // Notificar é um extra; não deve interromper o fluxo de edição do cliente.
      }
    }
  } catch (err) {
    showToast('Erro ao salvar alterações.', 'ti-alert-circle', true);
  }
};

function splitPlano(plano) {
  // Campo "plano" guarda nome + valor juntos (ex: "600 Mega – R$ 119,99/mês").
  // Tenta separar pelo travessão para preencher "Plano contratado" e "Valor do plano" isoladamente.
  if (!plano) return { nome: '', valor: '' };
  const partes = plano.split(/\s*[–-]\s*/);
  if (partes.length >= 2) {
    return { nome: partes[0].trim(), valor: partes.slice(1).join(' - ').trim() };
  }
  return { nome: plano.trim(), valor: '' };
}

function formatClienteText(cliente) {
  const upper = (value) => (value || '-').toString().toUpperCase();
  const field = (label, value) => `${label}: ${upper(value)}`;
  const { nome: planoNome, valor: planoValor } = splitPlano(cliente.plano);
  const linhas = [
    '📋 DADOS DO CLIENTE',
    field('NOME', cliente.nome),
    field('CPF', cliente.cpf),
    field('RG', cliente.rg),
    '',
    field('📍 ENDEREÇO', cliente.endereco),
    field('🛜 PLANO CONTRATADO', planoNome),
    field('💰VALOR DO PLANO', planoValor),
    '',
    field('📅 DIA DE VENCIMENTO', cliente.vencimento ? `Dia ${cliente.vencimento}` : ''),
    field('📞 TELEFONE 01', cliente.tel1),
    field('📞 TELEFONE 02', cliente.tel2),
    `📧 EMAIL: ${(cliente.email || '-').toLowerCase()}`,
    '',
    field('💳 FORMA DE PAGAMENTO', cliente.pgto),
    `💰VALOR: R$ ${upper(cliente.valorInstalacao)}`,
    field('PARCELAMENTO', cliente.parcelas),
    field('OBSERVAÇÕES', cliente.obs),
    '',
    field('VENDEDOR', cliente.userNome)
  ];
  return linhas.join('\n');
}

window.exportarClienteWhatsApp = function(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(formatClienteText(cliente))}`, '_blank', 'noopener,noreferrer');
};


window.copiarClienteTexto = function(id, btn) {
  if (btn) { btn.blur(); btn.setAttribute('tabindex', '-1'); }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.body.focus();
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente) return;
  const text = formatClienteText(cliente);
  const done = function(ok) {
    setTimeout(function() {
      if (btn) { btn.blur(); }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }, 100);
    showToast(ok ? 'Texto copiado!' : 'Não foi possível copiar.', ok ? 'ti-copy' : 'ti-alert-circle', !ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { done(true); }).catch(function() {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(area);
      area.focus();
      area.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(area);
      done(copied);
    });
  } else {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    done(copied);
  }
};


window.removerCliente = async function(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente || !canAccessOwner(cliente.userId)) return showToast('Sem permissão para remover este cliente.', 'ti-alert-circle', true);
  try {
    await db.collection('clientes').doc(id).delete();
    showToast('Cliente removido.', 'ti-trash');
  } catch (error) {
    showToast('Erro ao remover cliente.', 'ti-alert-circle', true);
  }
};

// ── USUÁRIOS ──
function listenUsuarios() {
  if (!isAdmin()) return;
  unsubscribeUsuarios = db.collection('users').onSnapshot((snapshot) => {
    usuariosCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    usuariosCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    renderUsuarios();
  }, () => { showToast('Erro ao carregar usuários.', 'ti-alert-circle', true); });
}

function renderUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;
  if (!isAdmin()) { tbody.innerHTML = emptyRow(4, 'Acesso permitido somente para ADMIN.'); return; }
  if (usuariosCache.length === 0) { tbody.innerHTML = emptyRow(4, 'Nenhum usuário carregado.'); return; }

  tbody.innerHTML = usuariosCache.map((u) => `
    <tr>
      <td data-label="Nome">${escapeHtml(u.nome || '-')}</td>
      <td data-label="Email">${escapeHtml(u.email || '-')}</td>
      <td data-label="Permissão">
        <span class="pill ${u.role === 'admin' ? 'pill-blue' : 'pill-amber'}">${escapeHtml(u.role || 'user')}</span>
      </td>
      <td data-label="Ações" class="table-actions">
        <select class="role-select" onchange="alterarRoleUsuario('${u.id}', this.value)" ${u.id === currentUser.uid ? 'disabled' : ''}>
          <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>user</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.alterarRoleUsuario = async function(uid, role) {
  if (!isAdmin()) return showToast('Acesso permitido somente para ADMIN.', 'ti-alert-circle', true);
  if (!['admin', 'user'].includes(role)) return;
  try {
    await db.collection('users').doc(uid).update({ role, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Permissão atualizada.', 'ti-check');
  } catch (error) { showToast('Erro ao atualizar permissão.', 'ti-alert-circle', true); }
};

// ── DASHBOARD ──
let chartCadastros = null;
let chartMeta = null;

function atualizarDash() {
  const total = clientesCache.length;
  const ativos = clientesCache.filter(c => c.status === 'Ativo').length;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const hojeCount = clientesCache.filter(c => c.data === hoje).length;

  setText('dash-total', total);
  setText('dash-ativos', ativos);
  setText('dash-hoje', hojeCount);

  // Data formatada
  const dataEl = document.getElementById('dash-data-hoje');
  if (dataEl) {
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // Meta
  const META = 30;
  const pct = total > 0 ? Math.round((total / META) * 100) : 0;
  setText('dash-meta-pct', `${total} (${pct}%)`);

  // Gráfico de linha — últimos 7 dias
  const diasLabels = [];
  const diasCount = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const dateStr = d.toLocaleDateString('pt-BR');
    diasLabels.push(label);
    diasCount.push(clientesCache.filter(c => c.data === dateStr).length);
  }

  const ctxLine = document.getElementById('chartCadastros');
  if (ctxLine) {
    if (chartCadastros) chartCadastros.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const labelColor = isDark ? '#94a3b8' : '#6b7280';
    chartCadastros = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: diasLabels,
        datasets: [{
          label: 'Cadastros',
          data: diasCount,
          borderColor: '#2563eb',
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0, 'rgba(37,99,235,0.18)');
            g.addColorStop(1, 'rgba(37,99,235,0)');
            return g;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} cadastro(s)` } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 11 }, precision: 0, stepSize: 1 }, beginAtZero: true }
        }
      }
    });
  }

  // Donut Chart — Meta
  const ctxDonut = document.getElementById('chartMeta');
  if (ctxDonut) {
    if (chartMeta) chartMeta.destroy();
    const alcancado = Math.min(total, META);
    const restante = Math.max(META - total, 0);
    chartMeta = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [alcancado, restante],
          backgroundColor: ['#2563eb', '#e5e7eb'],
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });
  }

  // Lista Recentes
  const listaEl = document.getElementById('listaRecentes');
  if (listaEl) {
    const recentes = clientesCache.slice(0, 5);
    if (recentes.length === 0) {
      listaEl.innerHTML = `<div class="dash-empty">${currentUser ? 'Nenhum cadastro ainda.' : 'Faça login para visualizar.'}</div>`;
    } else {
      const cores = ['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];
      listaEl.innerHTML = recentes.map((c, i) => {
        const initials = getInitials(c.nome);
        const cor = cores[i % cores.length];
        const pillClass = c.status === 'Ativo' ? 'pill-green' : 'pill-amber';
        return `
          <div class="recente-item">
            <div class="recente-avatar ${cor}">${escapeHtml(initials)}</div>
            <div class="recente-info">
              <div class="recente-nome">${escapeHtml(c.nome)}</div>
              <div class="recente-cpf">${escapeHtml(c.cpf || '-')}</div>
            </div>
            <div class="recente-mid">
              <span class="recente-plano">${escapeHtml(c.plano || '-')}</span>
              <span class="recente-data">${escapeHtml(c.data || '-')}</span>
              <span class="pill ${pillClass}">${escapeHtml(c.status)}</span>
            </div>
          </div>`;
      }).join('');
    }
  }

  // Timeline de Atividades
  const tlEl = document.getElementById('dashTimeline');
  if (tlEl) {
    const recentes = clientesCache.slice(0, 5);
    if (recentes.length === 0) {
      tlEl.innerHTML = `<div class="dash-empty">Sem atividades.</div>`;
    } else {
      const tipos = [
        { icon: 'ti-user-plus', cls: 'tl-blue', title: 'Novo cadastro realizado' },
        { icon: 'ti-circle-check', cls: 'tl-green', title: 'Cliente confirmado' },
        { icon: 'ti-clock', cls: 'tl-amber', title: 'Cadastro pendente' },
        { icon: 'ti-user', cls: 'tl-purple', title: 'Novo cliente cadastrado' },
        { icon: 'ti-refresh', cls: 'tl-blue', title: 'Status atualizado' }
      ];
      tlEl.innerHTML = recentes.map((c, i) => {
        const t = tipos[i % tipos.length];
        const quando = i === 0 ? 'Agora há pouco' : i === 1 ? '10 minutos atrás' : i === 2 ? '1 hora atrás' : `${c.data || '-'}`;
        return `
          <div class="timeline-item">
            <div class="timeline-dot ${t.cls}"><i class="ti ${t.icon}"></i></div>
            <div class="tl-body">
              <div class="tl-title">${t.title}</div>
              <div class="tl-name">${escapeHtml(c.nome)}</div>
              <div class="tl-time">${quando}</div>
            </div>
          </div>`;
      }).join('');
    }
  }
}

// ── HELPERS ──
function isAdmin() { return currentProfile && currentProfile.role === 'admin'; }
function canAccessOwner(ownerUid) { return isAdmin() || (currentUser && ownerUid === currentUser.uid); }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function getInitials(name) {
  return String(name || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function emptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" style="text-align:center;padding:24px;color:var(--txt-muted)">${message}</td></tr>`;
}

function showToast(msg, icon = 'ti-check', error = false, duration = 3000) {
  const t = document.getElementById('toast');
  const ti = document.getElementById('toastIcon');
  const tm = document.getElementById('toastMsg');
  ti.className = 'ti ' + icon;
  ti.style.color = error ? '#ef4444' : '#5DCAA5';
  tm.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

window.showToast = showToast;

window.toggleSenha = function(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'ti ti-eye-off';
  } else {
    input.type = 'password';
    icon.className = 'ti ti-eye';
  }
};

// ── INIT ──
document.body.classList.add('auth-active');
navigate('dashboard');
renderClientes();
atualizarDash();
startAuthListener();
