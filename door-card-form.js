// door-card-form.js
//
// SuperAdmin configuration form for the universal door-card system.
// Provider selection + connection parameters + a live connection test.

const DOOR_CARD_FIELDS = {
  apiUrl: {
    label: 'API URL',
    type: 'url',
    required: true,
    placeholder: 'Məs: http://localhost:8001/api/lock'
  },
  apiKey: {
    label: 'API Açarı (Token)',
    type: 'password',
    required: false,
    placeholder: 'İstəyə bağlı Bearer token'
  },
  issuePath: { label: 'Kart Açma Endpoint', type: 'text', required: false, placeholder: '/issue' },
  lockPath: { label: 'Kart Bağlama Endpoint', type: 'text', required: false, placeholder: '/lock' },
  requestMethod: { label: 'Sorğu Metodu', type: 'select', options: ['POST', 'GET', 'PUT'], required: false },
  doorId: { label: 'Qapı ID (Bütün otaqlar üçün sabit)', type: 'text', required: false, placeholder: 'İstəyə bağlı' }
};

export function createDoorCardForm({ settings = {} }) {
  const form = document.createElement('form');
  form.id = 'doorCardForm';
  form.onsubmit = (e) => e.preventDefault();

  const providers = [
    { value: 'hune', label: 'Hune Ağıllı Kilid' },
    { value: 'generic', label: 'Universal (REST)' }
  ];

  const providerId = settings.provider || 'hune';

  const enabledOptions = (val) =>
    `<option value="true" ${val === true ? 'selected' : ''}>Aktiv</option>` +
    `<option value="false" ${val !== true ? 'selected' : ''}>Deaktiv</option>`;

  const providerOptions = providers
    .map(p => `<option value="${p.value}" ${providerId === p.value ? 'selected' : ''}>${p.label}</option>`)
    .join('');

  // Render every field (generic shows all; other providers show a reduced set).
  const fieldBlocks = Object.entries(DOOR_CARD_FIELDS).map(([name, f]) => {
    let input;
    if (f.type === 'select') {
      const opts = f.options.map(o => `<option ${(settings[name] || f.required && f.options[0]) === o ? 'selected' : ''}>${o}</option>`).join('');
      input = `<select class="form-select" name="${name}">${opts}</select>`;
    } else {
      input = `<input type="${f.type}" class="form-input" name="${name}" value="${settings[name] || ''}" placeholder="${f.placeholder || ''}">`;
    }
    return `
      <div class="form-group" data-field="${name}" ${name === 'apiUrl' ? '' : `style="display:none;"`}>
        <label class="form-label ${f.required ? 'required' : ''}">${f.label}</label>
        ${input}
      </div>`;
  }).join('');

  form.innerHTML = `
    <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label required">Qapı Kartı Sistemi Aktiv</label>
        <select class="form-select" name="enabled">${enabledOptions(settings.enabled)}</select>
        <small class="form-help" style="color:#64748b;">Aktiv olduqda rezervasiyaya əsasən otaq kartları vaxt üzrə proqramlaşdırılır.</small>
    </div>
    <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label required">Qurğu Tipi</label>
        <select class="form-select" name="provider" id="doorCardProvider">${providerOptions}</select>
        <small class="form-help" style="color:#64748b;" id="doorCardProviderHint"></small>
    </div>
    ${fieldBlocks}
    <div class="form-group" style="grid-column:1/-1; text-align:center; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" id="testDoorCardConnectionBtn">
            <i class="fas fa-plug"></i> Qoşulmağı Test Et
        </button>
        <div id="testDoorCardResult" style="margin-top:1em; font-size:0.9em;"></div>
    </div>
  `;

  const fieldDefs = {
    hune: ['apiUrl'],
    generic: ['apiUrl', 'apiKey', 'issuePath', 'lockPath', 'requestMethod', 'doorId']
  };
  const hintText = {
    hune: 'Hune kilid serverinizin API ünvanı.',
    generic: 'İstənilən REST API üçün endpointləri və tokeni özünüz konfiqurasiya edin.'
  };

  const providerSelect = form.querySelector('#doorCardProvider');
  const hintEl = form.querySelector('#doorCardProviderHint');

  const applyProviderVisibility = () => {
    const active = providerSelect.value;
    form.querySelectorAll('[data-field]').forEach(group => {
      const name = group.getAttribute('data-field');
      group.style.display = fieldDefs[active].includes(name) ? '' : 'none';
    });
    hintEl.textContent = hintText[active] || '';
  };
  providerSelect.addEventListener('change', applyProviderVisibility);
  applyProviderVisibility();

  // Test connection
  const testButton = form.querySelector('#testDoorCardConnectionBtn');
  const testResultDiv = form.querySelector('#testDoorCardResult');
  testButton.addEventListener('click', async () => {
    const formData = new FormData(form);
    const draft = Object.fromEntries(formData);
    draft.enabled = draft.enabled === 'true';
    window.app?.saveSetting('doorCardSettings', draft); // persist the draft so the test uses it

    testResultDiv.innerHTML = `<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i> Test edilir...</span>`;
    testButton.disabled = true;
    const result = await window.doorCardSystem.testConnection();
    testButton.disabled = false;
    testResultDiv.innerHTML = result.ok
      ? `<span style="color:#10b981;"><i class="fas fa-check-circle"></i> Qoşulma uğurlu!</span>`
      : `<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> Qoşulma uğursuz: ${result.error || 'Bilinməyən xəta'}</span>`;
  });

  return form;
}
