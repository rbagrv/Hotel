// hune-door-lock-form.js

export function createHuneDoorLockForm({ apiUrl, enabled }) {
  const form = document.createElement("form");
  form.id = "huneDoorLockForm";
  form.onsubmit = (e) => e.preventDefault();

  form.innerHTML = `
    <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label required">Hune Qapı Kilidi Aktiv</label>
        <select class="form-select" name="enabled">
            <option value="true" ${enabled === true ? 'selected' : ''}>Aktiv</option>
            <option value="false" ${enabled !== true ? 'selected' : ''}>Deaktiv</option>
        </select>
        <small class="form-help" style="color:#64748b;">Hune ağıllı kilid sistemi ilə inteqrasiya aktiv olacaq.</small>
    </div>
    <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label required">API URL</label>
        <input type="url" class="form-input" name="apiUrl" id="huneApiUrl" value="${apiUrl || ''}" required placeholder="Məs: http://localhost:8001/api/hune">
        <small class="form-help" style="color:#64748b;">Hune kilid serverinizin API ünvanı.</small>
    </div>
    <div class="form-group" style="grid-column:1/-1; text-align:center; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" id="testHuneConnectionBtn">
            <i class="fas fa-plug"></i> Qoşulmağı Test Et
        </button>
        <div id="testHuneResult" style="margin-top:1em; font-size:0.9em;"></div>
    </div>
  `;

  // Attach event listener for the test button
  const testButton = form.querySelector('#testHuneConnectionBtn');
  const testResultDiv = form.querySelector('#testHuneResult');

  testButton.addEventListener('click', async () => {
    const currentApiUrl = form.querySelector('#huneApiUrl').value;
    if (!currentApiUrl) {
      testResultDiv.innerHTML = `<span style="color:#ef4444;">API URL boşdur.</span>`;
      return;
    }
    testResultDiv.innerHTML = `<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i> Test edilir...</span>`;
    testButton.disabled = true;

    try {
      const response = await fetch(`${currentApiUrl}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        testResultDiv.innerHTML = `<span style="color:#10b981;"><i class="fas fa-check-circle"></i> Qoşulma uğurlu!</span>`;
      } else {
        const errorText = await response.text();
        testResultDiv.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> Qoşulma uğursuz: ${response.status} ${response.statusText} (${errorText.substring(0, 50)}...)</span>`;
      }
    } catch (error) {
      console.error("Hune test connection error:", error);
      let errorMessage = "Qoşulma xətası";
      if (error.name === 'AbortError') {
          errorMessage = "Qoşulma müddəti bitdi (5 saniyə). Server cavab vermədi.";
      } else if (error.message.includes('Failed to fetch')) {
          errorMessage = "Şəbəkə xətası və ya serverə çatmaq mümkün olmadı.";
      } else {
          errorMessage = error.message;
      }
      testResultDiv.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> Xəta: ${errorMessage}</span>`;
    } finally {
      testButton.disabled = false;
    }
  });


  return form;
}

