// Initialize from LocalStorage
let suites = JSON.parse(localStorage.getItem('qa_suites')) || [];
let history = JSON.parse(localStorage.getItem('qa_history')) || [];
let currentRunState = [];
let activeSuiteId = null;

function saveData() {
    localStorage.setItem('qa_suites', JSON.stringify(suites));
    localStorage.setItem('qa_history', JSON.stringify(history));
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    // Handle nav highlight even if event isn't passed (for initial load)
    if (window.event) {
        event.currentTarget.classList.add('active');
    }

    if (viewId === 'run') showPicker();
    if (viewId === 'suites') renderSuites();
    if (viewId === 'history') renderHistory();
}

// --- RUNNER LOGIC ---
function showPicker() {
    document.getElementById('suite-picker-section').classList.remove('hidden');
    document.getElementById('active-test-section').classList.add('hidden');
    const grid = document.getElementById('run-suite-grid');
    const emptyMsg = document.getElementById('run-empty-msg');
    
    if (suites.length === 0) {
        grid.innerHTML = "";
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        grid.innerHTML = suites.map(s => `
            <div class="suite-select-card" onclick="startRun('${s.id}')">
                <h3 style="color: var(--primary); margin-bottom: 5px;">${s.name}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">${s.tests.length} Cases</p>
            </div>
        `).join('');
    }
}

function startRun(id) {
    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    document.getElementById('active-suite-name').innerText = suite.name;
    currentRunState = suite.tests.map(t => ({ name: t, status: 'Pending', notes: '' }));
    document.getElementById('suite-picker-section').classList.add('hidden');
    document.getElementById('active-test-section').classList.remove('hidden');
    document.getElementById('jira-output').style.display = 'none';
    renderTestRun();
}

function renderTestRun() {
    const container = document.getElementById('test-container');
    container.innerHTML = currentRunState.map((test, index) => `
        <div class="test-row">
            <div style="font-weight: 600; font-size: 1.05rem;">${test.name}</div>
            <div class="test-controls">
                <button class="status-btn ${test.status === 'Pass' ? 'active' : ''}" data-status="Pass" onclick="updateStatus(${index}, 'Pass')">Pass</button>
                <button class="status-btn ${test.status === 'Fail' ? 'active' : ''}" data-status="Fail" onclick="updateStatus(${index}, 'Fail')">Fail</button>
                <button class="status-btn ${test.status === 'Skip' ? 'active' : ''}" data-status="Skip" onclick="updateStatus(${index}, 'Skip')">Skip</button>
                <input type="text" placeholder="Add Note / JIRA Key..." value="${test.notes}" onchange="updateNotes(${index}, this.value)" style="margin-bottom:0; flex-grow:1; min-width: 180px;">
            </div>
        </div>
    `).join('');
}

function updateStatus(i, s) { currentRunState[i].status = s; renderTestRun(); }
function updateNotes(i, n) { currentRunState[i].notes = n; }

function generateReport() {
    const suite = suites.find(s => s.id === activeSuiteId);
    const fails = currentRunState.filter(s => s.status === 'Fail');
    const passes = currentRunState.filter(s => s.status === 'Pass');

    let report = `h2. Regression Run: ${suite.name}\n\n`;
    if (fails.length) {
        report += "{panel:title=🚨 Fails|titleBGColor=#ffebe6|borderColor=#ff5630}\n" + fails.map(f => `* *${f.name}*: ${f.notes || 'No notes'}`).join('\n') + "\n{panel}\n\n";
    }
    report += "{panel:title=✅ Passes|titleBGColor=#e3fcef|borderColor=#36b37e}\n" + passes.map(p => `* ${p.name} ${p.notes ? `(${p.notes})` : ''}`).join('\n') + "\n{panel}";

    const out = document.getElementById('jira-output');
    out.style.display = 'block'; out.value = report; out.select();
    document.execCommand('copy');
    
    history.unshift({ id: Date.now(), date: new Date().toLocaleString(), suiteName: suite.name, report: report });
    saveData();
    alert("Report copied and saved!");
}

// --- SUITE MANAGEMENT ---
function renderSuites() {
    const list = document.getElementById('suite-list');
    if (suites.length === 0) {
        list.innerHTML = `<div class="empty-state">No suites created yet.</div>`;
        return;
    }
    list.innerHTML = suites.map(s => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap:10px;">
            <div><strong>${s.name}</strong> <br><small>${s.tests.length} tests</small></div>
            <div style="display:flex; gap:8px;">
                <button class="btn-outline" onclick="editSuite('${s.id}')">Edit</button>
                <button class="btn-outline" onclick="exportSingleSuite('${s.id}')">📤 Export</button>
                <button class="btn-danger" onclick="deleteSuite('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function showSuiteEditor() { 
    document.getElementById('suite-editor').style.display = 'block'; 
    document.getElementById('edit-suite-id').value = '';
    document.getElementById('edit-suite-name').value = '';
    document.getElementById('edit-suite-tests').value = '';
}
function hideSuiteEditor() { document.getElementById('suite-editor').style.display = 'none'; }

function saveSuite() {
    const id = document.getElementById('edit-suite-id').value || Date.now().toString();
    const name = document.getElementById('edit-suite-name').value.trim();
    const tests = document.getElementById('edit-suite-tests').value.split('\n').filter(t => t.trim());
    if (!name || tests.length === 0) return alert("Missing name or tests.");
    const idx = suites.findIndex(s => s.id === id);
    if (idx > -1) suites[idx] = { id, name, tests };
    else suites.push({ id, name, tests });
    saveData(); hideSuiteEditor(); renderSuites();
}

function editSuite(id) {
    const s = suites.find(x => x.id === id);
    document.getElementById('edit-suite-id').value = s.id;
    document.getElementById('edit-suite-name').value = s.name;
    document.getElementById('edit-suite-tests').value = s.tests.join('\n');
    showSuiteEditor();
}

function deleteSuite(id) { if(confirm("Delete suite?")) { suites = suites.filter(s => s.id !== id); saveData(); renderSuites(); } }

function exportSingleSuite(id) {
    const suite = suites.find(s => s.id === id);
    const data = { type: 'single_suite', suite };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suite_${suite.name.replace(/\s+/g, '_')}.json`;
    a.click();
}

function importSingleSuite(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.type === 'single_suite') {
                let newSuite = imported.suite;
                newSuite.id = Date.now().toString();
                suites.push(newSuite);
                saveData(); renderSuites();
            }
        } catch (err) { alert("Error reading file."); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// --- HISTORY LOGIC ---
function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = history.map(h => `
        <div class="card">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <strong>${h.date} - ${h.suiteName}</strong>
                <button class="btn-danger" style="padding:4px 8px;" onclick="deleteHistory(${h.id})">Delete</button>
            </div>
            <textarea readonly style="height:80px; font-size:0.8rem;">${h.report}</textarea>
        </div>
    `).join('');
}
function deleteHistory(id) { if(confirm("Delete record?")) { history = history.filter(h => h.id !== id); saveData(); renderHistory(); } }

// --- GLOBAL SETTINGS ---
function exportData() {
    const data = { type: 'global_backup', suites, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `full_backup.json`;
    a.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const imported = JSON.parse(e.target.result);
        if (confirm("Overwrite all data?")) {
            suites = imported.suites || [];
            history = imported.history || [];
            saveData(); location.reload();
        }
    };
    reader.readAsText(file);
}

// Initial load
showPicker();