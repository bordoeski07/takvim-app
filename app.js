// State
let currentDate = new Date();
let currentView = 'week'; // 'week', 'day', 'month'
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};

// Constants
const START_HOUR = 8;
const END_HOUR = 23; // 22:00 + 1 hour buffer
const ROW_HEIGHT = 60; // px per hour

// DOM Elements
const monthYearText = document.getElementById('monthYear');
const weekdaysHeader = document.getElementById('weekdaysHeader');
const timeGrid = document.getElementById('timeGrid');
const weekGrid = document.getElementById('weekGrid');
const monthGrid = document.getElementById('monthGrid');
const currentTimeLine = document.getElementById('currentTimeLine');

// Buttons
document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => switchView(e.target.dataset.view));
});
document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
document.getElementById('todayBtn').addEventListener('click', () => {
    currentDate = new Date();
    render();
});

// Modal Elements
const eventModal = document.getElementById('eventModal');
const importModal = document.getElementById('importModal');
const importText = document.getElementById('importText');
let selectedSlot = null; // { dateKey, startTime }

// Init
document.addEventListener('DOMContentLoaded', () => {
    setupTimeAxis();
    render();
    setInterval(updateCurrentTimeIndicator, 60000); // Update every minute
    updateCurrentTimeIndicator();

    // Import Logic
    document.getElementById('importBtn').addEventListener('click', () => importModal.classList.remove('hidden'));
    document.querySelector('.close-import-btn').addEventListener('click', () => importModal.classList.add('hidden'));
    document.getElementById('processImportBtn').addEventListener('click', processImport);

    // Event Modal Logic
    document.querySelector('.close-btn').addEventListener('click', () => eventModal.classList.add('hidden'));
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
});

// --- Navigation & View Switching ---

function switchView(view) {
    currentView = view;
    // UI Updates
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');

    if (view === 'month') {
        timeGrid.classList.add('hidden');
        monthGrid.classList.remove('hidden');
    } else {
        timeGrid.classList.remove('hidden');
        monthGrid.classList.add('hidden');

        // CSS Grid Columns Update
        if (view === 'day') {
            weekdaysHeader.style.gridTemplateColumns = '50px 1fr';
            weekGrid.style.gridTemplateColumns = '1fr';
        } else {
            weekdaysHeader.style.gridTemplateColumns = '50px repeat(7, 1fr)';
            weekGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        }
    }
    render();
}

function navigate(step) {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + step);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (step * 7));
    } else if (currentView === 'day') {
        currentDate.setDate(currentDate.getDate() + step);
    }
    render();
}

// --- Rendering ---

function render() {
    updateHeader();
    renderWeekdays();

    if (currentView === 'month') {
        renderMonthGrid();
    } else {
        renderTimeGrid();
    }
}

function updateHeader() {
    const opts = { month: 'long', year: 'numeric' };
    if (currentView === 'day') opts.day = 'numeric';
    monthYearText.textContent = new Intl.DateTimeFormat('tr-TR', opts).format(currentDate);
}

function renderWeekdays() {
    weekdaysHeader.innerHTML = '<div></div>'; // Spacer

    const startOfWeek = getStartOfWeek(currentDate);
    const dayCount = currentView === 'day' ? 1 : 7;
    const loopStart = currentView === 'day' ? currentDate : startOfWeek;

    for (let i = 0; i < dayCount; i++) {
        const d = new Date(loopStart);
        if (currentView === 'week') d.setDate(d.getDate() + i);

        const dayDiv = document.createElement('div');
        const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short' });
        const dayNum = d.getDate();

        dayDiv.innerHTML = `${dayName} <br> <span style="font-size: 1.1rem; color: ${isToday(d) ? 'var(--color-koc)' : 'inherit'}">${dayNum}</span>`;
        weekdaysHeader.appendChild(dayDiv);
    }
}

function setupTimeAxis() {
    const axis = document.querySelector('.time-axis');
    axis.innerHTML = '';
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = `${h.toString().padStart(2, '0')}:00`;
        axis.appendChild(slot);
    }
}

function renderTimeGrid() {
    weekGrid.innerHTML = ''; // Clear
    weekGrid.appendChild(currentTimeLine); // Keep indicator

    const startOfWeek = getStartOfWeek(currentDate);
    const dayCount = currentView === 'day' ? 1 : 7;
    const loopStart = currentView === 'day' ? currentDate : startOfWeek;

    // Create Columns
    for (let i = 0; i < dayCount; i++) {
        const d = new Date(loopStart);
        if (currentView === 'week') d.setDate(d.getDate() + i);

        const dateKey = getDateKey(d);

        const col = document.createElement('div');
        col.className = 'day-column';
        col.dataset.date = dateKey;

        // Add existing events
        const dayEvents = events[dateKey] || [];
        renderEventsInColumn(col, dayEvents);

        // Click to add (simplified)
        col.addEventListener('click', (e) => {
            if (e.target !== col) return; // Ignore clicks on events
            const rect = col.getBoundingClientRect();
            const y = e.clientY - rect.top + weekGrid.scrollTop;
            const hour = Math.floor(y / ROW_HEIGHT) + START_HOUR;
            openEventModal(dateKey, hour);
        });

        weekGrid.appendChild(col);
    }
}

