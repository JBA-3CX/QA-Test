// --- DATA MANAGEMENT ---
let suites = JSON.parse(localStorage.getItem('qa_suites')) || [];
let history = JSON.parse(localStorage.getItem('qa_history')) || [];
let activeSession = JSON.parse(localStorage.getItem('qa_active_session')) || null; // NEW: Session Recovery
let editingTests = []; 
let undoStack = []; 
let currentRunState = [];
let activeSuiteId = null;
let dragSrcIndex = null;

function saveData() {
    localStorage.setItem('qa_suites', JSON.stringify(suites));
    localStorage.setItem('qa_history', JSON.stringify(history));
    localStorage.setItem('qa_active_session', JSON.stringify(activeSession)); // Save progress
}

function pushUndo() {
    undoStack.push(JSON.parse(JSON.stringify(editingTests)));
    if (undoStack.length > 30) undoStack.shift();
}

// --- NAVIGATION ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('onclick').includes(viewId)) item.classList.add('active');
    });
    if (viewId === 'run') showPicker();
    if (viewId === 'suites') renderSuites();
    if (viewId === 'history') renderHistory();
}

// --- RUNNER LOGIC ---
function showPicker() {
    document.getElementById('suite-picker-section').classList.remove('hidden');
    document.getElementById('active-test-section').classList.add('hidden');
    
    const grid = document.getElementById('run-suite-grid');
    let html = '';

    // NEW: Resume Button if session exists
    if (activeSession) {
        html += `
        <div class="card" style="grid-column: 1 / -1; background: #fff9e6; border: 1px solid #ffcc00; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="color: #856404;">⚠️ Unfinished Session Detected</strong><br>
                <small>Suite: ${activeSession.suiteName} (${activeSession.progress}%)</small>
            </div>
            <button class="btn-primary" style="background:#ffcc00; color:#000;" onclick="resumeSession()">Resume Session</button>
        </div>`;
    }

    html += suites.map(s => `
        <div class="card" style="cursor:pointer;" onclick="startRun('${s.id}')">
            <h3 style="color:var(--primary)">${s.name}</h3>
            <p style="color:var(--text-muted); font-size:14px; margin-top:5px">${s.tests.length} steps</p>
        </div>
    `).join('');
    
    grid.innerHTML = html;
}

function startRun(id) {
    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    if (!suite) return;

    document.getElementById('active-suite-name').innerText = suite.name;
    currentRunState = suite.tests.map(t => ({ ...t, status: 'Pending', notes: '' }));
    
    // Create new session
    activeSession = { suiteId: id, suiteName: suite.name, state: currentRunState, progress: 0 };
    saveData();

    document.getElementById('suite-picker-section').classList.add('hidden');
    document.getElementById('active-test-section').classList.remove('hidden');
    renderTestRun();
}

function resumeSession() {
    activeSuiteId = activeSession.suiteId;
    currentRunState = activeSession.state;
    document.getElementById('active-suite-name').innerText = activeSession.suiteName;
    document.getElementById('suite-picker-section').classList.add('hidden');
    document.getElementById('active-test-section').classList.remove('hidden');
    renderTestRun();
}

function renderTestRun() {
    const container = document.getElementById('test-container');
    container.innerHTML = currentRunState.map((test, index) => `
        <div class="test-row level-${test.level}">
            <span class="test-text">${test.text || 'Untitled'}</span>
            <div class="test-controls">
                <button class="status-btn p ${test.status==='Pass'?'active':''}" onclick="updateStatus(${index}, 'Pass')">Pass</button>
                <button class="status-btn f ${test.status==='Fail'?'active':''}" onclick="updateStatus(${index}, 'Fail')">Fail</button>
                <input type="text" class="note-input" placeholder="Note..." value="${test.notes}" onchange="updateNoteState(${index}, this.value)">
            </div>
        </div>
    `).join('');
}

function updateStatus(i, s) { 
    currentRunState[i].status = s;
    
    // Update session progress
    const completed = currentRunState.filter(x => x.status !== 'Pending').length;
    activeSession.progress = Math.round((completed / currentRunState.length) * 100);
    activeSession.state = currentRunState;
    saveData();
    
    renderTestRun(); 
}

function updateNoteState(i, val) {
    currentRunState[i].notes = val;
    activeSession.state = currentRunState;
    saveData();
}

function generateReport() {
    const suite = suites.find(s => s.id === activeSuiteId);
    
    // Tracking Failures for Smart Sequencing
    currentRunState.forEach(test => {
        if (test.status === 'Fail') {
            const suiteTest = suite.tests.find(t => t.text === test.text);
            if (suiteTest) suiteTest.failCount = (suiteTest.failCount || 0) + 1;
        }
    });

    const fails = currentRunState.filter(s => s.status === 'Fail');
    let report = `## Regression: ${suite.name}\n\n`;
    if (fails.length) report += `### 🚨 FAILS\n` + fails.map(f => `* **${f.text}**: ${f.notes}`).join('\n') + "\n\n";
    report += `### ✅ PASSES\n` + currentRunState.filter(s=>s.status==='Pass').map(p => `* ${p.text}`).join('\n');

    navigator.clipboard.writeText(report).then(() => {
        history.unshift({ id: Date.now(), date: new Date().toLocaleString(), suiteName: suite.name, report });
        activeSession = null; // Clear session on completion
        saveData(); 
        alert("Report copied and session cleared!");
        switchView('run');
    });
}

// [BUILDER LOGIC REMAINS SAME AS PREVIOUS STABLE VERSION]
// ... include renderEditor, moveDepth, deleteLine, addLine, saveSuite, etc ...
