let protocol = null;
let currentStep = 0;
let stepStartTimes = [];
let uploadedProtocols = {};

const protocolSelect = document.getElementById('protocol-select');
const protocolContainer = document.getElementById('protocol-container');
const stepDetails = document.getElementById('step-details');
const nextStepBtn = document.getElementById('next-step');
const backStepBtn = document.getElementById('back-step');
const journal = document.getElementById('journal');
const progressBar = document.getElementById('progress-bar');
const exportExcelBtn = document.getElementById('export-excel');
const uploadFile = document.getElementById('upload-file');
const uploadButton = document.getElementById('upload-protocol');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');
const timerDisplay = document.getElementById('timer-display');
const increaseFontBtn = document.getElementById('increase-font');
const decreaseFontBtn = document.getElementById('decrease-font');
const toggleAudio = document.getElementById('toggle-audio');
const toggleFlash = document.getElementById('toggle-flash');

let timerInterval;
let secondsRemaining = 0;
let countdownActive = false;
let alertInterval;

const beep = new Audio('sounds/mixkit-achievement-bell-600.wav');
const oneMinuteBeep = new Audio('sounds/mixkit-cooking-bell-ding-1791.wav');

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function flashScreen() {
  if (!toggleFlash || !toggleFlash.checked) return;
  document.body.style.transition = 'background 0.2s';
  document.body.style.background = '#ffcccc';
  setTimeout(() => {
    document.body.style.background = '';
  }, 200);
}

function startPersistentAlarm() {
  if (alertInterval) clearInterval(alertInterval);
  alertInterval = setInterval(() => {
    beep.play();
    speak("Time's up");
    flashScreen();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }, 5000);
}

function stopPersistentAlarm() {
  if (alertInterval) clearInterval(alertInterval);
  alertInterval = null;
}

// Clear all notes from localStorage for the current protocol
function clearAllNotes() {
  if (protocol && protocol.steps) {
    for (let i = 0; i < protocol.steps.length; i++) {
      localStorage.removeItem(`note_${i}`);
    }
  }
  journal.value = "";
}

// Enhanced parsing for time, temperature (always in C), and volume (μL)
function parseTimeAndTemp(stepObj) {
  const stepText = stepObj.step || "";
  let seconds = '';

  const rawTime = stepObj.time || stepObj.duration || "";
  if (typeof rawTime === 'string') {
    const match = rawTime.match(/(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (/h/.test(unit)) seconds = value * 3600;
      else if (/m/.test(unit)) seconds = value * 60;
      else if (/s/.test(unit)) seconds = value;
    }
  } else if (typeof rawTime === 'number') {
    seconds = rawTime;
  }

  // Temperature: supports °C, C, °F, F and always converts/displays as °C
  let tempC = '';
  const tempMatch = stepText.match(/(\d+)\s*°?\s*([CFcf])/);
  if (tempMatch) {
    let value = parseInt(tempMatch[1]);
    let unit = tempMatch[2].toUpperCase();
    if (unit === 'F') {
      value = Math.round((value - 32) * 5 / 9);
    }
    tempC = value;
  } else if (stepObj.temp) {
    const directTempMatch = ('' + stepObj.temp).match(/^(\d+)\s*°?\s*([CFcf])?$/);
    if (directTempMatch) {
      let value = parseInt(directTempMatch[1]);
      let unit = directTempMatch[2] ? directTempMatch[2].toUpperCase() : 'C';
      if (unit === 'F') {
        value = Math.round((value - 32) * 5 / 9);
      }
      tempC = value;
    } else {
      tempC = stepObj.temp;
    }
  }

  // Microliter: μL, uL
  let volume = '';
  let volumeUnit = '';
  const volMatch = stepText.match(/(\d+(?:\.\d+)?)\s*(μL|uL)/i);
  if (volMatch) {
    volume = volMatch[1];
    volumeUnit = 'μL';
  }

  return {
    ...stepObj,
    time: seconds || '',
    originalDuration: seconds || '',
    temp: tempC,
    volume: volume,
    volumeUnit: volumeUnit
  };
}

function loadProtocol(file) {
  fetch(`protocols/${file}`)
    .then(res => res.json())
    .then(data => {
      data.steps = data.steps.map(parseTimeAndTemp);
      protocol = data;
      currentStep = 0;
      stepStartTimes = [];
      clearAllNotes();
      showStep();
      nextStepBtn.disabled = false;
    })
    .catch(err => {
      stepDetails.innerHTML = `<p style='color:red;'>Failed to load protocol: ${err.message}</p>`;
    });
}

function showStep() {
  stopPersistentAlarm();
  clearInterval(timerInterval);
  timerInterval = null;

  const step = protocol.steps[currentStep];
  const note = localStorage.getItem(`note_${currentStep}`) || "";
  journal.value = note;

  stepDetails.innerHTML = `<h3>Step ${currentStep + 1}</h3>
    <p>${step.step}</p>
    <p>
      <strong>Countdown From:</strong> ${step.originalDuration || step.time || 'n/a'} sec
      | <strong>Temp:</strong> ${step.temp !== '' ? step.temp + '&deg;C' : 'n/a'}
      ${step.volume ? `| <strong>Volume:</strong> ${step.volume} μL` : ''}
    </p>`;

  const progress = ((currentStep + 1) / protocol.steps.length) * 100;
  progressBar.style.width = `${progress}%`;
  progressBar.innerText = `${currentStep + 1} / ${protocol.steps.length}`;

  stepStartTimes[currentStep] = new Date();

  if (toggleAudio && toggleAudio.checked) speak(`Step ${currentStep + 1}. ${step.step}`);

  // Always set timer to protocol's original step time
  secondsRemaining = parseInt(step.originalDuration || step.time || 0);
  if (isNaN(secondsRemaining)) secondsRemaining = 0;
  timerDisplay.innerText = formatTime(secondsRemaining);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function startTimer() {
  countdownActive = true;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!countdownActive) return;

    if (secondsRemaining > 0) {
      secondsRemaining--;
      timerDisplay.innerText = formatTime(secondsRemaining);

      if (secondsRemaining === 60) {
        oneMinuteBeep.play();
        speak("One minute remaining");
      }

      if (secondsRemaining === 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.innerText = formatTime(0);
        startPersistentAlarm();
      }
    }
  }, 1000);
}

