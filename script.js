import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// The firebaseConfig object is now loaded from the external config.js file
// Ensure that config.js exists and is included in your index.html before this script.

// Initialize Firebase
let app, auth, db;
let appId = 'default-attendance-app'; // Default value

try {
    // Check if firebaseConfig is defined globally
    if (typeof firebaseConfig === 'undefined' || !firebaseConfig) {
        console.error("FATAL ERROR: 'firebaseConfig' is not defined. Make sure your 'config.js' file is being loaded correctly before script.js and has no syntax errors.");
        throw new Error("Firebase config is not defined.");
    }

    // Check for essential keys
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("FATAL ERROR: Your 'firebaseConfig' object in 'config.js' is missing required properties like 'apiKey' or 'projectId'.");
        throw new Error("Firebase config is incomplete.");
    }
    
    console.log("Firebase config loaded successfully. Initializing Firebase...");
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = firebaseConfig.projectId; // Use the actual project ID
    console.log("Firebase initialized successfully.");

} catch (e) {
    console.error("Firebase initialization failed:", e);
    alert("FATAL ERROR: Could not connect to the backend. Please check the developer console (F12) for more details.");
}

// ========= Global State =========
let userData = null; 
let currentUser = null; 
let unsubscribe = null;
let currentDate = new Date();
let currentSetupDay = 'monday';
let currentEditDay = 'monday';

const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const tabDays = ['monday','tuesday','wednesday','thursday','friday','saturday'];

// ========= Helpers =========
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const hasAnyClass = (tt) => tt && tabDays.some(d => Array.isArray(tt[d]) && tt[d].length > 0);
const getDateKey = (date) => date.toISOString().split('T')[0];

function setActiveTab(containerSelector, day) {
    $$(`${containerSelector} .day-tab`).forEach(t => t.classList.remove('active'));
    const tab = $(`${containerSelector} [data-day="${day}"]`);
    if (tab) tab.classList.add('active');
}

const isLocked = (dateKey) => !!(userData?.attendanceLock?.[dateKey]);

// ========= App Initialization & Auth State Management =========
document.addEventListener('DOMContentLoaded', () => {
    updateCurrentDateDisplay();
    setupEventListeners();
    populateStaticElements();
    // Only set up auth listener if initialization was successful
    if (auth) {
        onAuthStateChanged(auth, user => {
            if (user) {
                currentUser = user;
                setupRealtimeListener(user.uid);
            } else {
                currentUser = null;
                userData = null;
                if (unsubscribe) unsubscribe();
                showLogin();
            }
        });
    }
});

function setupRealtimeListener(uid) {
    const userDocRef = doc(db, "artifacts", appId, "users", uid);
    unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            userData = doc.data();
            // Ensure subjects object exists for backward compatibility
            if (!userData.subjects) {
                userData.subjects = {};
            }
            if ($('#mainApp').classList.contains('hidden') && $('#setupScreen').classList.contains('hidden')) {
                if (hasAnyClass(userData.timetable)) showMainApp();
                else showSetup();
            }
            refreshCurrentView();
        } else {
            const initialData = {
                timetable: { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[] },
                subjects: {}, // New object to store subject-specific data
                attendance: {}, attendanceLock: {}, holidays: {}
            };
            setDoc(userDocRef, initialData).then(() => {
                userData = initialData;
                showSetup();
            });
        }
    });
}

const refreshCurrentView = () => {
    if (!$('#attendanceSection').classList.contains('hidden')) generateAttendanceGrid();
    else if (!$('#statsSection').classList.contains('hidden')) generateStats();
    else if (!$('#profileSection').classList.contains('hidden')) showProfile();
    else if (!$('#timetableEditSection').classList.contains('hidden')) showTimetableEdit();
};

