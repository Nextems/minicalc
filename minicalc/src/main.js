/* MiniCalc — calculator logic */

const MAX_DIGITS = 12;

const MAX_HISTORY = 50;
const HISTORY_KEY = 'minicalc.history';

const ui = {
  expression: document.getElementById('expression'),
  result: document.getElementById('result'),
  keypad: document.querySelector('.keypad'),
  history: document.getElementById('history'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  historyToggle: document.getElementById('history-toggle'),
  clearHistory: document.getElementById('clear-history')
};

const state = {
  current: '0',     // number being typed, as a raw string
  stored: null,     // left-hand operand
  operator: null,   // '+', '−', '×', '÷'
  overwrite: true,  // next digit replaces the display
  error: false
};

/* ---------- arithmetic ---------- */

function operate(operator, a, b) {
  switch (operator) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? null : a / b;
    default: return b;
  }
}

/* ---------- formatting ---------- */

function toNumberString(value) {
  if (!isFinite(value)) return null;

  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return value.toExponential(6).replace(/\.?0+e/, 'e');
  }
  // Trim binary floating point noise (0.1 + 0.2 -> 0.3)
  return String(Number(value.toPrecision(12)));
}

function groupDigits(raw) {
  if (raw.includes('e')) return raw;

  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const [intPart, decimalPart] = body.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');

  return (negative ? '-' : '') +
         grouped +
         (decimalPart !== undefined ? '.' + decimalPart : '');
}

function render() {
  if (state.error) {
    ui.result.textContent = state.error;
    ui.result.className = 'result error';
    ui.expression.textContent = '';
    return;
  }

  const text = groupDigits(state.current);
  ui.result.textContent = text;
  ui.result.className = 'result' + (text.length > 10 ? ' compact' : '');

  ui.expression.textContent = state.operator
    ? `${groupDigits(toNumberString(state.stored))} ${state.operator}`
    : '';
}

/* ---------- input handlers ---------- */

function clearAll() {
  state.current = '0';
  state.stored = null;
  state.operator = null;
  state.overwrite = true;
  state.error = false;
}

function fail(message) {
  clearAll();
  state.error = message;
}

function inputDigit(digit) {
  if (state.error) clearAll();

  if (state.overwrite) {
    state.current = digit;
    state.overwrite = false;
    return;
  }

  const digitCount = state.current.replace(/[-.]/g, '').length;
  if (digitCount >= MAX_DIGITS) return;

  state.current = state.current === '0' ? digit : state.current + digit;
}

function inputDecimal() {
  if (state.error) clearAll();

  if (state.overwrite) {
    state.current = '0.';
    state.overwrite = false;
  } else if (!state.current.includes('.')) {
    state.current += '.';
  }
}

function backspace() {
  if (state.error) return clearAll();
  if (state.overwrite) return;

  state.current = state.current.length > 1 ? state.current.slice(0, -1) : '0';
  if (state.current === '-') state.current = '0';
}

function negate() {
  if (state.error) return;
  if (state.current === '0') return;

  state.current = state.current.startsWith('-')
    ? state.current.slice(1)
    : '-' + state.current;
}

function percent() {
  if (state.error) return;

  const value = parseFloat(state.current);
  // 200 + 10% means 10% of 200; a bare 10% means 0.1
  const base = (state.operator === '+' || state.operator === '−') && state.stored !== null
    ? state.stored
    : 1;

  const text = toNumberString(base * value / 100);
  if (text === null) return fail('Result is out of range');

  state.current = text;
  state.overwrite = false;
}

function chooseOperator(operator) {
  if (state.error) return;

  const value = parseFloat(state.current);

  if (state.operator !== null && !state.overwrite) {
    const outcome = operate(state.operator, state.stored, value);
    if (outcome === null) return fail("Can't divide by zero");

    const text = toNumberString(outcome);
    if (text === null) return fail('Result is out of range');

    state.stored = Number(text);
    state.current = text;
  } else {
    state.stored = value;
  }

  state.operator = operator;
  state.overwrite = true;
}

function equals() {
  if (state.error || state.operator === null) return;

  const expression =
    `${groupDigits(toNumberString(state.stored))} ${state.operator} ${groupDigits(state.current)}`;

  const outcome = operate(state.operator, state.stored, parseFloat(state.current));
  if (outcome === null) return fail("Can't divide by zero");

  const text = toNumberString(outcome);
  if (text === null) return fail('Result is out of range');

  addToHistory(expression, text);

  state.current = text;
  state.stored = null;
  state.operator = null;
  state.overwrite = true;
}

/* ---------- history (kept for this session only) ---------- */

