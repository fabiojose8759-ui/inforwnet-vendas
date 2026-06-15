// =============================================
// INFORWNET VENDAS - Firebase Auth + Firestore
// =============================================

// 1) Crie um projeto no Firebase.
// 2) Ative Authentication > Email/Senha.
// 3) Crie o Firestore.
// 4) Substitua os valores abaixo pelos dados do seu app Web Firebase.
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
let clientesCache = [];
let usuariosCache = [];

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

applyTheme('light');

// ── AUTENTICAÇÃO ──
function setAuthMode(mode) {
  const isLogin = mode === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  loginForm.classList.toggle('active', isLogin);
  registerForm.classList.toggle('active', !isLogin);
  const successEl = document.getElementById('registerSuccess');
  if (successEl) successEl.classList.remove('show');
}

tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));

btnLogin.addEventListener('click', async () => {
  if (!ensureFirebaseReady()) return;
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  if (!email || !senha) return showToast('Informe email e senha.', 'ti-alert-circle', true);

  btnLogin.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(email, senha);
  } catch (error) {
    showToast(getAuthErrorMessage(error), 'ti-alert-circle', true);
    btnLogin.disabled = false;
  }
});

btnRegister.addEventListener('click', async () => {
  if (!ensureFirebaseReady()) return;
  const nome = document.getElementById('registerNome').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const senha = document.getElementById('registerSenha').value;

  if (nome.length < 3) return showToast('Informe o nome completo.', 'ti-alert-circle', true);
  if (!isValidEmail(email)) return showToast('Informe um email válido.', 'ti-alert-circle', true);
  if (senha.length < 6) return showToast('A senha deve ter pelo menos 6 caracteres.', 'ti-alert-circle', true);

  btnRegister.disabled = true;
  try {
    const credential = await auth.createUserWithEmailAndPassword(email, senha);
    await credential.user.updateProfile({ displayName: nome });
    // Salva o perfil ANTES do onAuthStateChanged processar o login automático
    await db.collection('users').doc(credential.user.uid).set({
      nome,
      email,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await auth.signOut();
    document.getElementById('registerNome').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerSenha').value = '';
    document.getElementById('registerSuccess').classList.add('show');
  } catch (error) {
    showToast(getAuthErrorMessage(error), 'ti-alert-circle', true);
  } finally {
    btnRegister.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  if (!auth) return;
  await auth.signOut();
});

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

    currentUser = user;
    currentProfile = null;
    clientesCache = [];
    usuariosCache = [];

    // Reabilita botões caso estejam desativados
    if (btnLogin) btnLogin.disabled = false;
    if (btnRegister) btnRegister.disabled = false;

    if (!user) {
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
    listenClientes();
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

  document.querySelectorAll('.avatar').forEach((avatar) => {
    avatar.textContent = initials;
  });
  document.querySelectorAll('.sidebar-user .name, .topbar-user .uname').forEach((el) => {
    el.textContent = nome;
  });
  document.querySelectorAll('.sidebar-user .role').forEach((el) => {
    el.textContent = roleLabel;
  });

  setText('perfilNome', nome);
  setText('perfilEmail', user.email);
  setText('perfilRole', roleLabel);
}

function ensureFirebaseReady(showMessage = true) {
  const ready = isFirebaseConfigured && window.firebase && auth && db;
  if (!ready && showMessage) {
    showToast('Configure o Firebase no app.js antes de usar login.', 'ti-alert-circle', true);
  }
  return ready;
}

function getAuthErrorMessage(error) {
  const code = error && error.code ? error.code : '';
  const messages = {
    'auth/email-already-in-use': 'Este email já está cadastrado.',
    'auth/invalid-email': 'Email inválido.',
    'auth/invalid-login-credentials': 'Email ou senha inválidos.',
    'auth/invalid-credential': 'Email ou senha inválidos.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
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

  navItems.forEach(n => {
    if (n.dataset.page === pageId) n.classList.add('active');
  });

  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

navItems.forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// ── CHAR COUNT TEXTAREA ──
if (obs && charCount) {
  obs.addEventListener('input', () => {
    charCount.textContent = obs.value.length + '/500';
    if (obs.value.length > 500) obs.value = obs.value.slice(0, 500);
  });
}

// ── MÁSCARAS E VALIDAÇÕES DO CADASTRO ──
const onlyDigits = (value) => value.replace(/\D/g, '');

function maskCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
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

  cpf.addEventListener('input', () => {
    cpf.value = maskCpf(cpf.value);
  });

  rg.addEventListener('input', () => {
    rg.value = onlyDigits(rg.value).slice(0, 9);
  });

  email.addEventListener('input', () => {
    email.value = email.value.replace(/\s/g, '').slice(0, 120).toLowerCase();
  });

  endereco.addEventListener('input', () => {
    endereco.value = endereco.value.replace(/\s{2,}/g, ' ').slice(0, 120);
  });

  [tel1, tel2].forEach((field) => {
    field.addEventListener('input', () => {
      field.value = maskPhone(field.value);
    });
  });

  valorInstalacao.addEventListener('input', () => {
    valorInstalacao.value = maskMoney(valorInstalacao.value);
  });
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

// ── SELETOR DE PLANOS RESPONSIVO ──
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
    if (item.tagName === 'OPTION' && item.value) {
      addPlanOption(item.textContent, item.value);
      return;
    }

    if (item.tagName === 'OPTGROUP') {
      const group = document.createElement('div');
      group.className = 'plan-group';
      group.textContent = item.label;
      planMenu.appendChild(group);

      Array.from(item.children).forEach((option) => {
        addPlanOption(option.textContent, option.value);
      });
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

  document.addEventListener('click', (event) => {
    if (!planPicker.contains(event.target)) closePlanPicker();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePlanPicker();
  });

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

// ── FIRESTORE: CLIENTES/VENDAS ──
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
      <td data-label="Nome">${escapeHtml(c.nome)}</td>
      <td data-label="CPF">${escapeHtml(c.cpf)}</td>
      <td data-label="Plano">${escapeHtml(c.plano)}</td>
      <td data-label="Telefone">${escapeHtml(c.tel1)}</td>
      <td data-label="Data">${escapeHtml(c.data)}</td>
      <td data-label="Status">
        <span class="pill ${c.status === 'Ativo' ? 'pill-green' : 'pill-amber'}">${escapeHtml(c.status)}</span>
      </td>
      <td data-label="Ações" class="table-actions">
        <button class="btn btn-outline btn-icon-sm" type="button" title="Ativar/Pendente" onclick="ativarCliente('${c.id}')">
          <i class="ti ti-check"></i>
        </button>
        <button class="btn btn-danger-outline btn-icon-sm" type="button" title="Remover cliente" onclick="removerCliente('${c.id}')">
          <i class="ti ti-trash"></i>
        </button>
        <button class="btn btn-whatsapp btn-icon-sm" type="button" title="Exportar para WhatsApp" onclick="exportarClienteWhatsApp('${c.id}')">
          <i class="ti ti-brand-whatsapp"></i>
        </button>
        <button class="btn btn-outline btn-icon-sm" type="button" title="Copiar texto completo" onclick="copiarClienteTexto('${c.id}')">
          <i class="ti ti-copy"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function formatClienteText(cliente) {
  const field = (label, value) => `${label}: ${value || '-'}`;

  return [
    '*Cadastro de Cliente - Inforwnet*',
    '',
    field('Nome', cliente.nome),
    field('CPF', cliente.cpf),
    field('RG', cliente.rg),
    field('Email', cliente.email),
    field('Endereço', cliente.endereco),
    field('Plano', cliente.plano),
    field('Vencimento', cliente.vencimento ? `Dia ${cliente.vencimento}` : ''),
    field('Telefone 01', cliente.tel1),
    field('Telefone 02', cliente.tel2),
    field('Forma de pagamento', cliente.pgto),
    field('Valor da instalação', cliente.valorInstalacao),
    field('Parcelamento', cliente.parcelas),
    field('Observações', cliente.obs),
    field('Data do cadastro', cliente.data),
    field('Status', cliente.status),
    field('Vendedor', cliente.userNome)
  ].join('\n');
}

function normalizePhoneWhatsapp(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

window.exportarClienteWhatsApp = function(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente) return;

  const text = formatClienteText(cliente);
  
  // URL sem o telefone para abrir a lista de contatos do WhatsApp
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank', 'noopener,noreferrer');
};

window.copiarClienteTexto = async function(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente) return;

  const text = formatClienteText(cliente);

  try {
    await navigator.clipboard.writeText(text);
    showToast('Texto copiado!', 'ti-copy');
    return;
  } catch (error) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    showToast(
      copied ? 'Texto copiado!' : 'Não foi possível copiar o texto.',
      copied ? 'ti-copy' : 'ti-alert-circle',
      !copied
    );
  }
};

window.ativarCliente = async function(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente || !canAccessOwner(cliente.userId)) return showToast('Sem permissão para alterar este cliente.', 'ti-alert-circle', true);

  try {
    await db.collection('clientes').doc(id).update({
      status: cliente.status === 'Ativo' ? 'Pendente' : 'Ativo',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Status atualizado!', 'ti-check');
  } catch (error) {
    showToast('Erro ao atualizar status.', 'ti-alert-circle', true);
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

// ── FIRESTORE: USUÁRIOS ──
function listenUsuarios() {
  if (!isAdmin()) return;
  unsubscribeUsuarios = db.collection('users').onSnapshot((snapshot) => {
    usuariosCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    usuariosCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    renderUsuarios();
  }, () => {
    showToast('Erro ao carregar usuários.', 'ti-alert-circle', true);
  });
}

function renderUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;

  if (!isAdmin()) {
    tbody.innerHTML = emptyRow(4, 'Acesso permitido somente para ADMIN.');
    return;
  }

  if (usuariosCache.length === 0) {
    tbody.innerHTML = emptyRow(4, 'Nenhum usuário carregado.');
    return;
  }

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
    await db.collection('users').doc(uid).update({
      role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Permissão atualizada.', 'ti-check');
  } catch (error) {
    showToast('Erro ao atualizar permissão.', 'ti-alert-circle', true);
  }
};

// ── DASHBOARD ──
function atualizarDash() {
  const total = clientesCache.length;
  const ativos = clientesCache.filter(c => c.status === 'Ativo').length;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const hojeCount = clientesCache.filter(c => c.data === hoje).length;

  setText('dash-total', total);
  setText('dash-ativos', ativos);
  setText('dash-hoje', hojeCount);

  const tbody = document.getElementById('tbodyRecentes');
  if (!tbody) return;

  const recentes = clientesCache.slice(0, 5);
  if (recentes.length === 0) {
    tbody.innerHTML = emptyRow(5, currentUser ? 'Nenhum cadastro ainda.' : 'Faça login para visualizar cadastros.');
    return;
  }

  tbody.innerHTML = recentes.map(c => `
    <tr>
      <td data-label="Nome">${escapeHtml(c.nome)}</td>
      <td data-label="CPF">${escapeHtml(c.cpf)}</td>
      <td data-label="Plano">${escapeHtml(c.plano)}</td>
      <td data-label="Data">${escapeHtml(c.data)}</td>
      <td data-label="Status"><span class="pill ${c.status === 'Ativo' ? 'pill-green' : 'pill-amber'}">${escapeHtml(c.status)}</span></td>
    </tr>
  `).join('');
}

// ── HELPERS ──
function isAdmin() {
  return currentProfile && currentProfile.role === 'admin';
}

function canAccessOwner(ownerUid) {
  return isAdmin() || (currentUser && ownerUid === currentUser.uid);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getInitials(name) {
  return String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
