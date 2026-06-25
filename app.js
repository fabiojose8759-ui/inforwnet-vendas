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
let unsubscribeDashboardConfig = null;
let clientesCache = [];
let usuariosCache = [];
let notificacoesCache = [];
let dashboardConfig = { metaMensal: 30 };
let metasModoAtual = 'global'; // 'global' | 'individual'
let filtroBuscaTopbar = '';

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
const topbarSearchWrap = document.getElementById('topbarSearchWrap');
const topbarSearchInput = document.getElementById('topbarSearchInput');
const topbarSearchClear = document.getElementById('topbarSearchClear');
const obs = document.getElementById('observacoes');
const charCount = document.getElementById('charCount');

const cadastroFields = {
  nome: document.getElementById('nome'),
  cpf: document.getElementById('cpf'),
  rg: document.getElementById('rg'),
  email: document.getElementById('email'),
  endereco: document.getElementById('endereco'),
  bairro: document.getElementById('bairro'),
  tel1: document.getElementById('tel1'),
  tel2: document.getElementById('tel2'),
  valorInstalacao: document.getElementById('valorInstalacao')
};

const planSelect = document.getElementById('plano');
const planPicker = document.getElementById('planPicker');
const planPickerBtn = document.getElementById('planPickerBtn');
const planPickerText = document.getElementById('planPickerText');
const planMenu = document.getElementById('planMenu');
const metaMensalInput = document.getElementById('metaMensalInput');
const btnSalvarMeta = document.getElementById('btnSalvarMeta');
const btnAbrirMeta = document.getElementById('btnAbrirMeta');
const btnFecharMeta = document.getElementById('btnFecharMeta');
const btnCancelarMeta = document.getElementById('btnCancelarMeta');
const modalMetaOverlay = document.getElementById('modalMetaOverlay');
const modalMetaAtualLabel = document.getElementById('modalMetaAtualLabel');

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

window.toggleUserDropdown = function() {
  const btn = document.getElementById('topbar-user-btn');
  const dropdown = document.getElementById('user-dropdown');
  const isOpen = dropdown.classList.contains('open');
  if (isOpen) {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
  } else {
    dropdown.classList.add('open');
    btn.classList.add('open');
  }
};

window.fazerLogout = async function() {
  if (!auth) return;
  await auth.signOut();
};

document.addEventListener('click', function(e) {
  const btn = document.getElementById('topbar-user-btn');
  const dropdown = document.getElementById('user-dropdown');
  if (!btn || !dropdown) return;
  if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
  }
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
    if (unsubscribeDashboardConfig) unsubscribeDashboardConfig();

    currentUser = user;
    currentProfile = null;
    clientesCache = [];
    usuariosCache = [];
    notificacoesCache = [];
    dashboardConfig = { metaMensal: 30 };
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
    listenDashboardConfig();
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
  const roleLabel = isAdmin() ? 'Administrador' : 'Vendedor';
  const initials = getInitials(nome);
  const primeiroNome = String(nome).trim().split(/\s+/)[0];

  document.querySelectorAll('.sidebar-user .avatar, .topbar-user .avatar').forEach((avatar) => { avatar.textContent = initials; });
  document.querySelectorAll('.sidebar-user .name, .topbar-user .uname').forEach((el) => { el.textContent = nome; });
  document.querySelectorAll('.sidebar-user .role').forEach((el) => { el.textContent = roleLabel; });

  setText('dash-greeting-nome', primeiroNome);
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

navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.page === 'meta') {
      abrirModalMeta();
    } else {
      navigate(item.dataset.page);
    }
  });
});

// ── BUSCA TOPBAR ──
if (topbarSearchInput) {
  topbarSearchInput.addEventListener('input', () => {
    filtroBuscaTopbar = topbarSearchInput.value;
    topbarSearchWrap.classList.toggle('has-value', filtroBuscaTopbar.trim().length > 0);

    const paginaClientes = document.getElementById('page-clientes');
    if (filtroBuscaTopbar.trim() && paginaClientes && !paginaClientes.classList.contains('active')) {
      navigate('clientes');
    }
    renderClientes();
  });
}

