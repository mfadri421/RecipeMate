// ProtocolConverter.js — unified converter UI with localStorage, Excel export, upload integration, and step timer setup

function convertProtocolTextToTemplate(text, title) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let steps = [];

  lines.forEach((line, i) => {
    if (/^(\d+\.|\*|-)/.test(line)) {
      const stepText = line.replace(/^(\d+\.|\*|-)/, '').trim();

      // Enhanced time parsing: supports hours, minutes, seconds
      const timeMatch = stepText.match(/(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/i);
      let seconds = '';
      if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        if (/h/.test(unit)) {
          seconds = value * 3600;
        } else if (/m/.test(unit)) {
          seconds = value * 60;
        } else if (/s/.test(unit)) {
          seconds = value;
        }
      }

      const tempMatch = stepText.match(/(\d+)\s*\u00b0?C/i);

      steps.push({
        step: stepText,
        time: seconds,
        temp: tempMatch ? parseInt(tempMatch[1]) : ''
      });
    }
  });

  return {
    title: title || 'Converted Protocol',
    steps
  };
}

function exportProtocolToExcel(protocol) {
  const data = protocol.steps.map(step => ({
    'Protocol Title': protocol.title,
    'Protocol Steps': step.step,
    'Timing of Each Step': step.time,
    'Temperature of Each Step': step.temp
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Protocol");
  XLSX.writeFile(workbook, `${protocol.title.replace(/\s+/g, '_')}.xlsx`);
}

function saveProtocolsToLocalStorage() {
  localStorage.setItem("RecipeMateProtocols", JSON.stringify(uploadedProtocols));
}

function loadProtocolsFromLocalStorage() {
  const stored = localStorage.getItem("RecipeMateProtocols");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      for (const key in parsed) {
        if (!uploadedProtocols[key]) {
          uploadedProtocols[key] = parsed[key];
          const option = document.createElement("option");
          option.value = key;
          option.textContent = parsed[key].title;
          document.getElementById("protocol-select").appendChild(option);
        }
      }
    } catch (e) {
      console.error("Failed to load saved protocols:", e);
    }
  }
}

function embedProtocolConversionUI() {
  const existing = document.getElementById('protocol-converter');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'protocol-converter';
  container.style.marginTop = '2em';
  container.innerHTML = `
    <hr/>
    <h3>Convert Text Protocol to RecipeMate Format</h3>
    <label><strong>Protocol Title:</strong></label><br/>
    <input id="protocolTitle" type="text" placeholder="e.g., My Protocol" style="width:100%; margin-bottom:0.5em;"><br/>
    <textarea id="protocolInput" rows="6" style="width:100%;" placeholder="Paste your protocol here..."></textarea><br/>
    <button id="convertToProtocol">Convert & Use</button>
    <button id="downloadExcel">Download Excel</button>
    <pre id="outputJson" style="background:#f4f4f4; padding:1em; white-space:pre-wrap; margin-top:1em;"></pre>
  `;
  document.body.appendChild(container);

  let lastConvertedProtocol = null;

  document.getElementById('convertToProtocol').addEventListener('click', () => {
    const rawText = document.getElementById('protocolInput').value;
    const title = document.getElementById('protocolTitle').value || 'Converted Protocol';
    const protocol = convertProtocolTextToTemplate(rawText, title);
    const id = title.toLowerCase().replace(/\s+/g, '_') + '_converted.json';
    uploadedProtocols[id] = protocol;
    saveProtocolsToLocalStorage();

    const protocolSelect = document.getElementById('protocol-select');
    if (!Array.from(protocolSelect.options).some(opt => opt.value === id)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = protocol.title;
      protocolSelect.appendChild(option);
    }
    protocolSelect.value = id;

    currentStep = 0;
    stepStartTimes = [];
    showStep();
    nextStepBtn.disabled = false;

    document.getElementById('outputJson').textContent = JSON.stringify(protocol, null, 2);
    lastConvertedProtocol = protocol;
  });

  document.getElementById('downloadExcel').addEventListener('click', () => {
    if (lastConvertedProtocol) {
      exportProtocolToExcel(lastConvertedProtocol);
    } else {
      alert("Please convert a protocol first.");
    }
  });
}

window.addEventListener('load', () => {
  embedProtocolConversionUI();
  loadProtocolsFromLocalStorage();
});
