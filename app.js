// State
let currentDate = new Date();
let currentView = 'week';
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};
let editingEventId = null;

// Constants
const START_HOUR = 8;
const END_HOUR = 23;
const ROW_HEIGHT = 60;

// Icons Mapping
const CAT_ICONS = {
    'koc': '📘',
    'stock': '📈',
    'personal': '📅',
    'special': '✨' // Changed from content/camera to special/sparkle
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
    deleteBtnHeader: document.getElementById('deleteBtnHeader'),
    cancelBtn: document.getElementById('cancelBtn'),

    // Form Inputs
    catRadios: document.getElementsByName('evtCat'),
    repeatSelect: document.getElementById('evtRepeat'),
    title: document.getElementById('evtTitle'),
    location: document.getElementById('evtLocation'),
    day: document.getElementById('evtDay'),
    date: document.getElementById('evtDate'),
    start: document.getElementById('evtStart'),
    end: document.getElementById('evtEnd'),

    // Sections
    dayRow: document.getElementById('daySelectRow'),
    dateRow: document.getElementById('dateSelectRow')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', e => switchView(e.target.dataset.view)));
    document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
    document.getElementById('todayBtn').addEventListener('click', () => { currentDate = new Date(); render(); });

    // Actions
    document.getElementById('addEventBtn').addEventListener('click', () => openModal());
    document.getElementById('clearDataBtn').addEventListener('click', factoryReset);
    dom.deleteBtnHeader.addEventListener('click', handleDelete);
    dom.cancelBtn.addEventListener('click', closeModal);

    // Form
    dom.eventForm.addEventListener('submit', handleFormSubmit);
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Change Listeners
    dom.repeatSelect.addEventListener('change', updateFormFields);
    dom.catRadios.forEach(r => r.addEventListener('change', handleCategoryChange));

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

function handleCategoryChange() {
    const cat = document.querySelector('input[name="evtCat"]:checked').value;
    // Default logic based on Category
    if (cat === 'koc') {
        dom.repeatSelect.value = 'weekly';
    } else {
        dom.repeatSelect.value = 'none';
        // User can manually select 'daily' for habits
    }
    updateFormFields();
}

function updateFormFields() {
    const repeat = dom.repeatSelect.value;

    if (repeat === 'weekly') {
        dom.dayRow.classList.remove('hidden');
        dom.dateRow.classList.add('hidden');
    } else {
        // For 'none', 'daily', 'weekdays' -> Use Date Picker (Start Date)
        dom.dayRow.classList.add('hidden');
        dom.dateRow.classList.remove('hidden');
    }
}

function openModal(evtToEdit = null) {
    dom.eventForm.reset();
    document.body.classList.add('modal-open');
    dom.deleteBtnHeader.classList.add('hidden');
    editingEventId = null;

    dom.modalTitle.textContent = "Yeni Ekle";
    document.getElementById('evtStart').value = "09:00";
    document.getElementById('evtEnd').value = "10:30";
    dom.date.valueAsDate = new Date();

    // Default Cat: Koc
    document.querySelector('input[name="evtCat"][value="koc"]').checked = true;
    handleCategoryChange();

    // If Editing
    if (evtToEdit) {
        editingEventId = evtToEdit.id;
        dom.modalTitle.textContent = "Düzenle";
        dom.deleteBtnHeader.classList.remove('hidden');

        dom.title.value = evtToEdit.title;
        dom.location.value = evtToEdit.location || '';
        dom.start.value = evtToEdit.startTime;
        dom.end.value = evtToEdit.endTime;

        const catRadio = document.querySelector(`input[name="evtCat"][value="${evtToEdit.category}"]`);
        if (catRadio) catRadio.checked = true;

        // Force 'none' for edit single instance logic
        dom.repeatSelect.value = 'none';
        updateFormFields();
    }

    dom.eventModal.classList.remove('hidden');
}

function openEditModal(evt, dateKey) {
    openModal(evt);
    dom.date.value = dateKey;
}

function closeModal() {
    dom.eventModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function handleFormSubmit(e) {
    e.preventDefault();

    const title = dom.title.value;
    const loc = dom.location.value;
    const start = dom.start.value;
    const end = dom.end.value;
    const cat = document.querySelector('input[name="evtCat"]:checked').value;
    const repeat = dom.repeatSelect.value;

    if (editingEventId) deleteEventById(editingEventId);

    // Logic
    if (repeat === 'weekly') {
        const dayIdx = parseInt(dom.day.value);
        const weekStart = getStartOfWeek(currentDate);
        const offset = dayIdx === 0 ? 6 : dayIdx - 1;
        const targetDate = new Date(weekStart);
        targetDate.setDate(weekStart.getDate() + offset);

        // 16 Weeks
        for (let i = 0; i < 16; i++) {
            const d = new Date(targetDate);
            d.setDate(targetDate.getDate() + (i * 7));
            saveEventToDate(d, { title, location: loc, startTime: start, endTime: end, category: cat });
        }
    } else if (repeat === 'daily') {
        // Daily: Generate for 30 days
        const dateVal = dom.date.value;
        if (!dateVal) return alert("Başlangıç tarihi seçin.");

        const startDate = new Date(dateVal);
        for (let i = 0; i < 30; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            saveEventToDate(d, { title, location: loc, startTime: start, endTime: end, category: cat });
        }
    } else if (repeat === 'weekdays') {
        // Weekdays: Generate for 4 weeks (Mon-Fri)
        const dateVal = dom.date.value;
        if (!dateVal) return alert("Başlangıç tarihi seçin.");

        const startDate = new Date(dateVal);
        for (let i = 0; i < 28; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const day = d.getDay();
            if (day !== 0 && day !== 6) { // Skip Sun(0) and Sat(6)
                saveEventToDate(d, { title, location: loc, startTime: start, endTime: end, category: cat });
            }
        }
    } else {
        // None
        const dateVal = dom.date.value;
        if (!dateVal) return alert("Tarih seçin.");
        const d = new Date(dateVal);
        saveEventToDate(d, { title, location: loc, startTime: start, endTime: end, category: cat });
    }

    closeModal();
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
        closeModal();
        render();
    }
}

function deleteEventById(id) {
    for (const key in events) {
        const initialLen = events[key].length;
        events[key] = events[key].filter(e => e.id !== id);
        if (events[key].length !== initialLen && events[key].length === 0) {
            delete events[key];
        }
        if (events[key].length !== initialLen) break;
    }
    localStorage.setItem('calendarEvents', JSON.stringify(events));
}

function deleteEventDirect(e, evtId) {
    e.stopPropagation(); // Don't trigger edit modal
    if (confirm("Bu etkinliği silmek istiyor musunuz?")) {
        deleteEventById(evtId);
        render(); // Re-render immediately
    }
}

// --- View / Render ---

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

        col.addEventListener('dblclick', (e) => {
            if (e.target !== col) return;
            openModal();
            dom.date.value = key;
            dom.repeatSelect.value = 'none';
            updateFormFields();
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
            if (columns[i][columns[i].length - 1].bottom <= evt.top + 0.1) {
                columns[i].push(evt);
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
            <div class="event-trash" title="Sil">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
        `;

        // Trash Click
        el.querySelector('.event-trash').addEventListener('click', (e) => deleteEventDirect(e, evt.id));

        // Card Click
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
function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}
function getDateKey(d) { return d.toISOString().split('T')[0]; }
function makeDiv(c) { const d = document.createElement('div'); d.className = c; return d; }
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