if (topbarSearchClear) {
  topbarSearchClear.addEventListener('click', () => {
    filtroBuscaTopbar = '';
    topbarSearchInput.value = '';
    topbarSearchWrap.classList.remove('has-value');
    renderClientes();
    topbarSearchInput.focus();
  });
}

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
  const { nome, cpf, rg, email, endereco, bairro, tel1, tel2, valorInstalacao } = cadastroFields;

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
  const { nome, cpf, rg, email, endereco, bairro, tel1, tel2, valorInstalacao } = cadastroFields;
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
    bairro: document.getElementById('bairro').value.trim(),
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

  if (clientesCache.length === 0) {
    tbody.innerHTML = emptyRow(7, 'Nenhum cliente cadastrado ainda.');
    return;
  }

  const termo = filtroBuscaTopbar.trim().toLowerCase();
  const lista = termo
    ? clientesCache.filter((c) => [c.nome, c.cpf, c.plano, c.tel1].some((v) => String(v || '').toLowerCase().includes(termo)))
    : clientesCache;

  const isMobile = window.innerWidth <= 600;

  if (isMobile) {
    // RENDERIZAÇÃO EM CARDS (MOBILE)
    tbody.innerHTML = lista.map((c) => `
      <div class="cliente-card">
        <div class="card-header">
          <div class="card-avatar">${getInitials(c.nome)}</div>
          <div class="card-info">
            <div class="card-nome">${escapeHtml(c.nome)}</div>
            <div class="card-sub">${escapeHtml(c.cpf || '')}</div>
          </div>
          <span class="pill ${c.status === 'Ativo' ? 'pill-green' : 'pill-amber'}">${escapeHtml(c.status)}</span>
        </div>
        <div class="card-body">
          ${escapeHtml(c.plano)}<br>
          ${escapeHtml(c.tel1)}
        </div>
        <div class="card-actions">
          <button class="btn btn-action btn-action-edit" onclick="editarCliente('${c.id}')"><i class="ti ti-edit"></i></button>
          <button class="btn btn-action btn-action-copy" onclick="copiarClienteTexto('${c.id}')"><i class="ti ti-copy"></i></button>
          <button class="btn btn-action btn-action-whatsapp" onclick="exportarClienteWhatsApp('${c.id}')"><i class="ti ti-brand-whatsapp"></i></button>
        </div>
      </div>
    `).join('');
  } else {
    // MANTÉM A TABELA ORIGINAL (DESKTOP) - Ajuste conforme seu código existente
    // ... seu código de tabela atual ...
  }

  tbody.innerHTML = lista.map((c) => `
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
              <label>Bairro:</label>
              <div class="input-wrap">
                <span class="inp-icon"><i class="ti ti-map-2"></i></span>
                <input type="text" id="editBairro" value="${escapeHtml(cliente.bairro || '')}" placeholder="Digite o bairro" maxlength="80">
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
  const bairro = document.getElementById('editBairro').value.trim();
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
    nome, cpf, rg, email, endereco, bairro, plano, tel1, tel2,
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
    field('🏘️ BAIRRO', cliente.bairro),
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


window.removerCliente = function(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente || !canAccessOwner(cliente.userId)) return showToast('Sem permissão para remover este cliente.', 'ti-alert-circle', true);

  let modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'deleteConfirmModal';
  modal.className = 'edit-modal-overlay';
  modal.innerHTML = `
    <div class="edit-modal-card delete-confirm-card">
      <div class="edit-modal-header delete-confirm-header">
        <span><i class="ti ti-alert-triangle"></i> Confirmar exclusão</span>
        <button class="edit-modal-close" type="button" onclick="document.getElementById('deleteConfirmModal').remove()">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <div class="edit-modal-body delete-confirm-body">
        <div class="delete-confirm-icon"><i class="ti ti-trash"></i></div>
        <div>
          <strong>Excluir cadastro de ${escapeHtml(cliente.nome || 'cliente')}?</strong>
          <p>Esta ação remove o cliente da lista e não pode ser desfeita.</p>
        </div>
      </div>
      <div class="edit-modal-footer">
        <button class="btn btn-outline" type="button" onclick="document.getElementById('deleteConfirmModal').remove()">
          <i class="ti ti-x"></i> Cancelar
        </button>
        <button class="btn btn-danger" type="button" onclick="confirmarRemocaoCliente('${id}', this)">
          <i class="ti ti-trash"></i> Confirmar exclusão
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

window.confirmarRemocaoCliente = async function(id, btn) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente || !canAccessOwner(cliente.userId)) return showToast('Sem permissão para remover este cliente.', 'ti-alert-circle', true);
  if (btn) btn.disabled = true;
  try {
    await db.collection('clientes').doc(id).delete();
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.remove();
    showToast('Cliente removido.', 'ti-trash');
  } catch (error) {
    if (btn) btn.disabled = false;
    showToast('Erro ao remover cliente.', 'ti-alert-circle', true);
  }
};

