// State
let currentDate = new Date();
let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};

// DOM Elements
const monthYearText = document.getElementById('monthYear');
const calendarGrid = document.getElementById('calendar');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const todayBtn = document.getElementById('todayBtn');
const modal = document.getElementById('eventModal');
const closeModalBtn = document.querySelector('.close-btn');
const saveEventBtn = document.getElementById('saveEventBtn');
const eventTitleInput = document.getElementById('eventTitle');
const eventTimeInput = document.getElementById('eventTime');

const eventListContainer = document.getElementById('eventList');

// Import Elements
const importBtn = document.getElementById('importBtn');
const importModal = document.getElementById('importModal');
const closeImportBtn = document.querySelector('.close-import-btn');
const importText = document.getElementById('importText');
const processImportBtn = document.getElementById('processImportBtn');

let selectedDateKey = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();

    prevBtn.addEventListener('click', () => changeMonth(-1));
    nextBtn.addEventListener('click', () => changeMonth(1));
    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });

    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    saveEventBtn.addEventListener('click', saveEvent);


    // Import Listeners
    importBtn.addEventListener('click', () => importModal.classList.remove('hidden'));
    closeImportBtn.addEventListener('click', () => importModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === importModal) importModal.classList.add('hidden');
    });
    processImportBtn.addEventListener('click', processImport);
});

// Logic
function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYearText.textContent = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(currentDate);

    // First day of the month
    const firstDay = new Date(year, month, 1);
    const startingDay = (firstDay.getDay() + 6) % 7; // Adjust for Monday start (0=Mon, 6=Sun) - JS default 0=Sun

    // Days in Month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    calendarGrid.innerHTML = '';

    // Empty slots for previous month days
    for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('day', 'empty');
        calendarGrid.appendChild(emptyCell);
    }

    // Days
    const today = new Date();

    for (let i = 1; i <= daysInMonth; i++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day');

        // Date Key: YYYY-MM-DD
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayCell.dataset.date = dateKey;

        // Check if today
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayCell.classList.add('today');
        }

        // Day Number
        const dayNum = document.createElement('div');
        dayNum.classList.add('day-number');
        dayNum.textContent = i;
        dayCell.appendChild(dayNum);

        // Render Dots for Events
        const cellEvents = events[dateKey] || [];
        if (cellEvents.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.classList.add('event-dots');
            cellEvents.forEach(evt => {
                const dot = document.createElement('span');
                dot.classList.add('dot', evt.category);
                dotsContainer.appendChild(dot);
            });
            dayCell.appendChild(dotsContainer);
        }

        // Click Event
        dayCell.addEventListener('click', () => openModal(dateKey));

        calendarGrid.appendChild(dayCell);
    }
}

function openModal(dateKey) {
    selectedDateKey = dateKey;
    const [y, m, d] = dateKey.split('-');
    /* document.getElementById('modalDate').textContent = `${d}.${m}.${y} Etkinlikleri`; // Optional formatting */
    document.getElementById('modalDate').textContent = new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

    eventTitleInput.value = '';
    eventTimeInput.value = '';

    renderEventList(dateKey);
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    selectedDateKey = null;
}

function saveEvent() {
    if (!selectedDateKey) return;

    const title = eventTitleInput.value.trim();
    const time = eventTimeInput.value;
    const category = document.querySelector('input[name="category"]:checked').value;

    if (!title) {
        alert('Lütfen etkinlik adı giriniz.');
        return;
    }

    if (!events[selectedDateKey]) {
        events[selectedDateKey] = [];
    }

    events[selectedDateKey].push({
        id: Date.now(),
        title,
        time,
        category
    });

    // Save to LocalStorage
    localStorage.setItem('calendarEvents', JSON.stringify(events));

    // Update UI
    renderEventList(selectedDateKey);
    renderCalendar(); // Re-render to show dots

    // Clear inputs (optional but good UX to keep open for multiple adds)
    eventTitleInput.value = '';
    eventTimeInput.value = '';
}

function renderEventList(dateKey) {
    eventListContainer.innerHTML = '';
    const dayEvents = events[dateKey] || [];

    // Sort by time
    dayEvents.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    dayEvents.forEach(evt => {
        const item = document.createElement('div');
        item.classList.add('event-item');
        item.style.borderLeft = `4px solid var(--color-${evt.category})`;

        const timeSpan = document.createElement('span');
        timeSpan.style.fontSize = '0.8rem';
        timeSpan.style.color = '#aaa';
        timeSpan.textContent = evt.time || 'Tüm Gün';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = evt.title;

        item.appendChild(timeSpan);
        item.appendChild(titleSpan);
        eventListContainer.appendChild(item);
    });
}

// Course Import Logic
function processImport() {
    const text = importText.value;
    if (!text) return;

    const lines = text.split('\n');
    const dayMap = {
        'pazartesi': 1, 'monday': 1, 'mon': 1, 'pzt': 1,
        'salı': 2, 'tuesday': 2, 'tue': 2, 'sal': 2,
        'çarşamba': 3, 'wednesday': 3, 'wed': 3, 'çar': 3,
        'perşembe': 4, 'thursday': 4, 'thu': 4, 'per': 4,
        'cuma': 5, 'friday': 5, 'fri': 5, 'cum': 5,
        'cumartesi': 6, 'saturday': 6, 'sat': 6, 'cmt': 6,
        'pazar': 0, 'sunday': 0, 'sun': 0, 'paz': 0
    };

    let addedCount = 0;

    // Simple parser: Look for lines containing day names and time ranges
    lines.forEach(line => {
        const lowerLine = line.toLowerCase();

        // Find Day
        let dayOfWeek = -1;
        for (const [key, val] of Object.entries(dayMap)) {
            if (lowerLine.includes(key)) {
                dayOfWeek = val;
                break;
            }
        }
        if (dayOfWeek === -1) return;

        // Find Time (HH:MM)
        const timeMatch = line.match(/(\d{1,2}:\d{2})/);
        const time = timeMatch ? timeMatch[0] : '';

        // Find Course Code (e.g., ABC 101 or ABC101)
        // Look for 2-4 uppercase letters followed by optional space and 3-4 digits
        const codeMatch = line.match(/\b[A-Z]{2,4}\s?\d{3,4}\b/);
        const title = codeMatch ? codeMatch[0] : (line.length > 20 ? line.substring(0, 20) + '...' : line);

        if (dayOfWeek !== -1 && title) {
            // Add for next 4 weeks
            const today = new Date();
            // Start from current week's Monday (or today)
            // Let's find the FIRST occurrence of this day from today
            let d = new Date();
            d.setDate(d.getDate() + (dayOfWeek + 7 - d.getDay()) % 7);

            // If the calculated day is today but the time has passed? Ignore complexity for now.

            for (let i = 0; i < 4; i++) {
                // Clone date
                const eventDate = new Date(d);
                eventDate.setDate(d.getDate() + (i * 7));

                const year = eventDate.getFullYear();
                const month = String(eventDate.getMonth() + 1).padStart(2, '0');
                const day = String(eventDate.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`;

                if (!events[dateKey]) events[dateKey] = [];

                // Avoid duplicates usually, but simple push for now
                events[dateKey].push({
                    id: Date.now() + Math.random(),
                    title: title,
                    time: time,
                    category: 'koc'
                });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        renderCalendar();
        importModal.classList.add('hidden');
        importText.value = '';
        alert(`${addedCount} ders eklendi (4 haftalık).`);
    } else {
        alert('Ders programı formatı algılanamadı. Lütfen içinde Gün ve Saat geçen bir metin yapıştırın.');
    }
}