async function saveData() {
    if (!currentUser || !userData) return;
    const userDocRef = doc(db, "artifacts", appId, "users", currentUser.uid);
    try {
        await setDoc(userDocRef, userData);
    } catch (error) {
        console.error("Error saving data:", error);
        alert("Could not save your changes. Please check your connection.");
    }
}

// ========= Auth Functions =========
async function signInWithGoogle() {
    if (!auth) {
        console.error("Auth is not initialized, cannot sign in.");
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google Sign-In failed:", error);
        alert("Could not sign in with Google. Please try again.");
    }
}

const logout = () => signOut(auth).catch(err => alert("Error signing out."));

// ========= Screen Navigation =========
const hideAllScreens = () => $$('#loginScreen, #setupScreen, #mainApp').forEach(s => s.classList.add('hidden'));
const showLogin = () => { hideAllScreens(); $('#loginScreen').classList.remove('hidden'); };

function showSetup(){
    hideAllScreens();
    $('#setupScreen').classList.remove('hidden');
    currentSetupDay = 'monday';
    setActiveTab('#setupTabs', 'monday');
    loadSetupDay('monday');
}
function showMainApp(){
    hideAllScreens();
    $('#mainApp').classList.remove('hidden');
    showAttendance();
}

// ========= Timetable Setup & Edit =========
function switchSetupDay(day) {
    saveCurrentSetupDay();
    currentSetupDay = day;
    setActiveTab('#setupTabs', day);
    loadSetupDay(day);
}

function saveCurrentSetupDay() {
    if (!userData) return;
    const num = parseInt($('#setupNumPeriods').value) || 0;
    userData.timetable[currentSetupDay] = Array.from({length: num}, (_, i) => {
        const el = $(`#setupPeriod${i+1}`);
        const subjectName = (el?.value.trim());
        if (!subjectName) return null; // Store null for blank subjects
        // Initialize subject in the subjects object if it's new
        const subjectKey = subjectName.toLowerCase();
        if (!userData.subjects[subjectKey]) {
            userData.subjects[subjectKey] = {
                displayName: subjectName,
                initialAttended: 0,
                initialHeld: 0
            };
        }
        return subjectName;
    }).filter(Boolean); // Filter out null values
}

function loadSetupDay(day) {
    const tt = userData?.timetable[day] || [];
    $('#setupNumPeriods').value = String(tt.length);
    generatePeriods($('#setupPeriods'), 'setupPeriod', tt.length);
    tt.forEach((s, i) => {
        const el = $(`#setupPeriod${i+1}`);
        if (el) el.value = s;
    });
}

function generatePeriods(container, idPrefix, num) {
    container.innerHTML = '';
    if (num == 0) {
        container.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">No classes on this day</p>';
        return;
    }
    for (let i = 1; i <= num; i++) {
        container.innerHTML += `<div class="period-input"><label for="${idPrefix}${i}">Period ${i}</label><input type="text" id="${idPrefix}${i}" placeholder="Enter subject name"></div>`;
    }
}

function saveTimetable() {
    saveCurrentSetupDay();
    if (!hasAnyClass(userData.timetable)) return alert('Please add classes for at least one day.');
    saveData().then(() => {
        alert('Timetable saved successfully!');
        showMainApp();
    });
}

function showTimetableEdit() {
    $$('#mainNav .nav-btn').forEach(b => b.classList.remove('active'));
    $('#mainNav .nav-btn[data-section="timetableEditSection"]').classList.add('active');
    hideMainSections();
    $('#timetableEditSection').classList.remove('hidden');
    currentEditDay = 'monday';
    setActiveTab('#editTabs', 'monday');
    loadEditDay('monday');
    generateInitialCountsInputs();
};

function switchEditDay(day) {
    saveCurrentEditDay();
    currentEditDay = day;
    setActiveTab('#editTabs', day);
    loadEditDay(day);
}