function renderEventsInColumn(container, dayEvents) {
    if (!dayEvents.length) return;

    // Calculate Grid Positions
    dayEvents.forEach(evt => {
        const [startH, startM] = evt.startTime.split(':').map(Number);
        const [endH, endM] = evt.endTime.split(':').map(Number);

        const startVal = startH + (startM / 60);
        const endVal = endH + (endM / 60);

        evt.top = (startVal - START_HOUR) * ROW_HEIGHT;
        evt.height = (endVal - startVal) * ROW_HEIGHT;
    });

    // Simple Overlap Logic
    // Sort by start time
    dayEvents.sort((a, b) => a.top - b.top);

    // Check overlaps (simplified: just split overlap width)
    const groups = [];
    // Group overlapping events
    dayEvents.forEach(evt => {
        let placed = false;
        for (let group of groups) {
            if (doOverlap(group[group.length - 1], evt)) {
                group.push(evt);
                placed = true;
                break;
            }
        }
        if (!placed) groups.push([evt]);
    });

    groups.forEach(group => {
        const width = 100 / group.length;
        group.forEach((evt, idx) => {
            const div = document.createElement('div');
            div.className = `event-block ${evt.category}`;
            div.style.top = `${evt.top}px`;
            div.style.height = `${evt.height}px`;
            div.style.width = `${width}%`;
            div.style.left = `${idx * width}%`;

            div.innerHTML = `
                <span class="event-title">${evt.title}</span>
                <span class="event-desc">${evt.description || ''}</span>
            `;

            div.title = `${evt.startTime} - ${evt.endTime}`;
            container.appendChild(div);
        });
    });
}

function doOverlap(a, b) {
    return (a.top < (b.top + b.height)) && ((a.top + a.height) > b.top);
}

function renderMonthGrid() {
    monthGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = (firstDay.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) monthGrid.appendChild(createDiv('day empty'));

    for (let i = 1; i <= daysInMonth; i++) {
        const cell = createDiv('day');
        cell.innerHTML = `<div>${i}</div>`;
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        // Dots
        if (events[key]) {
            const dots = createDiv('event-dots');
            events[key].forEach(e => {
                const dot = createDiv(`dot ${e.category}`);
                dots.appendChild(dot);
            });
            cell.appendChild(dots);
        }
        monthGrid.appendChild(cell);
    }
}

// --- Helpers ---

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Mon start
    return new Date(d.setDate(diff));
}

function getDateKey(d) {
    return d.toISOString().split('T')[0];
}

function isToday(d) {
    const today = new Date();
    return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
}

function createDiv(className) {
    const d = document.createElement('div');
    d.className = className;
    return d;
}

function updateCurrentTimeIndicator() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (hours < START_HOUR || hours > END_HOUR) {
        currentTimeLine.style.display = 'none';
        return;
    }
    currentTimeLine.style.display = 'block';
    const top = ((hours - START_HOUR) + (minutes / 60)) * ROW_HEIGHT;
    currentTimeLine.style.top = `${top}px`;
}

// --- Event Actions ---

function openEventModal(dateKey, hour) {
    selectedSlot = { dateKey, hour };
    const dateDisp = new Date(dateKey).toLocaleDateString();
    document.getElementById('modalDate').textContent = `${dateDisp} - ${hour}:00`;

    document.getElementById('eventTitle').value = '';
    document.getElementById('eventStartTime').value = `${hour.toString().padStart(2, '0')}:00`;
    document.getElementById('eventEndTime').value = `${(hour + 1).toString().padStart(2, '0')}:00`;

    eventModal.classList.remove('hidden');
}

function saveEvent() {
    if (!selectedSlot) return;
    const title = document.getElementById('eventTitle').value;
    const start = document.getElementById('eventStartTime').value;
    const end = document.getElementById('eventEndTime').value;
    const cat = document.querySelector('input[name="category"]:checked').value;

    if (!title) return alert('İsim giriniz');

    const key = selectedSlot.dateKey;
    if (!events[key]) events[key] = [];

    events[key].push({
        id: Date.now(),
        title, startTime: start, endTime: end, category: cat
    });

    localStorage.setItem('calendarEvents', JSON.stringify(events));
    render();
    eventModal.classList.add('hidden');
}

// --- Importer ---

function processImport() {
    const text = importText.value;
    if (!text) return;

    const lines = text.split('\n');
    const dayMap = { 'pazartesi': 1, 'salı': 2, 'çarşamba': 3, 'perşembe': 4, 'cuma': 5 };
    // English mapping omitted for brevity but logic is same
    // Add simple check for now

    let count = 0;
    lines.forEach(line => {
        const lower = line.toLowerCase();
        let dayIdx = -1;
        for (const [k, v] of Object.entries(dayMap)) if (lower.includes(k)) dayIdx = v;
        if (dayIdx === -1) return;

        // Extract Time Range: 10:00 - 11:15
        const timeMatch = line.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
        if (!timeMatch) return;

        const codeMatch = line.match(/\b[A-Z]{2,4}\s?\d{3,4}\b/);
        const title = codeMatch ? codeMatch[0] : "Ders";

        // Generate for 4 weeks
        const d = getStartOfWeek(new Date());
        d.setDate(d.getDate() + (dayIdx - 1)); // 1-based index fix

        for (let i = 0; i < 4; i++) {
            const eventDate = new Date(d);
            eventDate.setDate(d.getDate() + (i * 7));
            const key = getDateKey(eventDate);

            if (!events[key]) events[key] = [];
            events[key].push({
                id: Date.now() + Math.random(),
                title: title,
                description: line.substring(0, 20) + '...', // Simple desc
                startTime: timeMatch[1],
                endTime: timeMatch[2],
                category: 'koc'
            });
            count++;
        }
    });

    localStorage.setItem('calendarEvents', JSON.stringify(events));
    render();
    importModal.classList.add('hidden');
    alert(`${count} ders eklendi.`);
}
