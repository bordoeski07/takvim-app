// State
let currentDate = new Date();
let currentView = 'week';
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};

// Constants
const START_HOUR = 8;
const END_HOUR = 21; // 8am to 9pm (14 hours)
const ROW_HEIGHT = 60; // px

// DOM logic
const dom = {
    monthYear: document.getElementById('monthYear'),
    weekdays: document.getElementById('weekdaysHeader'),
    timeGrid: document.getElementById('timeGrid'),
    weekGrid: document.getElementById('weekGrid'),
    monthGrid: document.getElementById('monthGrid'),
    currentTimeAction: document.getElementById('currentTimeLine'),

    // Modals
    importModal: document.getElementById('importModal'),
    eventModal: document.getElementById('eventModal'),
    importText: document.getElementById('importText'),

    // Inputs
    evtTitle: document.getElementById('eventTitle'),
    evtStart: document.getElementById('eventStartTime'),
    evtEnd: document.getElementById('eventEndTime')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', e => switchView(e.target.dataset.view)));
    document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
    document.getElementById('todayBtn').addEventListener('click', () => { currentDate = new Date(); render(); });

    document.getElementById('importBtn').addEventListener('click', () => dom.importModal.classList.remove('hidden'));
    document.querySelector('.close-import-btn').addEventListener('click', () => dom.importModal.classList.add('hidden'));
    document.querySelector('.close-btn').addEventListener('click', () => dom.eventModal.classList.add('hidden'));

    document.getElementById('processImportBtn').addEventListener('click', runLinearParser);
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);

    // Factory Reset
    const resetBtn = document.getElementById('clearDataBtn');
    if (resetBtn) resetBtn.addEventListener('click', factoryReset);

    setupTimeAxis();
    render();

    // Clock
    setInterval(updateTimeIndicator, 60000);
    updateTimeIndicator();
});

// --- Logic ---

function factoryReset() {
    if (confirm("FABRİKA AYARLARI: Tüm veriler silinecek ve uygulama yenilenecek. Onaylıyor musunuz?")) {
        localStorage.clear();
        location.reload();
    }
}

// Linear Grid Parser
function runLinearParser() {
    const text = dom.importText.value;
    if (!text) return;

    const lines = text.split('\n').map(l => l.trim());

    // Logic: 
    // Skip 21 lines of headers (7 Days + 14 Hours)
    // Then mapped Column by Column: Mon(8-21), Tue(8-21)...

    // Headers skip
    // NOTE: User said "Monday...Sunday" (7 lines) + "8am...9pm" (14 lines) = 21 lines.

    let dataLines = lines;
    if (lines.length > 21) {
        // Simple heuristic: if input looks raw, assume first 21 lines are headers
        dataLines = lines.slice(21);
    }

    let addedCount = 0;

    // Iterate Days (0=Mon, ... 6=Sun)
    for (let dIndex = 0; dIndex < 7; dIndex++) {
        // Iterate Hours (8..21) -> 14 slots
        for (let hIndex = START_HOUR; hIndex <= END_HOUR; hIndex++) {
            if (dataLines.length === 0) break;

            const content = dataLines.shift(); // Take next line

            if (content && content.length > 0) {
                // Create Event
                // Determine Date for this dIndex (relative to current week or next week)
                const dateRef = getStartOfWeek(new Date());
                dateRef.setDate(dateRef.getDate() + dIndex); // 0=Mon

                // Add for 4 weeks ahead
                for (let w = 0; w < 4; w++) {
                    const evtDate = new Date(dateRef);
                    evtDate.setDate(dateRef.getDate() + (w * 7));
                    const key = getDateKey(evtDate);

                    if (!events[key]) events[key] = [];

                    events[key].push({
                        id: Date.now() + Math.random(),
                        title: content,
                        startTime: `${hIndex.toString().padStart(2, '0')}:00`,
                        endTime: `${(hIndex + 1).toString().padStart(2, '0')}:00`,
                        category: 'koc'
                    });
                    addedCount++;
                }
            }
        }
    }

    if (addedCount > 0) {
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        dom.importModal.classList.add('hidden');
        render();
        alert(`${addedCount} ders eklendi (Doğrusal Algoritma).`);
    } else {
        alert("Ders eklenemedi. Veri formatı boş olabilir.");
    }
}

// --- View ---
function switchView(v) {
    currentView = v;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${v}"]`).classList.add('active');

    if (v === 'month') {
        dom.timeGrid.classList.add('hidden');
        dom.monthGrid.classList.remove('hidden');
    } else {
        dom.timeGrid.classList.remove('hidden');
        dom.monthGrid.classList.add('hidden');

        // Grid cols
        if (v === 'day') {
            dom.weekdays.style.gridTemplateColumns = '50px 1fr';
            dom.weekGrid.style.gridTemplateColumns = '1fr';
        } else {
            dom.weekdays.style.gridTemplateColumns = '50px repeat(7, 1fr)';
            dom.weekGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        }
    }
    render();
}