function saveCurrentEditDay() {
    const num = parseInt($('#editNumPeriods').value) || 0;
    userData.timetable[currentEditDay] = Array.from({length: num}, (_, i) => {
         const el = $(`#editPeriod${i+1}`);
         const subjectName = (el?.value.trim());
         if (!subjectName) return null;
         const subjectKey = subjectName.toLowerCase();
         if (!userData.subjects[subjectKey]) {
            userData.subjects[subjectKey] = {
                displayName: subjectName,
                initialAttended: 0,
                initialHeld: 0
            };
         }
         return subjectName;
    }).filter(Boolean);
}

function loadEditDay(day) {
    const tt = userData.timetable[day] || [];
    $('#editNumPeriods').value = String(tt.length);
    generatePeriods($('#editPeriods'), 'editPeriod', tt.length);
    tt.forEach((s, i) => {
        const el = $(`#editPeriod${i+1}`);
        if (el) el.value = s;
    });
}

function generateInitialCountsInputs() {
    const container = $('#initialCountsContainer');
    container.innerHTML = '';
    const allSubjects = new Map();
    Object.values(userData.timetable).flat().forEach(sub => {
        if(sub) allSubjects.set(sub.toLowerCase(), sub);
    });

    if (allSubjects.size === 0) {
        container.innerHTML = `<p style="text-align:center;color:#666;">Add subjects to your timetable first.</p>`;
        return;
    }

    [...allSubjects.values()].sort().forEach(subjectName => {
        const subjectKey = subjectName.toLowerCase();
        const subjectData = userData.subjects[subjectKey] || { initialAttended: 0, initialHeld: 0 };
        
        container.innerHTML += `
            <div class="initial-count-item">
                <h5>${subjectName}</h5>
                <div class="initial-count-inputs">
                    <input type="number" class="initial-attended" data-subject-key="${subjectKey}" value="${subjectData.initialAttended}" placeholder="Attended">
                    <input type="number" class="initial-held" data-subject-key="${subjectKey}" value="${subjectData.initialHeld}" placeholder="Total Held">
                </div>
            </div>
        `;
    });
}

function updateTimetable() {
    saveCurrentEditDay();

    // Save initial counts
    $$('.initial-count-item').forEach(item => {
        const attendedInput = item.querySelector('.initial-attended');
        const heldInput = item.querySelector('.initial-held');
        const subjectKey = attendedInput.dataset.subjectKey;
        
        if (userData.subjects[subjectKey]) {
            userData.subjects[subjectKey].initialAttended = parseInt(attendedInput.value) || 0;
            userData.subjects[subjectKey].initialHeld = parseInt(heldInput.value) || 0;
        }
    });

    saveData().then(() => {
        alert('Timetable and initial counts updated successfully!');
        showAttendance();
    });
}

// ========= Main App Section Navigation =========
const hideMainSections = () => $$('#attendanceSection, #statsSection, #timetableEditSection, #profileSection').forEach(s => s.classList.add('hidden'));

const showAttendance = () => {
    $$('#mainNav .nav-btn').forEach(b => b.classList.remove('active'));
    $('#mainNav .nav-btn[data-section="attendanceSection"]').classList.add('active');
    hideMainSections();
    $('#attendanceSection').classList.remove('hidden');
    generateAttendanceGrid();
};

const showStats = () => {
    $$('#mainNav .nav-btn').forEach(b => b.classList.remove('active'));
    $('#mainNav .nav-btn[data-section="statsSection"]').classList.add('active');
    hideMainSections();
    $('#statsSection').classList.remove('hidden');
    generateStats();
};

const showProfile = () => {
    $$('#mainNav .nav-btn').forEach(b => b.classList.remove('active'));
    $('#mainNav .nav-btn[data-section="profileSection"]').classList.add('active');
    hideMainSections();
    $('#profileSection').classList.remove('hidden');

    if (currentUser) {
        $('#profilePicture').src = currentUser.photoURL || 'https://placehold.co/100x100/E0E7FF/4F46E5?text=User';
        $('#profileName').textContent = currentUser.displayName || 'Anonymous User';
        $('#profileEmail').textContent = currentUser.email || 'No email provided';
    }
};