// ── CONFIGURAÇÕES DO DASHBOARD ──
function listenDashboardConfig() {
  if (!db || !currentUser) return;

  unsubscribeDashboardConfig = db.collection('config').doc('dashboard').onSnapshot((snap) => {
    const data = snap.exists ? snap.data() : {};
    const meta = Number(data.metaMensal);
    dashboardConfig.metaMensal = Number.isFinite(meta) && meta > 0 ? Math.round(meta) : 30;
    syncMetaInput();
    atualizarDash();
  }, () => {
    dashboardConfig.metaMensal = 30;
    syncMetaInput();
    atualizarDash();
  });

  // Ouvir alterações na própria meta individual do usuário logado
  db.collection('users').doc(currentUser.uid).onSnapshot((snap) => {
    if (snap.exists) {
      const data = snap.data();
      if (currentProfile) {
        currentProfile.metaMensal = data.metaMensal || null;
      }
      atualizarDash();
    }
  }, () => {});
}

function syncMetaInput() {
  setText('dash-meta-valor', dashboardConfig.metaMensal);
  if (metaMensalInput) metaMensalInput.value = String(dashboardConfig.metaMensal);
  if (modalMetaAtualLabel) modalMetaAtualLabel.textContent = dashboardConfig.metaMensal;
}

// ── Modal Meta: abrir/fechar ──
function abrirModalMeta() {
  if (metaMensalInput) metaMensalInput.value = String(dashboardConfig.metaMensal);
  if (modalMetaAtualLabel) modalMetaAtualLabel.textContent = dashboardConfig.metaMensal;
  // Sempre abre na aba global
  setMetaModo('global');
  if (modalMetaOverlay) { modalMetaOverlay.classList.add('open'); metaMensalInput?.focus(); }
}

function fecharModalMeta() {
  if (modalMetaOverlay) modalMetaOverlay.classList.remove('open');
}

if (btnAbrirMeta) btnAbrirMeta.addEventListener('click', abrirModalMeta);
if (btnFecharMeta) btnFecharMeta.addEventListener('click', fecharModalMeta);
if (btnCancelarMeta) btnCancelarMeta.addEventListener('click', fecharModalMeta);
if (modalMetaOverlay) {
  modalMetaOverlay.addEventListener('click', (e) => { if (e.target === modalMetaOverlay) fecharModalMeta(); });
}