function pauseTimer() {
  countdownActive = false;
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  stopPersistentAlarm();
  showStep(); // Always resets timer to protocol's original step time
}

function saveNote() {
  localStorage.setItem(`note_${currentStep}`, journal.value);
}

function nextStep() {
  saveNote();
  stopPersistentAlarm();
  clearInterval(timerInterval);
  timerInterval = null;

  const now = new Date();
  if (protocol && protocol.steps[currentStep]) {
    protocol.steps[currentStep].startedAt = stepStartTimes[currentStep];
    protocol.steps[currentStep].completedAt = now;
    protocol.steps[currentStep].actualDuration = (now - stepStartTimes[currentStep]) / 1000;
  }

  currentStep++;

  if (protocol && currentStep < protocol.steps.length) {
    showStep();
    nextStepBtn.disabled = false;
  } else {
    stepDetails.innerHTML = '<p><strong>Protocol complete!</strong></p>';
    progressBar.style.width = '100%';
    progressBar.innerText = `${protocol.steps.length} / ${protocol.steps.length}`;
    nextStepBtn.disabled = true;
    speak('Protocol complete.');
    clearAllNotes(); // Clear notes on protocol complete
  }
}

function previousStep() {
  saveNote();
  stopPersistentAlarm();
  clearInterval(timerInterval);
  timerInterval = null;

  if (currentStep > 0) {
    currentStep--;
    showStep();
    nextStepBtn.disabled = false;
  }
}

function exportToExcel() {
  const rows = [
    ["Step", "Description", "Time (s)", "Temp (°C)", "Volume (μL)", "Started", "Ended", "Elapsed (s)", "User Notes"]
  ];

  const formatTimestamp = (dateObj) => {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
           `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  protocol.steps.forEach((step, i) => {
    rows.push([
      i + 1,
      step.step,
      step.originalDuration || step.time || '',
      step.temp || '',
      step.volume ? `${step.volume} μL` : '',
      formatTimestamp(step.startedAt),
      formatTimestamp(step.completedAt),
      step.actualDuration ? step.actualDuration.toFixed(1) : '',
      localStorage.getItem(`note_${i}`) || ''
    ]);
  });

  rows.push(["", "", "", "", "", "", "", "", ""]);
  rows.push(["Operator Signature:", "", "", "", "", "Verified By:", "", "", ""]);
  rows.push(["Date:", "", "", "", "", "Date:", "", "", ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws['!ref']);
  range.e.r = rows.length - 1;
  ws['!ref'] = XLSX.utils.encode_range(range);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Batch Record");
  XLSX.writeFile(wb, `${protocol.title.replace(/\s+/g, '_')}_BatchRecord.xlsx`);
}

function handleUpload() {
  const file = uploadFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const newProtocol = {
      title: rows[0]['Protocol Title'] || "Uploaded Protocol",
      steps: rows.map(row => parseTimeAndTemp({
        step: row['Protocol Steps'],
        time: row['Timing of Each Step'],
        temp: row['Temperature of Each Step']
      }))
    };
    const id = newProtocol.title.toLowerCase().replace(/\s+/g, '_') + ".json";
    uploadedProtocols[id] = newProtocol;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = newProtocol.title;
    protocolSelect.appendChild(option);
    protocolSelect.value = id;
    protocol = newProtocol;
    currentStep = 0;
    stepStartTimes = [];
    secondsRemaining = parseInt(newProtocol.steps[0].originalDuration || newProtocol.steps[0].time || 0);
    if (isNaN(secondsRemaining)) secondsRemaining = 0;
    countdownActive = secondsRemaining > 0;
    clearAllNotes();
    showStep();
    nextStepBtn.disabled = false;
  };
  reader.readAsArrayBuffer(file);
}

function adjustFontSize(change) {
  const currentSize = window.getComputedStyle(stepDetails, null).getPropertyValue('font-size');
  const newSize = Math.max(10, parseInt(currentSize) + change);
  stepDetails.style.fontSize = `${newSize}px`;
}

increaseFontBtn.addEventListener('click', () => adjustFontSize(2));
decreaseFontBtn.addEventListener('click', () => adjustFontSize(-2));

protocolSelect.addEventListener('change', () => {
  clearAllNotes();
  const val = protocolSelect.value;
  if (uploadedProtocols[val]) {
    protocol = uploadedProtocols[val];
    currentStep = 0;
    stepStartTimes = [];
    showStep();
    nextStepBtn.disabled = false;
  } else {
    loadProtocol(val);
  }
});

nextStepBtn.addEventListener('click', nextStep);
backStepBtn.addEventListener('click', previousStep);
journal.addEventListener('input', saveNote);
exportExcelBtn.addEventListener('click', exportToExcel);
startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);
uploadButton.addEventListener('click', handleUpload);

setTimeout(() => {
  // Any delayed initialization if needed
}, 100);
