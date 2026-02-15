// State
let currentDate = new Date();
let currentView = 'week'; // 'week', 'day', 'month'
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};

// Constants
const START_HOUR = 8;
const END_HOUR = 23;
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

// Reset System Button (Clear All)
const clearBtn = document.getElementById('clearDataBtn');
if (clearBtn) clearBtn.addEventListener('click', clearAllData);

// Modal Elements
const eventModal = document.getElementById('eventModal');
const importModal = document.getElementById('importModal');
const importText = document.getElementById('importText');
let selectedSlot = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    validateAndCleanEvents(); // Clean up "ghost" events on load
    setupTimeAxis();
    render();
    setInterval(updateCurrentTimeIndicator, 60000);
    updateCurrentTimeIndicator();

    // Import Logic
    document.getElementById('importBtn').addEventListener('click', () => importModal.classList.remove('hidden'));
    document.querySelector('.close-import-btn').addEventListener('click', () => importModal.classList.add('hidden'));
    document.getElementById('processImportBtn').addEventListener('click', processImport);

    // Event Modal Logic
    document.querySelector('.close-btn').addEventListener('click', () => eventModal.classList.add('hidden'));
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
});

// --- Data Management ---

function validateAndCleanEvents() {
    let changed = false;
    for (const [key, list] of Object.entries(events)) {
        const validList = list.filter(evt => {
            return evt.startTime && evt.endTime &&
                /^\d{1,2}:\d{2}$/.test(evt.startTime) &&
                /^\d{1,2}:\d{2}$/.test(evt.endTime);
        });

        if (validList.length !== list.length) {
            events[key] = validList;
            changed = true;
        }
        if (events[key].length === 0) delete events[key];
    }

    if (changed) {
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        console.log('Cleaned up invalid ghost events.');
    }
}

function clearAllData() {
    if (confirm('Sistemi sıfırlamak istediğinize emin misiniz? Tüm ders programı ve etkinlikler silinecek.')) {
        events = {};
        localStorage.removeItem('calendarEvents');
        render();
        alert('Sistem sıfırlandı.');
    }
}