// ========= Date Handling =========
const updateCurrentDateDisplay = () => $('#currentDate').textContent = currentDate.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
function changeDate(d) {
    currentDate.setDate(currentDate.getDate() + d);
    updateCurrentDateDisplay();
    generateAttendanceGrid();
}
const getCurrentDayName = () => days[currentDate.getDay()];

// ========= Attendance & Locking =========
function generateAttendanceGrid() {
    const dateKey = getDateKey(currentDate);
    const currentDay = getCurrentDayName();
    const timetable = userData?.timetable[currentDay] || [];
    const saved = userData?.attendance[dateKey] || {};
    const locked = isLocked(dateKey);
    const isHoliday = userData?.holidays?.[dateKey];

    const holidayBtn = $('#markHolidayBtn');
    if (isHoliday) {
        holidayBtn.textContent = 'Unmark as Holiday';
        holidayBtn.classList.add('btn-secondary');
    } else {
        holidayBtn.textContent = 'Mark Today as Holiday';
        holidayBtn.classList.remove('btn-secondary');
    }

    $('#dayInfo').innerHTML = `<div class="day-name">Day: ${cap(currentDay)}</div><div style="margin-top:5px;color:#666;">Date: ${currentDate.toDateString()}</div>`;
    const grid = $('#attendanceGrid');
    grid.innerHTML = '';
    
    if (isHoliday) {
        grid.innerHTML = '<div class="no-classes">Marked as a Holiday</div>';
        $('#attendanceActions').innerHTML = '';
        return;
    }
    
    if (timetable.length === 0) {
        grid.innerHTML = '<div class="no-classes">No classes today</div>';
    } else {
        timetable.forEach((subject, i) => {
            const timetableSubject = subject;
            const savedEntry = saved[i] || null;
            const displaySubject = savedEntry?.subject || timetableSubject;

            const presentActive = savedEntry?.present ? 'present-btn active' : 'present-btn';
            const absentActive  = savedEntry?.present === false ? 'absent-btn active' : 'absent-btn';
            const disabledAttr  = locked ? 'disabled' : '';
            
            grid.innerHTML += `
                <div class="period-card">
                    <div class="period-number">${i+1}</div>
                    <div class="period-card-header">
                        <h4>${displaySubject}</h4>
                        <button class="swap-btn" data-period="${i}" ${disabledAttr}>Swap</button>
                    </div>
                    <div class="attendance-controls">
                        <button class="attendance-btn ${presentActive}" ${disabledAttr} data-period="${i}" data-status="true" data-subject="${displaySubject}">Present</button>
                        <button class="attendance-btn ${absentActive}" ${disabledAttr} data-period="${i}" data-status="false" data-subject="${displaySubject}">Absent</button>
                    </div>
                </div>`;
        });
    }

    const actions = $('#attendanceActions');
    if (timetable.length === 0) {
        actions.innerHTML = '';
    } else if (locked) {
        actions.innerHTML = `<button id="unlockBtn" class="date-btn" style="padding:6px 10px;font-size:14px;width:auto;min-width:100px">Edit</button>`;
    } else {
        actions.innerHTML = `<button id="lockBtn" class="date-btn" style="padding:6px 10px;font-size:14px;width:auto;min-width:100px">Done</button>`;
    }
}

function markAttendance(periodIndex, isPresent, subject) {
    const dateKey = getDateKey(currentDate);
    if (isLocked(dateKey)) return;
    if (!userData.attendance[dateKey]) userData.attendance[dateKey] = {};

    const existingEntry = userData.attendance[dateKey][periodIndex];
    
    // If clicking the same button again, clear the entry
    if (existingEntry && existingEntry.present === isPresent) {
        delete userData.attendance[dateKey][periodIndex];
    } else {
        userData.attendance[dateKey][periodIndex] = { present: isPresent, subject: subject.trim() };
    }
    
    saveData();
}

