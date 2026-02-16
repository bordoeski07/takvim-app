// State
let currentDate = new Date();
let currentView = 'week';
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};

// Constants
const START_HOUR = 8;
const END_HOUR = 23;
const ROW_HEIGHT = 60;

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

    // Inputs
    title: document.getElementById('evtTitle'),
    location: document.getElementById('evtLocation'),
    day: document.getElementById('evtDay'),
    start: document.getElementById('evtStart'),
    end: document.getElementById('evtEnd')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', e => switchView(e.target.dataset.view)));
    document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
    document.getElementById('todayBtn').addEventListener('click', () => { currentDate = new Date(); render(); });

    // Actions
    document.getElementById('addEventBtn').addEventListener('click', openAddModal);
    document.getElementById('clearDataBtn').addEventListener('click', factoryReset);

    // Form
    dom.eventForm.addEventListener('submit', handleFormSubmit);
    document.querySelector('.close-btn').addEventListener('click', () => dom.eventModal.classList.add('hidden'));

    // Setup
    setupTimeAxis();
    render();

    // Clock
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

function openAddModal() {
    dom.eventForm.reset();
    document.getElementById('evtStart').value = "09:00";
    document.getElementById('evtEnd').value = "10:30";
    dom.eventModal.classList.remove('hidden');
}

function handleFormSubmit(e) {
    e.preventDefault();

    const title = dom.title.value;
    const loc = dom.location.value;
    const dayIdx = parseInt(dom.day.value); // 0=Sun, 1=Mon...
    const start = dom.start.value;
    const end = dom.end.value;
    const cat = document.querySelector('input[name="evtCat"]:checked').value;

    // Calculate Date based on Current Week View
    // We want the event to appear in the CURRENT week being viewed.
    // getStartOfWeek returns Monday of current view
    const weekStart = getStartOfWeek(currentDate);
    // If dayIdx is 0 (Sunday), in JS Date, Sunday is start of week usually, but we treat Mon as start.
    // Our getStartOfWeek returns Monday. 
    // If user picks Sunday (0), that is Monday + 6 days.
    // If user picks Tuesday (2), that is Monday + 1 day.

    // Adjust dayIdx to 0-6 Monday based logic
    // Input values: 1(Mon), 2(Tue), ..., 6(Sat), 0(Sun)
    // Map to offset from Monday: Mon=0, Tue=1... Sun=6
    const offset = dayIdx === 0 ? 6 : dayIdx - 1;

    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + offset);

    // Add Event for this specific date (+ next 4 weeks like before? No, manual should be specific or maybe recurring later. Let's do single instance for manual "New Event" focus, or keep the 4-week logic if user wants schedule. User said "Week View", usually implies recurring. Let's do 1 instance for "Manual Add" as it's cleaner, or maybe 4 weeks to mimic semester. Let's stick to 1 instance for safety, easy to add more).
    // Actually, user context is "Course Schedule", so let's add for 4 weeks to be helpful.

    let added = 0;
    for (let i = 0; i < 4; i++) {
        const d = new Date(targetDate);
        d.setDate(targetDate.getDate() + (i * 7));
        const key = getDateKey(d);

        if (!events[key]) events[key] = [];
        events[key].push({
            id: Date.now() + Math.random(),
            title: title,
            location: loc,
            startTime: start,
            endTime: end,
            category: cat
        });
        added++;
    }

    localStorage.setItem('calendarEvents', JSON.stringify(events));
    dom.eventModal.classList.add('hidden');
    render();
}

function deleteEvent(dateKey, evtId) {
    if (!events[dateKey]) return;
    if (confirm("Bu dersi silmek istiyor musunuz?")) {
        events[dateKey] = events[dateKey].filter(e => e.id !== evtId);
        if (events[dateKey].length === 0) delete events[dateKey];
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        render();
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

        dom.weekGrid.appendChild(col);
    }
}

function renderEventsInColumn(container, dayEvents, dateKey) {
    if (!dayEvents.length) return;

    // 1. Calculate Positions
    const items = dayEvents.map(evt => {
        const [sh, sm] = evt.startTime.split(':').map(Number);
        const [eh, em] = evt.endTime.split(':').map(Number);
        const top = ((sh + sm / 60) - START_HOUR) * ROW_HEIGHT;
        const height = ((eh + em / 60) - (sh + sm / 60)) * ROW_HEIGHT;
        return { ...evt, top, height, bottom: top + height };
    });

    // Sort logic
    items.sort((a, b) => a.top - b.top);

    // 2. Overlap Grouping (Smart Side-by-Side)
    // Simple greedy packing approach
    const columns = [];

    items.forEach(evt => {
        // Find first column where this event fits
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const lastEvt = col[col.length - 1];
            if (lastEvt.bottom <= evt.top + 0.1) { // 0.1 tolerance
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

    // 3. Render
    items.forEach(evt => {
        const el = document.createElement('div');
        el.className = `event-block ${evt.category}`;
        el.style.top = `${evt.top}px`;
        el.style.height = `${evt.height}px`;
        el.style.left = `${(evt.colIndex / totalCols) * 100}%`;
        el.style.width = `${(1 / totalCols) * 100}%`;

        el.innerHTML = `
            <span class="event-title">${evt.title}</span>
            <span class="event-loc">${evt.location || ''}</span>
            <div class="event-delete">✕</div>
        `;

        // Delete Action
        el.querySelector('.event-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEvent(dateKey, evt.id);
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
            // Prioritize Location if exists (e.g. M203), else Title
            badge.textContent = e.location ? e.location : e.title;
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
