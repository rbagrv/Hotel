// sunmi-tax-form.js

export function createSunmiTaxForm({ taxId, companyName, taxRate, apiUrl, enabled }) {
  const form = document.createElement("form");
  form.id = "sunmiTaxForm";
  form.className = "form-grid";
  form.onsubmit = (e) => e.preventDefault(); // Prevent default HTML form submission

  form.innerHTML = `
    <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label required">Sunmi Vergi Kassası Aktiv</label>
        <select class="form-select" name="enabled">
            <option value="true" ${enabled === true ? 'selected' : ''}>Aktiv</option>
            <option value="false" ${enabled !== true ? 'selected' : ''}>Deaktiv</option>
        </select>
        <small class="form-help" style="color:#64748b;">Sunmi ilə vergi əməliyyatları aktiv olacaq.</small>
    </div>
    <div class="form-group">
        <label class="form-label required">Vergi ID</label>
        <input type="text" class="form-input" name="taxId" value="${taxId || ''}" required>
    </div>
    <div class="form-group">
        <label class="form-label required">Şirkət Adı</label>
        <input type="text" class="form-input" name="companyName" value="${companyName || ''}" required>
    </div>
    <div class="form-group">
        <label class="form-label required">Vergi Faizi (%)</label>
        <input type="number" class="form-input" name="taxRate" min="0" step="0.01" value="${taxRate || ''}" required>
    </div>
    <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label required">API URL</label>
        <input type="url" class="form-input" name="apiUrl" id="sunmiApiUrl" value="${apiUrl || ''}" placeholder="Məs: http://localhost:8000/api/sunmi" required>
        <small class="form-help" style="color:#64748b;">Sunmi kassa serverinizin API ünvanı.</small>
    </div>
    <div class="form-group" style="grid-column:1/-1; text-align:center; margin-top:1.5rem;">
        <button type="button" class="btn btn-secondary" id="testSunmiConnectionBtn">
            <i class="fas fa-plug"></i> Qoşulmağı Test Et
        </button>
        <div id="testResult" style="margin-top:1em; font-size:0.9em;"></div>
    </div>
  `;

  // Attach event listener for the test button
  const testButton = form.querySelector('#testSunmiConnectionBtn');
  const testResultDiv = form.querySelector('#testResult');

  testButton.addEventListener('click', async () => {
    const currentApiUrl = form.querySelector('#sunmiApiUrl').value;
    if (!currentApiUrl) {
      testResultDiv.innerHTML = `<span style="color:#ef4444;">API URL boşdur.</span>`;
      return;
    }
    testResultDiv.innerHTML = `<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i> Test edilir...</span>`;
    testButton.disabled = true;

    try {
      // Send a dummy request to the configured API URL
      const response = await fetch(`${currentApiUrl}/status`, {
        method: 'GET', // Or HEAD, or a small POST request for connection test
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        testResultDiv.innerHTML = `<span style="color:#10b981;"><i class="fas fa-check-circle"></i> Qoşulma uğurlu!</span>`;
      } else {
        const errorText = await response.text();
        testResultDiv.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-times-circle"></i> Qoşulma uğursuz: ${response.status} ${response.statusText} (${errorText.substring(0, 50)}...)</span>`;
      }
    } catch (error) {
      console.error("Sunmi test connection error:", error);
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