/* sessionStorage survives a webview reload but is dropped when the app
   window closes, which is exactly the lifetime we want here. */
let history = loadHistory();

function loadHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY));
    return Array.isArray(saved) ? saved.slice(0, MAX_HISTORY) : [];
  } catch (error) {
    return [];
  }
}

function saveHistory() {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    /* Storage disabled — history still works in memory for this run. */
  }
}

function addToHistory(expression, result) {
  history.unshift({ expression, result });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  saveHistory();
  renderHistory();
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  ui.historyList.replaceChildren();

  for (const [index, item] of history.entries()) {
    const entry = document.createElement('button');
    entry.className = 'entry';
    entry.type = 'button';
    entry.dataset.index = String(index);

    const expression = document.createElement('span');
    expression.className = 'entry-expression';
    expression.textContent = `${item.expression} =`;

    const result = document.createElement('span');
    result.className = 'entry-result';
    result.textContent = groupDigits(item.result);

    entry.append(expression, result);

    const row = document.createElement('li');
    row.append(entry);
    ui.historyList.append(row);
  }

  const empty = history.length === 0;
  ui.historyEmpty.hidden = !empty;
  ui.historyList.hidden = empty;
  ui.clearHistory.disabled = empty;
}

function toggleHistory(open) {
  const show = open !== undefined ? open : ui.history.hidden;
  ui.history.hidden = !show;
  ui.historyToggle.setAttribute('aria-pressed', String(show));
}

/* Reusing a past result drops it straight into the display. */
ui.historyList.addEventListener('click', (event) => {
  const entry = event.target.closest('.entry');
  if (!entry) return;

  state.error = false;
  state.current = history[Number(entry.dataset.index)].result;
  state.overwrite = false;

  toggleHistory(false);
  render();
});

ui.historyToggle.addEventListener('click', () => toggleHistory());
ui.clearHistory.addEventListener('click', clearHistory);

/* ---------- wiring ---------- */

function press(button) {
  if (!button) return;

  if (button.dataset.digit) {
    inputDigit(button.dataset.digit);
  } else if (button.dataset.operator) {
    chooseOperator(button.dataset.operator);
  } else {
    switch (button.dataset.action) {
      case 'clear': clearAll(); break;
      case 'backspace': backspace(); break;
      case 'percent': percent(); break;
      case 'negate': negate(); break;
      case 'decimal': inputDecimal(); break;
      case 'equals': equals(); break;
    }
  }

  render();
}

ui.keypad.addEventListener('click', (event) => {
  press(event.target.closest('.key'));
});

/* Keyboard: digits, + - * /, Enter, Backspace, Escape, % */
const KEY_MAP = {
  '+': '[data-operator="+"]',
  '-': '[data-operator="−"]',
  '*': '[data-operator="×"]',
  'x': '[data-operator="×"]',
  '/': '[data-operator="÷"]',
  '=': '[data-action="equals"]',
  'Enter': '[data-action="equals"]',
  'Backspace': '[data-action="backspace"]',
  'Delete': '[data-action="clear"]',
  'Escape': '[data-action="clear"]',
  'c': '[data-action="clear"]',
  '%': '[data-action="percent"]',
  '.': '[data-action="decimal"]',
  ',': '[data-action="decimal"]'
};

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === 'h') {
    event.preventDefault();
    return toggleHistory();
  }

  if (event.key === 'Escape' && !ui.history.hidden) {
    event.preventDefault();
    return toggleHistory(false);
  }

  const selector = /^[0-9]$/.test(event.key)
    ? `[data-digit="${event.key}"]`
    : KEY_MAP[event.key];

  if (!selector) return;

  const button = ui.keypad.querySelector(selector);
  event.preventDefault();
  press(button);

  button.classList.add('flash');
  setTimeout(() => button.classList.remove('flash'), 90);
});

/* ---------- window controls ---------- */

const tauriWindow = window.__TAURI__ && window.__TAURI__.window;
const appWindow = tauriWindow ? tauriWindow.getCurrentWindow() : null;

const pinButton = document.getElementById('pin');
let pinned = true;

pinButton.addEventListener('click', async () => {
  pinned = !pinned;
  pinButton.setAttribute('aria-pressed', String(pinned));
  pinButton.title = pinned ? 'Stay on top' : 'Stay on top is off';
  if (appWindow) await appWindow.setAlwaysOnTop(pinned);
});

document.getElementById('minimize').addEventListener('click', () => {
  if (appWindow) appWindow.minimize();
});

document.getElementById('close').addEventListener('click', () => {
  if (appWindow) appWindow.close();
});

render();
renderHistory();