// ── Alternância de modo: global / por vendedor ──
window.setMetaModo = function(modo) {
  metasModoAtual = modo;
  const tabGlobal = document.getElementById('tabMetaGlobal');
  const tabInd    = document.getElementById('tabMetaIndividual');
  const bodyGlobal = document.getElementById('metaModoGlobal');
  const bodyInd    = document.getElementById('metaModoIndividual');
  if (tabGlobal)  tabGlobal.classList.toggle('active', modo === 'global');
  if (tabInd)     tabInd.classList.toggle('active', modo === 'individual');
  if (bodyGlobal) bodyGlobal.style.display = modo === 'global' ? '' : 'none';
  if (bodyInd)    bodyInd.style.display    = modo === 'individual' ? '' : 'none';
  if (modo === 'individual') renderMetaVendedores();
};

function renderMetaVendedores() {
  const listEl = document.getElementById('metaVendedoresList');
  if (!listEl) return;

  if (usuariosCache.length === 0) {
    listEl.innerHTML = `<div class="meta-loading">Nenhum vendedor encontrado.<br><small>Acesse a página Usuários para garantir que há contas cadastradas.</small></div>`;
    return;
  }

  listEl.innerHTML = usuariosCache.map((u) => {
    const metaInd = u.metaMensal ? Number(u.metaMensal) : '';
    const initials = getInitials(u.nome || u.email);
    const roleBadge = u.role === 'admin'
      ? `<span class="pill pill-blue" style="font-size:10px;padding:1px 6px;">admin</span>`
      : `<span class="pill pill-amber" style="font-size:10px;padding:1px 6px;">vendedor</span>`;
    return `
      <div class="meta-vendedor-row">
        <div class="meta-vendedor-avatar">${escapeHtml(initials)}</div>
        <div class="meta-vendedor-info">
          <div class="meta-vendedor-nome">${escapeHtml(u.nome || u.email || '-')} ${roleBadge}</div>
          <div class="meta-vendedor-email">${escapeHtml(u.email || '')}</div>
        </div>
        <div class="meta-vendedor-field">
          <input type="number" class="meta-vendedor-input" data-uid="${u.id}"
                 min="1" max="9999" step="1"
                 value="${metaInd}"
                 placeholder="${dashboardConfig.metaMensal}">
          <span class="meta-vendedor-unit">vendas</span>
        </div>
      </div>`;
  }).join('');
}

