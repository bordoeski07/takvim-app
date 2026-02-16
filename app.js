// State
let currentDate = new Date();
let currentView = 'week';
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};
let editingEventId = null; // Track if we are editing

// Constants
const START_HOUR = 8;
const END_HOUR = 23;
const ROW_HEIGHT = 60;

// Icons Mapping
const CAT_ICONS = {
    'koc': '📘',
    'stock': '📈',
    'personal': '📅',
    'content': '🎥'
};

// DOM Elements
const dom = {
    monthYear: document.getElementById('monthYear'),
    weekdays: document.getElementById('weekdaysHeader'),
    timeGrid: document.getElementById('timeGrid'),
    weekGrid: document.getElementById('weekGrid'),
    monthGrid: document.getElementById('monthGrid'),
    currentTimeLine: document.getElementById('currentTimeLine'),

    // Modals
    eventModal: document.getElementById('eventModal'),
    eventForm: document.getElementById('eventForm'),
    modalTitle: document.getElementById('modalTitle'),
    deleteBtn: document.getElementById('deleteBtn'),
    saveBtn: document.getElementById('saveBtn'),

    // Form Inputs
    typeRadios: document.getElementsByName('eventType'),
    title: document.getElementById('evtTitle'),
    location: document.getElementById('evtLocation'),
    day: document.getElementById('evtDay'),
    date: document.getElementById('evtDate'),
    start: document.getElementById('evtStart'),
    end: document.getElementById('evtEnd'),

    // Sections
    dayRow: document.getElementById('daySelectRow'),
    dateRow: document.getElementById('dateSelectRow'),
    recurrenceInfo: document.getElementById('recurrenceInfo')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', e => switchView(e.target.dataset.view)));
    document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
    document.getElementById('todayBtn').addEventListener('click', () => { currentDate = new Date(); render(); });

    // Actions
    document.getElementById('addEventBtn').addEventListener('click', () => openModal()); // New Mode
    document.getElementById('clearDataBtn').addEventListener('click', factoryReset);
    dom.deleteBtn.addEventListener('click', handleDelete);

    // Form
    dom.eventForm.addEventListener('submit', handleFormSubmit);
    document.querySelector('.close-btn').addEventListener('click', () => dom.eventModal.classList.add('hidden'));

    // Type Toggle Logic
    dom.typeRadios.forEach(r => r.addEventListener('change', toggleFormFields));

    // Setup
    setupTimeAxis();
    render();
    setInterval(updateTimeIndicator, 60000);
    updateTimeIndicator();
});

// --- Logic ---

function factoryReset() {
    if (confirm("DİKKAT: Tüm veriler silinecek! Onaylıyor musunuz?")) {
        localStorage.clear();
        location.reload();
    }
}

function toggleFormFields() {
    const type = document.querySelector('input[name="eventType"]:checked').value;
    if (type === 'course') {
        dom.dayRow.classList.remove('hidden');
        dom.dateRow.classList.add('hidden');
        dom.recurrenceInfo.classList.remove('hidden');
    } else {
        dom.dayRow.classList.add('hidden');
        dom.dateRow.classList.remove('hidden');
        dom.recurrenceInfo.classList.add('hidden');
    }
}

function openModal(evtToEdit = null) {
    dom.eventForm.reset();
    dom.deleteBtn.classList.add('hidden');
    editingEventId = null;

    // Defaults
    dom.modalTitle.textContent = "Yeni Ekle";
    document.getElementById('evtStart').value = "09:00";
    document.getElementById('evtEnd').value = "10:30";
    // Set today's date for single event
    dom.date.valueAsDate = new Date();

    // Default Type: Course
    document.querySelector('input[name="eventType"][value="course"]').checked = true;
    toggleFormFields();

    // If Editing
    if (evtToEdit) {
        editingEventId = evtToEdit.id;
        dom.modalTitle.textContent = "Düzenle";
        dom.deleteBtn.classList.remove('hidden');

        dom.title.value = evtToEdit.title;
        dom.location.value = evtToEdit.location || '';
        dom.start.value = evtToEdit.startTime;
        dom.end.value = evtToEdit.endTime;

        // Category
        const catRadio = document.querySelector(`input[name="evtCat"][value="${evtToEdit.category}"]`);
        if (catRadio) catRadio.checked = true;

        // Determine Type based on context (Hard to know strict type from just stored event, but we can infer or force 'single' for safe editing)
        // For simplicity: Edit Mode always shows Date Picker for explicit date change, masking as "Single" edit.
        document.querySelector('input[name="eventType"][value="single"]').checked = true;
        toggleFormFields();

        // Find existing date
        // Reverse engineering date from ID or Key is needed? 
        // We passed the obj, but we need the DATE KEY it belongs to.
        // Let's pass dateStr in openModal if possible, or store date in event obj.
        // NOTE: Our data structure: { '2024-01-01': [events] }
        // We need to know which date we are editing.
        // We will pass `dateStr` to openModal.
    }

    dom.eventModal.classList.remove('hidden');
}