// --- Navigation & View Switching ---

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');

    if (view === 'month') {
        timeGrid.classList.add('hidden');
        monthGrid.classList.remove('hidden');
    } else {
        timeGrid.classList.remove('hidden');
        monthGrid.classList.add('hidden');

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
    weekGrid.innerHTML = '';
    weekGrid.appendChild(currentTimeLine);

    const startOfWeek = getStartOfWeek(currentDate);
    const dayCount = currentView === 'day' ? 1 : 7;
    const loopStart = currentView === 'day' ? currentDate : startOfWeek;

    for (let i = 0; i < dayCount; i++) {
        const d = new Date(loopStart);
        if (currentView === 'week') d.setDate(d.getDate() + i);

        const dateKey = getDateKey(d);
        const col = document.createElement('div');
        col.className = 'day-column';
        col.dataset.date = dateKey;

        const dayEvents = events[dateKey] || [];
        renderEventsInColumn(col, dayEvents);

        col.addEventListener('click', (e) => {
            if (e.target !== col) return;
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

    dayEvents.forEach(evt => {
        const [startH, startM] = evt.startTime.split(':').map(Number);
        const [endH, endM] = evt.endTime.split(':').map(Number);
        const startVal = startH + (startM / 60);
        const endVal = endH + (endM / 60);

        evt.top = (startVal - START_HOUR) * ROW_HEIGHT;
        evt.height = (endVal - startVal) * ROW_HEIGHT;
    });

    dayEvents.sort((a, b) => a.top - b.top);

    // Overlap Logic
    const groups = [];
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

            // Separate Code and Name logic
            // Try to regex separate if strictly 'CODE Name'
            // OR just use full title as name if no code found
            let dispName = evt.title;
            let dispCode = '';

            const codeMatch = evt.title.match(/^([A-Z]{2,4}\s?\d{3,4})\s*(.*)$/);
            if (codeMatch) {
                dispCode = codeMatch[1];
                dispName = codeMatch[2].trim() || dispCode; // Use code as name if no name
            }

            div.innerHTML = `
                <span class="event-title">${dispName}</span>
                ${dispCode ? `<span class="event-code">${dispCode}</span>` : ''}
            `;
            div.title = `${evt.startTime} - ${evt.endTime}\n${evt.title}`;
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
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 7 Columns, standard grid
    // Previous month empty slots
    for (let i = 0; i < startDay; i++) monthGrid.appendChild(createDiv('day empty'));

    for (let i = 1; i <= daysInMonth; i++) {
        const cell = createDiv('day');
        const dayNum = createDiv('day-number');
        dayNum.textContent = i;
        cell.appendChild(dayNum);

        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        // Month Labels
        if (events[key]) {
            const labelContainer = createDiv('month-event-labels');
            events[key].slice(0, 3).forEach(e => {
                const badge = createDiv(`month-label ${e.category}`);
                // Try to show Code first (M101), else Title
                const codeMatch = e.title.match(/^[A-Z]{2,4}\s?\d{3,4}/);
                badge.textContent = codeMatch ? codeMatch[0] : e.title;
                labelContainer.appendChild(badge);
            });
            if (events[key].length > 3) {
                const more = createDiv('month-label');
                more.style.backgroundColor = '#333';
                more.textContent = `+${events[key].length - 3}`;
                labelContainer.appendChild(more);
            }
            cell.appendChild(labelContainer);
        }

        cell.addEventListener('click', () => {
            currentDate = new Date(year, month, i);
            switchView('day');
        });

        monthGrid.appendChild(cell);
    }
}

// --- Helpers ---
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
    events[key].push({ id: Date.now(), title, startTime: start, endTime: end, category: cat });
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    render();
    eventModal.classList.add('hidden');
}

// --- Advanced Coordinate Parser (KUSIS) ---
function processImport() {
    const text = importText.value;
    if (!text) return;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const dayKeywords = { 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0, 'pazartesi': 1, 'salı': 2, 'çarşamba': 3, 'perşembe': 4, 'cuma': 5 };

    let addedCount = 0;

    // We will scan for "Day Blocks".
    // A Day Block starts with a Day Name.
    // Inside a Day Block, we look for Time Ranges.
    // If we find text between Time Ranges, it's the Course Name.

    let currentDayIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        // 1. Check if line is a Day Header
        // Strict check: Line must contain day name and be short (< 20 chars) to avoid false positives in course titles
        let foundDay = false;
        for (const [k, v] of Object.entries(dayKeywords)) {
            if (lower.includes(k) && lower.length < 30) {
                currentDayIdx = v;
                foundDay = true;
                console.log(`Found Day: ${k} -> ${v}`);
                break;
            }
        }
        if (foundDay) continue;

        // 2. Check if line is a Time Range (Start - End)
        // Regex for HH:MM - HH:MM or HH.MM - HH.MM
        const timeMatch = line.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/);

        if (timeMatch && currentDayIdx !== -1) {
            let start = timeMatch[1].replace('.', ':');
            let end = timeMatch[2].replace('.', ':');

            // The course info is usually AROUND this time line.
            // In KUSIS/Hub copy paste, it's often:
            // "COMP101 ..."
            // "10:00 - 11:15"
            // OR
            // "10:00 - 11:15"
            // "COMP101 ..."

            // Heuristic: Check Previous Line and Next Line
            let title = "Ders";

            // Check Previous Line for Code (Most common in vertical lists)
            if (i > 0) {
                const prev = lines[i - 1];
                if (prev.match(/\b[A-Z]{2,4}\s?\d{3,4}\b/) && !dayKeywords[prev.toLowerCase()]) {
                    title = prev;
                }
            }

            // If prev line didn't look like a course, check Next Line
            if (title === "Ders" && i + 1 < lines.length) {
                const next = lines[i + 1];
                if (next.match(/\b[A-Z]{2,4}\s?\d{3,4}\b/)) {
                    title = next;
                }
            }

            // Add Event (for next 4 weeks)
            const d = getStartOfWeek(new Date());
            d.setDate(d.getDate() + (currentDayIdx - 1));

            for (let w = 0; w < 4; w++) {
                const eventDate = new Date(d);
                eventDate.setDate(d.getDate() + (w * 7));
                const key = getDateKey(eventDate);

                if (!events[key]) events[key] = [];
                events[key].push({
                    id: Date.now() + Math.random(),
                    title: title,
                    startTime: start,
                    endTime: end,
                    category: 'koc'
                });
                addedCount++;
            }
        }
    }

    if (addedCount > 0) {
        validateAndCleanEvents();
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        render();
        importModal.classList.add('hidden');
        alert(`${addedCount} ders eklendi.`);
    } else {
        alert("Ders programı formatı algılanamadı. Lütfen önce günlerin, sonra saatlerin olduğu bir metin yapıştırın.");
    }
}