if (btnSalvarMeta) {
  btnSalvarMeta.addEventListener('click', async () => {
    if (!isAdmin()) return showToast('Apenas Administrador pode alterar metas.', 'ti-alert-circle', true);

    if (metasModoAtual === 'global') {
      const meta = Math.round(Number(metaMensalInput ? metaMensalInput.value : 0));
      if (!Number.isFinite(meta) || meta < 1 || meta > 9999) {
        return showToast('Informe uma meta entre 1 e 9999.', 'ti-alert-circle', true);
      }
      btnSalvarMeta.disabled = true;
      try {
        await db.collection('config').doc('dashboard').set({
          metaMensal: meta,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: currentUser.uid
        }, { merge: true });
        showToast('Meta global atualizada.', 'ti-check');
        fecharModalMeta();
      } catch (error) {
        showToast('Erro ao salvar meta global.', 'ti-alert-circle', true);
      } finally {
        btnSalvarMeta.disabled = false;
      }
    } else {
      // Modo individual — salva metaMensal em cada users/{uid}
      const inputs = document.querySelectorAll('.meta-vendedor-input');
      if (!inputs.length) return showToast('Nenhum vendedor para salvar.', 'ti-alert-circle', true);

      btnSalvarMeta.disabled = true;
      try {
        const batch = db.batch();
        inputs.forEach((input) => {
          const uid = input.dataset.uid;
          const val = input.value.trim();
          const num = val ? Math.round(Number(val)) : null;
          const ref = db.collection('users').doc(uid);
          if (num && num >= 1 && num <= 9999) {
            batch.update(ref, { metaMensal: num, metaUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else {
            // Remove meta individual (usa a global)
            batch.update(ref, { metaMensal: firebase.firestore.FieldValue.delete() });
          }
        });
        await batch.commit();
        showToast('Metas individuais salvas com sucesso!', 'ti-check');
        fecharModalMeta();
      } catch (error) {
        showToast('Erro ao salvar metas individuais.', 'ti-alert-circle', true);
      } finally {
        btnSalvarMeta.disabled = false;
      }
    }
  });
}

// ── USUÁRIOS ──
function listenUsuarios() {
  if (!isAdmin()) return;
  unsubscribeUsuarios = db.collection('users').onSnapshot((snapshot) => {
    usuariosCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    usuariosCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    renderUsuarios();
    // Atualiza lista de metas se o modo individual estiver aberto
    if (metasModoAtual === 'individual' && modalMetaOverlay && modalMetaOverlay.classList.contains('open')) {
      renderMetaVendedores();
    }
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

function getClienteDate(cliente) {
  if (cliente.createdAtMs) return new Date(cliente.createdAtMs);
  if (cliente.data) {
    const parts = String(cliente.data).split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (day && month && year) return new Date(year, month - 1, day);
    }
  }
  return null;
}

function isSameMonth(date, reference) {
  return date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === reference.getMonth() &&
    date.getFullYear() === reference.getFullYear();
}

function atualizarDash() {
  const total = clientesCache.length;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const hojeCount = clientesCache.filter(c => c.data === hoje).length;
  const agora = new Date();
  const pendentes = clientesCache.filter(c => (c.status || 'Pendente') !== 'Ativo').length;
  const instalacoesHoje = clientesCache.filter(c => c.activatedAtDate === hoje).length;
  const vendasMes = clientesCache.filter(c => isSameMonth(getClienteDate(c), agora)).length;

  setText('dash-total', total);
  setText('dash-pendentes', pendentes);
  setText('dash-instalacoes-hoje', instalacoesHoje);
  setText('dash-vendas-mes', vendasMes);

  // Data formatada
  const dataEl = document.getElementById('dash-data-hoje');
  if (dataEl) {
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // Meta: usa individual do usuário logado se disponível, senão usa a global
  const metaIndividual = currentProfile && Number(currentProfile.metaMensal) > 0
    ? Number(currentProfile.metaMensal)
    : null;
  const META = metaIndividual || dashboardConfig.metaMensal || 30;
  setText('dash-meta-valor', META);

  // Meta Card — novo layout
  const pctVal = META > 0 ? Math.min(Math.round((vendasMes / META) * 100), 100) : 0;
  const faltam = Math.max(META - vendasMes, 0);
  const hojeData = new Date();
  const diasNoMes = new Date(hojeData.getFullYear(), hojeData.getMonth() + 1, 0).getDate();
  const diaAtual = hojeData.getDate();
  const diasRestantes = diasNoMes - diaAtual;
  const projecao = diaAtual > 0 ? Math.round((vendasMes / diaAtual) * diasNoMes) : 0;

  setText('dash-meta-atual', vendasMes);
  setText('dash-meta-pct-badge', pctVal + '%');
  setText('dash-meta-faltam', faltam);
  setText('dash-meta-projecao', projecao + ' vendas');
  setText('dash-meta-dias', diasRestantes + ' dias');

  const fill = document.getElementById('dash-meta-fill');
  if (fill) fill.style.width = pctVal + '%';

  // Lista Recentes (tabela desktop + lista compacta mobile)
  const listaEl = document.getElementById('listaRecentes');
  const listaMobileEl = document.getElementById('listaRecentesMobile');
  const footerEl = document.getElementById('recentesFooter');
  if (listaEl || listaMobileEl) {
    const recentes = clientesCache.slice(0, 5);

    if (recentes.length === 0) {
      const msg = currentUser ? 'Nenhum cadastro ainda.' : 'Faça login para visualizar.';
      if (listaEl) listaEl.innerHTML = `<tr><td colspan="6" class="dash-empty-cell">${msg}</td></tr>`;
      if (listaMobileEl) listaMobileEl.innerHTML = `<div class="dash-empty">${msg}</div>`;
      if (footerEl) footerEl.textContent = '';
    } else {
      const cores = ['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];

      if (listaEl) {
        listaEl.innerHTML = recentes.map((c, i) => {
          const initials = getInitials(c.nome);
          const cor = cores[i % cores.length];
          const pillClass = c.status === 'Ativo' ? 'pill-green' : 'pill-amber';
          return `
            <tr>
              <td>
                <div class="recentes-cliente">
                  <div class="recente-avatar ${cor}">${escapeHtml(initials)}</div>
                  <div class="recentes-cliente-info">
                    <div class="recentes-nome">${escapeHtml(c.nome)}</div>
                    <div class="recente-cpf">${escapeHtml(c.cpf || '-')}</div>
                  </div>
                </div>
              </td>
              <td class="recentes-plano-cell">${escapeHtml(c.plano || '-')}</td>
              <td class="recentes-tel-cell">${escapeHtml(c.tel1 || '-')}</td>
              <td><span class="pill ${pillClass}">${escapeHtml(c.status || 'Pendente')}</span></td>
              <td class="recentes-data-cell">${escapeHtml(c.data || '-')}</td>
              <td>
                <div class="recentes-acoes">
                  <button class="btn-action btn-action-sm btn-action-whatsapp" type="button" title="Exportar para WhatsApp" onclick="exportarClienteWhatsApp('${c.id}')"><i class="ti ti-brand-whatsapp"></i></button>
                  <button class="btn-action btn-action-sm btn-action-edit" type="button" title="Editar cliente" onclick="editarCliente('${c.id}')"><i class="ti ti-edit"></i></button>
                </div>
              </td>
            </tr>`;
        }).join('');
      }

      if (listaMobileEl) {
        listaMobileEl.innerHTML = recentes.map((c, i) => {
          const initials = getInitials(c.nome);
          const cor = cores[i % cores.length];
          const pillClass = c.status === 'Ativo' ? 'pill-green' : 'pill-amber';
          return `
            <div class="recentes-mobile-item" onclick="editarCliente('${c.id}')">
              <div class="recente-avatar ${cor}">${escapeHtml(initials)}</div>
              <div class="recentes-mobile-info">
                <div class="recentes-mobile-nome">${escapeHtml(c.nome)}</div>
                <div class="recentes-mobile-plano">${escapeHtml(c.plano || '-')}</div>
              </div>
              <span class="pill ${pillClass}">${escapeHtml(c.status || 'Pendente')}</span>
            </div>`;
        }).join('');
      }

      if (footerEl) {
        footerEl.textContent = `Mostrando ${recentes.length} de ${clientesCache.length} cliente${clientesCache.length === 1 ? '' : 's'}`;
      }
    }
  }

  // Instalações Pendentes
  const instalacoesEl = document.getElementById('instalacoesPendentesList');
  if (instalacoesEl) {
    const pendentesList = clientesCache.filter(c => (c.status || 'Pendente') !== 'Ativo').slice(0, 4);
    if (pendentesList.length === 0) {
      instalacoesEl.innerHTML = `<div class="dash-empty">Nenhuma instalação pendente.</div>`;
    } else {
      instalacoesEl.innerHTML = pendentesList.map((c) => {
        const dt = getClienteDate(c);
        let urgCls = 'urg-baixa';
        if (dt) {
          const diasEspera = Math.floor((agora - dt) / 86400000);
          if (diasEspera >= 5) urgCls = 'urg-alta';
          else if (diasEspera >= 2) urgCls = 'urg-media';
        }
        return `
        <div class="instalacao-item" onclick="editarCliente('${c.id}')">
          <div class="instalacao-info">
            <div class="instalacao-nome">${escapeHtml(c.nome)}</div>
            <div class="instalacao-local"><i class="ti ti-map-pin"></i> ${escapeHtml(c.bairro || '-')}</div>
          </div>
          <span class="instalacao-data ${urgCls}">${escapeHtml(c.data || '-')}</span>
        </div>`;
      }).join('');
    }
  }

  // Top Planos Contratados (donut)
  const planosWrapEl = document.getElementById('planosDonutWrap');
  if (planosWrapEl) {
    const total = clientesCache.length;
    if (total === 0) {
      planosWrapEl.innerHTML = `<div class="dash-empty">Sem dados de planos ainda.</div>`;
    } else {
      const counts = {};
      clientesCache.forEach((c) => {
        const nome = splitPlano(c.plano).nome || 'Sem plano';
        counts[nome] = (counts[nome] || 0) + 1;
      });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const top = entries.slice(0, 4);
      const outrosCount = entries.slice(4).reduce((s, [, n]) => s + n, 0);
      if (outrosCount > 0) top.push(['Outros', outrosCount]);

      const cores = ['#E32A2A', '#2563eb', '#16a34a', '#f59e0b', '#9333ea'];
      const R = 40, C = 2 * Math.PI * R;
      let acc = 0;
      const segs = top.map(([, count], i) => {
        const dash = (count / total) * C;
        const seg = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${cores[i % cores.length]}" stroke-width="14" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-acc}" transform="rotate(-90 50 50)" />`;
        acc += dash;
        return seg;
      }).join('');
      const legend = top.map(([nome, count], i) => `
        <div class="planos-legend-item">
          <span class="planos-legend-dot" style="background:${cores[i % cores.length]}"></span>
          <span class="planos-legend-nome">${escapeHtml(nome)}</span>
          <span class="planos-legend-pct">${Math.round((count / total) * 100)}% (${count})</span>
        </div>`).join('');

      planosWrapEl.innerHTML = `
        <svg class="planos-donut-svg" width="110" height="110" viewBox="0 0 100 100">${segs}</svg>
        <div class="planos-legend">${legend}</div>`;
    }
  }

  // Faturamento (últimos 6 meses)
  const faturamentoEl = document.getElementById('faturamentoBars');
  if (faturamentoEl) {
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const hoje = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push({ y: d.getFullYear(), m: d.getMonth(), label: `${nomesMeses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
    }
    const totais = meses.map(({ y, m }) => clientesCache.reduce((soma, c) => {
      const dt = getClienteDate(c);
      if (dt && dt.getFullYear() === y && dt.getMonth() === m) {
        const digitos = String(c.valorInstalacao || '').replace(/\D/g, '');
        return soma + (digitos ? Number(digitos) / 100 : 0);
      }
      return soma;
    }, 0));
    const maxVal = Math.max(...totais, 1);
    faturamentoEl.innerHTML = meses.map(({ label }, i) => {
      const val = totais[i];
      const vazio = val <= 0;
      const altura = vazio ? 0 : Math.max(Math.round((val / maxVal) * 150), 4);
      const valFmt = `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      return `
        <div class="faturamento-bar-col">
          <span class="faturamento-bar-val">${valFmt}</span>
          <div class="faturamento-bar${vazio ? ' faturamento-bar-vazio' : ''}" style="height:${altura}px"></div>
          <span class="faturamento-bar-mes">${label}</span>
        </div>`;
    }).join('');
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
        return `
          <div class="timeline-item">
            <div class="timeline-dot ${t.cls}"><i class="ti ${t.icon}"></i></div>
            <div class="tl-body">
              <div class="tl-title">${t.title}</div>
              <div class="tl-name">${escapeHtml(c.nome)}</div>
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

// Adicione um ouvinte para redimensionamento, caso o usuário gire o celular
window.addEventListener('resize', renderClientes);

function renderClientes() {
  const tbody = document.getElementById('tbodyClientes');
  if (!tbody) return;

  // ... (código anterior de filtragem)

  // Use matchMedia para consistência com o CSS
  const isMobile = window.matchMedia("(max-width: 600px)").matches;

  if (isMobile) {
    // Verifique se a lista está sendo gerada
    console.log("Renderizando em modo mobile");
    tbody.innerHTML = lista.map((c) => `...`).join('');
  } else {
    // ... código de renderização da tabela (desktop)
  }
}