// Overload openModal to accept context
function openEditModal(evt, dateKey) {
    openModal(evt);
    dom.date.value = dateKey; // Set the date picker to the event's date
}

function handleFormSubmit(e) {
    e.preventDefault();

    const title = dom.title.value;
    const loc = dom.location.value;
    const start = dom.start.value;
    const end = dom.end.value;
    const cat = document.querySelector('input[name="evtCat"]:checked').value;
    const type = document.querySelector('input[name="eventType"]:checked').value;

    // Delete previous if editing
    if (editingEventId) {
        // We only delete the SPECIFIC instance being edited (Single instance edit)
        // Finding and deleting...
        const oldDateVal = dom.date.value; // Valid because we switch to Single mode on edit
        deleteEventById(editingEventId);
    }

    // CREATE NEW
    if (type === 'course') {
        // Recurring Logic (16 Weeks)
        const dayIdx = parseInt(dom.day.value); // 0=Sun, 1=Mon...
        const weekStart = getStartOfWeek(currentDate);
        const offset = dayIdx === 0 ? 6 : dayIdx - 1;
        const targetDate = new Date(weekStart);
        targetDate.setDate(weekStart.getDate() + offset);

        for (let i = 0; i < 16; i++) { // 16 Weeks Semester
            const d = new Date(targetDate);
            d.setDate(targetDate.getDate() + (i * 7));
            saveEventToDate(d, { title, location: loc, startTime: start, endTime: end, category: cat });
        }
    } else {
        // Single Event
        const dateVal = dom.date.value;
        if (!dateVal) return alert("Lütfen tarih seçin.");
        const d = new Date(dateVal);
        saveEventToDate(d, { title, location: loc, startTime: start, endTime: end, category: cat });
    }

    dom.eventModal.classList.add('hidden');
    render();
}

function saveEventToDate(dateObj, data) {
    const key = getDateKey(dateObj);
    if (!events[key]) events[key] = [];
    events[key].push({
        id: Date.now() + Math.random(), // Unique ID
        ...data
    });
    localStorage.setItem('calendarEvents', JSON.stringify(events));
}

function handleDelete() {
    if (editingEventId && confirm("Silmek istediğinize emin misiniz?")) {
        deleteEventById(editingEventId);
        dom.eventModal.classList.add('hidden');
        render();
    }
}

function deleteEventById(id) {
    // Search everywhere (inefficient but safe) or we need dateKey.
    // Ideally we pass dateKey. For now, iterate all.
    for (const key in events) {
        const initialLen = events[key].length;
        events[key] = events[key].filter(e => e.id !== id);
        if (events[key].length !== initialLen && events[key].length === 0) {
            delete events[key];
        }
        if (events[key].length !== initialLen) break; // Found and deleted
    }
    localStorage.setItem('calendarEvents', JSON.stringify(events));
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

    // Headers
    dom.weekdays.innerHTML = '<div></div>';
    const startWeek = getStartOfWeek(currentDate);
    const count = currentView === 'day' ? 1 : 7;
    const start = currentView === 'day' ? currentDate : startWeek;

    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        if (currentView === 'week') d.setDate(d.getDate() + i);
        const isToday = getDateKey(d) === getDateKey(new Date());

        const div = document.createElement('div');
        div.dataset.isToday = isToday;
        // e.g. Pzt 16
        div.innerHTML = `${d.toLocaleDateString('tr-TR', { weekday: 'short' })}<br><span style="font-size:1.1em">${d.getDate()}</span>`;
        dom.weekdays.appendChild(div);
    }

    if (currentView === 'month') renderMonth();
    else renderWeek(start, count);
}