const lockAttendance = () => {
    const dateKey = getDateKey(currentDate);
    if (!userData.attendanceLock) userData.attendanceLock = {};
    userData.attendanceLock[dateKey] = true;
    saveData();
};

const unlockAttendance = () => {
    const dateKey = getDateKey(currentDate);
    if (userData.attendanceLock) userData.attendanceLock[dateKey] = false;
    saveData();
};

function toggleHoliday() {
    const dateKey = getDateKey(currentDate);
    if (!userData.holidays) userData.holidays = {};
    
    // If the day is already a holiday, unmark it
    if (userData.holidays[dateKey]) {
        delete userData.holidays[dateKey];
    } else {
        userData.holidays[dateKey] = true;
    }
    saveData();
};

// ========= Statistics =========
function generateStats() {
    const attendance = userData?.attendance || {};
    const holidays = userData?.holidays || {};
    let totalHeld = 0;
    let totalPresent = 0;
    const bySubject = {};
    const subjectDisplayNames = {};
    const targetPercentage = 0.80;

    // Initialize with initial counts
    Object.keys(userData.subjects || {}).forEach(subjectKey => {
        const subjectData = userData.subjects[subjectKey];
        bySubject[subjectKey] = {
            held: subjectData.initialHeld || 0,
            present: subjectData.initialAttended || 0
        };
        subjectDisplayNames[subjectKey] = subjectData.displayName;
        totalHeld += subjectData.initialHeld || 0;
        totalPresent += subjectData.initialAttended || 0;
    });

    // Add tracked attendance
    Object.keys(attendance).forEach(dateKey => {
        if (holidays[dateKey]) return;
        Object.values(attendance[dateKey] || {}).forEach(entry => {
            if (!entry || !entry.subject) return;
            
            totalHeld++;
            if (entry.present) totalPresent++;
            
            const s = entry.subject;
            const s_key = s.trim().toLowerCase();
            
            if (!bySubject[s_key]) {
                bySubject[s_key] = {held:0, present:0};
                subjectDisplayNames[s_key] = s;
            }
            
            bySubject[s_key].held++;
            if (entry.present) bySubject[s_key].present++;
        });
    });

    const pct = totalHeld > 0 ? ((totalPresent / totalHeld) * 100).toFixed(1) : 0;
    $('#statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-number">${totalHeld}</div><div>Total Classes</div></div>
        <div class="stat-card"><div class="stat-number">${totalPresent}</div><div>Present</div></div>
        <div class="stat-card"><div class="stat-number">${totalHeld - totalPresent}</div><div>Absent</div></div>
        <div class="stat-card"><div class="stat-number">${pct}%</div><div>Overall Attendance</div></div>`;

    const overallStatusEl = $('#overallStatus');
    if (totalHeld === 0) {
        overallStatusEl.innerHTML = 'Mark some attendance to see your status.';
    } else {
        const overallPct = totalPresent / totalHeld;
        if (overallPct < targetPercentage) {
            let classesToAttend = 0;
            let tempPresent = totalPresent;
            let tempHeld = totalHeld;
            while ((tempPresent / tempHeld) < targetPercentage) {
                classesToAttend++;
                tempPresent++;
                tempHeld++;
            }
            overallStatusEl.innerHTML = `You need to attend the next <strong>${classesToAttend}</strong> classes to reach ${targetPercentage * 100}% overall attendance.`;
        } else {
            let classesToSkip = 0;
            let tempHeld = totalHeld;
            while ((totalPresent / (tempHeld + 1)) >= targetPercentage) {
                classesToSkip++;
                tempHeld++;
            }
            overallStatusEl.innerHTML = `You can skip the next <strong>${classesToSkip}</strong> classes and still maintain ${targetPercentage * 100}% overall attendance.`;
        }
    }

    const rows = Object.keys(bySubject).sort().map(s_key => {
        const displayName = subjectDisplayNames[s_key];
        const {held, present} = bySubject[s_key];
        const p = held > 0 ? (present / held) : 0;
        const p_display = (p * 100).toFixed(1);
        const badge = p >= 0.75 ? 'good-attendance' : (p >= 0.60 ? 'warning-attendance' : 'poor-attendance');
        
        let statusMessage = '<span>-</span>';
        if (held > 0) {
            if (p < targetPercentage) {
                let classesToAttend = 0;
                let tempPresent = present;
                let tempHeld = held;
                while ((tempPresent / tempHeld) < targetPercentage) {
                    classesToAttend++;
                    tempPresent++;
                    tempHeld++;
                }
                statusMessage = `<span style="color: var(--danger); font-weight: 600;">Attend next ${classesToAttend}</span>`;
            } else {
                let classesToSkip = 0;
                let tempHeld = held;
                while ((present / (tempHeld + 1)) >= targetPercentage) {
                    classesToSkip++;
                    tempHeld++;
                }
                statusMessage = `<span style="color: var(--success); font-weight: 600;">Can skip ${classesToSkip}</span>`;
            }
        }

        return `<tr>
                    <td>${displayName}</td>
                    <td>${held}</td>
                    <td>${present}</td>
                    <td><span class="attendance-percentage ${badge}">${p_display}%</span></td>
                    <td>${statusMessage}</td>
                </tr>`;
    }).join('');

    $('#subjectStats').innerHTML = `
        <table class="summary-table">
            <thead><tr><th>Subject</th><th>Classes Held</th><th>Present</th><th>Attendance</th><th>Status (for 80%)</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No attendance data yet</td></tr>'}</tbody>
        </table>`;
}

// ========= Modal Logic =========
function openSubjectModal(periodIndex) {
    const modal = $('#subjectModal');
    $('#modalTitle').textContent = `Change Subject for Period ${periodIndex + 1}`;
    
    const subjectMap = new Map();
    Object.values(userData.timetable).forEach(day => {
        day.forEach(sub => {
            if (sub && !subjectMap.has(sub.trim().toLowerCase())) {
                subjectMap.set(sub.trim().toLowerCase(), sub.trim());
            }
        });
    });
    const allSubjects = [...subjectMap.values()].sort();
    
    const select = $('#subjectSelect');
    select.innerHTML = allSubjects.map(sub => `<option value="${sub}">${sub}</option>`).join('');
    
    $('#saveSubjectBtn').dataset.period = periodIndex;
    modal.classList.remove('hidden');
}

function closeSubjectModal() {
    $('#subjectModal').classList.add('hidden');
}

function handleSubjectChange() {
    const periodIndex = $('#saveSubjectBtn').dataset.period;
    const newSubject = $('#subjectSelect').value;
    const dateKey = getDateKey(currentDate);

    if (!userData.attendance[dateKey]) userData.attendance[dateKey] = {};
    
    const existingEntry = userData.attendance[dateKey][periodIndex] || {};
    existingEntry.subject = newSubject;
    userData.attendance[dateKey][periodIndex] = existingEntry;
    
    saveData();
    closeSubjectModal();
}

// ========= Reset Modal Logic =========
function openResetModal() {
    $('#resetModal').classList.remove('hidden');
}

function closeResetModal() {
    $('#resetModal').classList.add('hidden');
}

function handleResetData() {
    // Reset attendance data, holidays, locks, and timetable
    userData.attendance = {};
    userData.holidays = {};
    userData.attendanceLock = {};
    userData.subjects = {};
    userData.timetable = { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[] };

    saveData().then(() => {
        alert('Your semester data and timetable have been successfully reset.');
        closeResetModal();
        // Go back to the setup screen for a fresh start
        showSetup();
    });
}

// ========= Event Listeners =========
function setupEventListeners() {
    // Auth
    $('#googleSignInBtn').addEventListener('click', signInWithGoogle);
    $('#profileLogoutBtn').addEventListener('click', logout);
    $('#resetDataBtn').addEventListener('click', openResetModal);
    
    // Setup
    $('#setupTabs').addEventListener('click', e => { if (e.target.matches('.day-tab')) switchSetupDay(e.target.dataset.day) });
    $('#setupNumPeriods').addEventListener('change', () => generatePeriods($('#setupPeriods'), 'setupPeriod', $('#setupNumPeriods').value));
    $('#saveTimetableBtn').addEventListener('click', saveTimetable);
    $('#logoutBtnSetup').addEventListener('click', logout);

    // Main Nav
    $('#mainNav').addEventListener('click', e => {
        if (e.target.matches('.nav-btn')) {
            const section = e.target.dataset.section;
            if (section === 'attendanceSection') showAttendance();
            else if (section === 'statsSection') showStats();
            else if (section === 'timetableEditSection') showTimetableEdit();
            else if (section === 'profileSection') showProfile();
        }
    });
    
    // Attendance
    $('#prevDayBtn').addEventListener('click', () => changeDate(-1));
    $('#nextDayBtn').addEventListener('click', () => changeDate(1));
    $('#markHolidayBtn').addEventListener('click', toggleHoliday); // Changed to toggleHoliday
    $('#attendanceGrid').addEventListener('click', e => {
        if (e.target.matches('.attendance-btn')) {
            const { period, status, subject } = e.target.dataset;
            markAttendance(parseInt(period), status === 'true', subject);
        }
        if (e.target.matches('.swap-btn')) {
            openSubjectModal(parseInt(e.target.dataset.period));
        }
    });
    $('#attendanceSection').addEventListener('click', e => {
        if (e.target.matches('#lockBtn')) lockAttendance();
        if (e.target.matches('#unlockBtn')) unlockAttendance();
    });

    // Edit
    $('#editTabs').addEventListener('click', e => { if (e.target.matches('.day-tab')) switchEditDay(e.target.dataset.day) });
    $('#editNumPeriods').addEventListener('change', () => generatePeriods($('#editPeriods'), 'editPeriod', $('#editNumPeriods').value));
    $('#updateTimetableBtn').addEventListener('click', updateTimetable);

    // Modals
    $('#saveSubjectBtn').addEventListener('click', handleSubjectChange);
    $('#cancelSubjectBtn').addEventListener('click', closeSubjectModal);
    $('#closeModalBtn').addEventListener('click', closeSubjectModal);
    $('#confirmResetBtn').addEventListener('click', handleResetData);
    $('#cancelResetBtn').addEventListener('click', closeResetModal);
    $('#closeResetModalBtn').addEventListener('click', closeResetModal);
}

// ========= Dynamic Content Population =========
function populateStaticElements() {
    // Period selectors
    const periodOptions = Array.from({length: 11}, (_, i) => `<option value="${i}">${i === 0 ? 'No Classes' : `${i} Period${i > 1 ? 's' : ''}`}</option>`).join('');
    $('#setupNumPeriods').innerHTML = periodOptions;
    $('#editNumPeriods').innerHTML = periodOptions;
    
    // Day tabs
    const dayTabsHTML = tabDays.map(day => `<div class="day-tab" data-day="${day}">${cap(day)}</div>`).join('');
    $('#setupTabs').innerHTML = dayTabsHTML;
    $('#editTabs').innerHTML = dayTabsHTML;
    
    // Main Nav
    $('#mainNav').innerHTML = `
        <button class="nav-btn" data-section="attendanceSection">Mark Attendance</button>
        <button class="nav-btn" data-section="statsSection">Statistics</button>
        <button class="nav-btn" data-section="timetableEditSection">Edit Timetable</button>
        <button class="nav-btn" data-section="profileSection">Profile</button>
    `;
}