function navigate(dir) {
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + dir);
    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + (dir * 7));
    else currentDate.setDate(currentDate.getDate() + dir);
    render();
}

// --- Render ---
function render() {
    dom.monthYear.textContent = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(currentDate);

    // Weekdays Header
    dom.weekdays.innerHTML = '<div></div>'; // Spacer
    const startWeek = getStartOfWeek(currentDate);
    const count = currentView === 'day' ? 1 : 7;
    const start = currentView === 'day' ? currentDate : startWeek;

    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        if (currentView === 'week') d.setDate(d.getDate() + i);

        const div = document.createElement('div');
        div.innerHTML = `${d.toLocaleDateString('tr-TR', { weekday: 'short' })}<br><b>${d.getDate()}</b>`;
        dom.weekdays.appendChild(div);
    }

    if (currentView === 'month') renderMonth();
    else renderWeek(start, count);
}

function renderWeek(startDate, dayCount) {
    dom.weekGrid.innerHTML = '';
    dom.weekGrid.appendChild(dom.currentTimeAction); // Persist line

    for (let i = 0; i < dayCount; i++) {
        const d = new Date(startDate);
        if (currentView === 'week') d.setDate(d.getDate() + i);
        const key = getDateKey(d);

        const col = document.createElement('div');
        col.className = 'day-column';

        (events[key] || []).forEach(evt => {
            const el = createEventEl(evt);
            col.appendChild(el);
        });

        dom.weekGrid.appendChild(col);
    }
}

function createEventEl(evt) {
    const div = document.createElement('div');
    div.className = `event-block ${evt.category}`;

    const [sh, sm] = evt.startTime.split(':').map(Number);
    const [eh, em] = evt.endTime.split(':').map(Number);

    const startVal = sh + sm / 60;
    const endVal = eh + em / 60;

    const top = (startVal - START_HOUR) * ROW_HEIGHT;
    const height = (endVal - startVal) * ROW_HEIGHT;

    div.style.top = `${top}px`;
    div.style.height = `${height}px`;
    // For now simple full width, improved overlap logic can be added if needed
    // But user asked strictly for alignment first
    div.style.width = '95%';

    // Title parsing
    let title = evt.title;
    let code = '';
    // Look for code at start
    const match = title.match(/^([A-Z]{2,4}\s?\d{3,4})(.*)/);
    if (match) {
        code = match[1];
        title = match[2] || code;
    }

    div.innerHTML = `<span class="event-title">${title}</span>${code ? `<span class="event-code">${code}</span>` : ''}`;
    return div;
}

function renderMonth() {
    dom.monthGrid.innerHTML = '';
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const first = new Date(y, m, 1);
    const daysInM = new Date(y, m + 1, 0).getDate();
    // Monday start correction: Mon=1..Sun=7 -> Mon=0..Sun=6
    let startDay = (first.getDay() + 6) % 7;

    // Fill empty
    for (let i = 0; i < startDay; i++) dom.monthGrid.appendChild(makeDiv('day empty'));

    for (let i = 1; i <= daysInM; i++) {
        const cell = makeDiv('day');
        cell.innerHTML = `<div class="day-number">${i}</div>`;

        const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayEvts = events[key] || [];

        if (dayEvts.length > 0) {
            // Show first 3
            dayEvts.slice(0, 3).forEach(e => {
                const badge = document.createElement('div');
                badge.className = `month-label ${e.category}`;
                // Label: Code or First Word
                // Regex for code
                const match = e.title.match(/[A-Z]{2,4}\s?\d{3,4}/);
                badge.textContent = match ? match[0] : e.title;
                cell.appendChild(badge);
            });
        }

        cell.addEventListener('click', () => {
            currentDate = new Date(y, m, i);
            switchView('day');
        });
        dom.monthGrid.appendChild(cell);
    }
}

// Helpers
function setupTimeAxis() {
    const axis = document.querySelector('.time-axis');
    axis.innerHTML = '';
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        const slot = makeDiv('time-slot');
        slot.textContent = `${h}:00`;
        axis.appendChild(slot);
    }
}
function updateTimeIndicator() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < START_HOUR || h > END_HOUR) {
        dom.currentTimeAction.style.display = 'none';
        return;
    }
    dom.currentTimeAction.style.display = 'block';
    dom.currentTimeAction.style.top = `${((h - START_HOUR) + m / 60) * ROW_HEIGHT}px`;
}
function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}
function getDateKey(d) { return d.toISOString().split('T')[0]; }
function makeDiv(c) { const d = document.createElement('div'); d.className = c; return d; }
let selectedSlot = null;
function saveEvent() {
    // Simple mock event save if manual add is needed
    // Assuming UI for this is kept but priority was parser
    alert("Kayıt tamam (Stub)");
    dom.eventModal.classList.add('hidden');
}