function renderWeek(startDate, dayCount) {
    dom.weekGrid.innerHTML = '';
    dom.weekGrid.appendChild(dom.currentTimeLine);

    for (let i = 0; i < dayCount; i++) {
        const d = new Date(startDate);
        if (currentView === 'week') d.setDate(d.getDate() + i);
        const key = getDateKey(d);

        const col = document.createElement('div');
        col.className = 'day-column';

        const dayEvents = events[key] || [];
        renderEventsInColumn(col, dayEvents, key);

        // Click on column to quick add
        col.addEventListener('dblclick', (e) => {
            if (e.target !== col) return;
            const rect = col.getBoundingClientRect();
            const y = e.clientY - rect.top; // Relative to viewport actually? weekGrid scroll?
            // Need relative to col top.
            // Simplified: Just Open Modal defaulted to this day.
            dom.date.value = key;
            document.querySelector('input[name="eventType"][value="single"]').checked = true;
            toggleFormFields();
            openModal();
            dom.date.value = key; // Re-set after reset
        });

        dom.weekGrid.appendChild(col);
    }
}

function renderEventsInColumn(container, dayEvents, dateKey) {
    if (!dayEvents.length) return;

    const items = dayEvents.map(evt => {
        const [sh, sm] = evt.startTime.split(':').map(Number);
        const [eh, em] = evt.endTime.split(':').map(Number);
        const top = ((sh + sm / 60) - START_HOUR) * ROW_HEIGHT;
        const height = ((eh + em / 60) - (sh + sm / 60)) * ROW_HEIGHT;
        return { ...evt, top, height, bottom: top + height };
    });

    items.sort((a, b) => a.top - b.top);

    const columns = [];
    items.forEach(evt => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const lastEvt = col[col.length - 1];
            if (lastEvt.bottom <= evt.top + 0.1) {
                col.push(evt);
                evt.colIndex = i;
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([evt]);
            evt.colIndex = columns.length - 1;
        }
    });

    const totalCols = columns.length;

    items.forEach(evt => {
        const el = document.createElement('div');
        el.className = `event-block ${evt.category}`;
        el.style.top = `${evt.top}px`;
        el.style.height = `${evt.height}px`;
        el.style.left = `${(evt.colIndex / totalCols) * 100}%`;
        el.style.width = `${(1 / totalCols) * 100}%`;

        const icon = CAT_ICONS[evt.category] || '';

        el.innerHTML = `
            <div class="event-header">
                <span class="event-icon">${icon}</span>
                <span class="event-title">${evt.title}</span>
            </div>
            <span class="event-loc">${evt.location || ''}</span>
        `;

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(evt, dateKey);
        });

        container.appendChild(el);
    });
}

function renderMonth() {
    dom.monthGrid.innerHTML = '';
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const first = new Date(y, m, 1);
    const daysInM = new Date(y, m + 1, 0).getDate();
    const startDay = (first.getDay() + 6) % 7;

    for (let i = 0; i < startDay; i++) dom.monthGrid.appendChild(makeDiv('day empty'));

    for (let i = 1; i <= daysInM; i++) {
        const cell = makeDiv('day');
        cell.innerHTML = `<div class="day-number">${i}</div>`;
        const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        (events[key] || []).slice(0, 4).forEach(e => {
            const badge = document.createElement('div');
            badge.className = `month-label ${e.category}`;
            const icon = CAT_ICONS[e.category] || '';
            badge.innerHTML = `<span>${icon}</span> ${e.location ? e.location : e.title}`;
            cell.appendChild(badge);
        });

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
        dom.currentTimeLine.style.display = 'none';
        return;
    }
    dom.currentTimeLine.style.display = 'block';
    dom.currentTimeLine.style.top = `${((h - START_HOUR) + m / 60) * ROW_HEIGHT}px`;
}
function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}
function getDateKey(d) { return d.toISOString().split('T')[0]; }
function makeDiv(c) { const d = document.createElement('div'); d.className = c; return d; }
