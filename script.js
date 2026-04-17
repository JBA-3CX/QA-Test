// --- DATA MANAGEMENT ---
let suites = JSON.parse(localStorage.getItem('qa_suites')) || [];
let history = JSON.parse(localStorage.getItem('qa_history')) || [];
let activeSession = JSON.parse(localStorage.getItem('qa_active_session')) || null;
let editingTests = []; 
let undoStack = []; 
let currentRunState = [];
let activeSuiteId = null;
let dragSrcIndex = null;

function saveData() {
    localStorage.setItem('qa_suites', JSON.stringify(suites));
    localStorage.setItem('qa_history', JSON.stringify(history));
    localStorage.setItem('qa_active_session', JSON.stringify(activeSession));
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

    const barContainer = document.getElementById('progress-bar-container');
    if (viewId === 'run') {
        barContainer.style.display = 'block';
        showPicker();
    } else {
        barContainer.style.display = 'none';
        if (viewId === 'suites') renderSuites();
        if (viewId === 'history') renderHistory();
    }
}

function updateProgressBar() {
    if (!activeSession) {
        document.getElementById('progress-bar-fill').style.width = '0%';
        return;
    }
    const completed = activeSession.state.filter(x => x.status !== 'Pending').length;
    const percent = Math.round((completed / activeSession.state.length) * 100);
    document.getElementById('progress-bar-fill').style.width = percent + '%';
}

// --- RUNNER LOGIC ---
function showPicker() {
    document.getElementById('suite-picker-section').classList.remove('hidden');
    document.getElementById('active-test-section').classList.add('hidden');
    const grid = document.getElementById('run-suite-grid');
    let html = '';

    if (activeSession) {
        html += `
        <div class="card" style="grid-column: 1 / -1; background: #fff9e6; border-color: #ffcc00; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="color: #856404;">⚠️ Resume Unfinished Session</strong><br>
                <span style="color: #6b778c;">${activeSession.suiteName} • ${activeSession.progress}%</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="status-btn" style="background:#fff; color:#ff5630; border-color:#ff5630;" onclick="cancelRun()">Discard Run</button>
                <button class="btn-primary" style="background:#ffcc00; color:#443300;" onclick="resumeSession()">Resume Work</button>
            </div>
        </div>`;
    }

    html += suites.map(s => `
        <div class="card" style="cursor:pointer;" onclick="startRun('${s.id}')">
            <h3 style="color:var(--primary);">${s.name}</h3>
            <p style="color:var(--text-light); font-size:14px;">${s.tests.length} Steps</p>
        </div>
    `).join('');
    grid.innerHTML = html;
    updateProgressBar();
}

function cancelRun() {
    if(confirm("Are you sure? This will delete all Pass/Fail progress for this specific run.")) {
        activeSession = null;
        saveData();
        showPicker();
    }
}

function startRun(id) {
    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    if (!suite) return;
    document.getElementById('active-suite-name').innerText = suite.name;
    currentRunState = suite.tests.map(t => ({ ...t, status: 'Pending', notes: '' }));
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

// NEW: Jump from Runner to Builder for the current suite
function editCurrentSuite() {
    const suiteId = activeSuiteId;
    switchView('suites');
    showSuiteEditor(suiteId);
}

function renderTestRun() {
    const container = document.getElementById('test-container');
    container.innerHTML = `
        <div style="margin-bottom: 15px; display:flex; gap:10px;">
            <button class="status-btn" onclick="editCurrentSuite()">⚙️ Edit Suite Requirements</button>
            <button class="status-btn" style="color: #ff5630;" onclick="cancelRun()">❌ Cancel Run</button>
        </div>
    ` + currentRunState.map((test, index) => {
        let bleedClass = test.status === 'Pass' ? 'passed' : (test.status === 'Fail' ? 'failed' : '');
        return `
            <div class="test-row level-${test.level} ${bleedClass}">
                <span class="test-text">${test.text || 'Untitled'}</span>
                <div class="test-controls">
                    <button class="status-btn p ${test.status==='Pass'?'active':''}" onclick="updateStatus(${index}, 'Pass')">Pass</button>
                    <button class="status-btn f ${test.status==='Fail'?'active':''}" onclick="updateStatus(${index}, 'Fail')">Fail</button>
                    <input type="text" class="note-input" placeholder="Notes..." value="${test.notes || ''}" onchange="updateNoteState(${index}, this.value)">
                </div>
            </div>
        `;
    }).join('');
    updateProgressBar();
}

function updateStatus(i, s) { 
    currentRunState[i].status = s;
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
    const fails = currentRunState.filter(s => s.status === 'Fail');
    const passes = currentRunState.filter(s => s.status === 'Pass');
    let report = `## Regression: ${suite.name}\n\n`;
    if (fails.length) report += `### 🚨 FAILS\n` + fails.map(f => `* **${f.text}**: ${f.notes || 'No notes'}`).join('\n') + "\n\n";
    report += `### ✅ PASSES\n` + passes.map(p => `* ${p.text}`).join('\n');
    navigator.clipboard.writeText(report).then(() => {
        history.unshift({ id: Date.now(), date: new Date().toLocaleString(), suiteName: suite.name, report });
        activeSession = null;
        saveData(); 
        alert("Markdown Report Copied!");
        switchView('run');
    });
}

// --- BUILDER LOGIC ---
function showSuiteEditor(id = null) {
    document.getElementById('suite-editor').style.display = 'block';
    undoStack = []; 
    if (id && typeof id === 'string') {
        const s = suites.find(x => x.id === id);
        document.getElementById('edit-suite-id').value = s.id;
        document.getElementById('edit-suite-name').value = s.name;
        editingTests = JSON.parse(JSON.stringify(s.tests));
    } else {
        document.getElementById('edit-suite-id').value = '';
        document.getElementById('edit-suite-name').value = '';
        editingTests = [{ text: '', level: 0 }];
    }
    renderEditor();
}

function renderEditor(focusIndex = null) {
    const container = document.getElementById('editor-items-list');
    container.innerHTML = ''; 
    editingTests.forEach((t, i) => {
        const row = document.createElement('div');
        row.className = 'editor-line';
        row.style.marginLeft = `${t.level * 30}px`;
        row.draggable = true;
        row.dataset.index = i;
        row.innerHTML = `
            <div class="grab-handle">⠿</div>
            <div style="display:flex; gap:2px;">
                <button class="status-btn" tabindex="-1" onclick="moveDepth(${i}, -1)">◀</button>
                <button class="status-btn" tabindex="-1" onclick="moveDepth(${i}, 1)">▶</button>
            </div>
            <input type="text" class="editor-input" tabindex="0" value="${t.text}" oninput="editingTests[${i}].text=this.value">
            <button tabindex="-1" onclick="deleteLine(${i})" style="border:none; background:none; color:#ff5630; cursor:pointer; padding:5px;">✕</button>
        `;
        const input = row.querySelector('input');
        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); if (undoStack.length > 0) { editingTests = undoStack.pop(); renderEditor(i); } }
            if (e.key === 'Enter') { e.preventDefault(); pushUndo(); editingTests.splice(i + 1, 0, { text: '', level: t.level }); renderEditor(i + 1); }
            if (e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); pushUndo(); moveDepth(i, 1, true); }
            if (e.ctrlKey && e.key === 'ArrowLeft') { e.preventDefault(); pushUndo(); moveDepth(i, -1, true); }
        });
        row.addEventListener('dragstart', handleDragStart);
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('drop', handleDrop);
        row.addEventListener('dragend', handleDragEnd);
        container.appendChild(row);
        if (focusIndex === i) input.focus();
    });
}

function handleDragStart(e) { dragSrcIndex = parseInt(this.dataset.index); this.classList.add('dragging'); }
function handleDragOver(e) { e.preventDefault(); return false; }
function handleDrop(e) {
    const targetIndex = parseInt(this.dataset.index);
    if (dragSrcIndex !== targetIndex) {
        pushUndo();
        const movedItem = editingTests.splice(dragSrcIndex, 1)[0];
        editingTests.splice(targetIndex, 0, movedItem);
        renderEditor();
    }
}
function handleDragEnd() { this.classList.remove('dragging'); }
function moveDepth(i, dir, keepFocus = false) { editingTests[i].level = Math.max(0, Math.min(3, editingTests[i].level + dir)); renderEditor(keepFocus ? i : null); }
function deleteLine(i) { pushUndo(); editingTests.splice(i, 1); renderEditor(); }
function addLine() { pushUndo(); editingTests.push({ text: '', level: 0 }); renderEditor(editingTests.length - 1); }

function saveSuite() {
    const name = document.getElementById('edit-suite-name').value;
    if(!name) return alert("Please name your suite");
    const id = document.getElementById('edit-suite-id').value || Date.now().toString();
    const idx = suites.findIndex(s => s.id === id);
    
    const newTestData = JSON.parse(JSON.stringify(editingTests));
    
    if (idx > -1) {
        suites[idx] = { id, name, tests: newTestData };
        // SMART MERGE: If this suite is currently being run, update the run state without wiping progress
        if (activeSession && activeSession.suiteId === id) {
            const oldState = activeSession.state;
            activeSession.state = newTestData.map(newStep => {
                const existing = oldState.find(os => os.text === newStep.text && os.level === newStep.level);
                return existing ? existing : { ...newStep, status: 'Pending', notes: '' };
            });
            activeSession.suiteName = name;
        }
    } else {
        suites.push({ id, name, tests: newTestData });
    }
    
    saveData(); 
    document.getElementById('suite-editor').style.display='none'; 
    renderSuites();
    
    // If we were editing the active suite, go back to the runner automatically
    if (activeSession && activeSession.suiteId === id) {
        switchView('run');
        resumeSession();
    }
}

function renderSuites() {
    document.getElementById('suite-list').innerHTML = suites.map(s => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center">
            <div style="font-weight:600;">${s.name} <br><small style="color:#6b778c;">${s.tests.length} Steps</small></div>
            <div style="display:flex; gap:8px;">
                <button class="status-btn" onclick="showSuiteEditor('${s.id}')">Edit</button>
                <button class="status-btn" onclick="exportSingleSuite('${s.id}')">Export</button>
                <button class="status-btn" style="color:#ff5630;" onclick="deleteSuite('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function deleteSuite(id) { if(confirm("Permanently delete suite?")) { suites = suites.filter(s => s.id !== id); saveData(); renderSuites(); } }

function exportSingleSuite(id) {
    const suite = suites.find(s => s.id === id);
    const blob = new Blob([JSON.stringify({ type: 'single_suite', suite })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `suite_${suite.name.replace(/\s+/g, '_')}.json`; a.click();
}

function importSingleSuite(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const d = JSON.parse(ev.target.result);
            if (d.type === 'single_suite') {
                const newSuite = d.suite;
                newSuite.id = Date.now().toString();
                if(suites.some(s => s.name === newSuite.name)) newSuite.name += " (Imported)";
                suites.push(newSuite); saveData(); renderSuites();
            }
        } catch (err) { alert("Invalid File"); }
    };
    reader.readAsText(e.target.files[0]);
}

function renderHistory() {
    document.getElementById('history-list').innerHTML = history.map(h => `
        <div class="card">
            <div style="margin-bottom:10px; font-weight:700;">${h.date} • ${h.suiteName}</div>
            <textarea readonly style="width:100%;height:80px;border:1px solid #dfe1e6;border-radius:6px;padding:10px;font-size:12px;">${h.report}</textarea>
        </div>
    `).join('');
}

function exportData() {
    const blob = new Blob([JSON.stringify({ suites, history })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "global_backup.json"; a.click();
}

function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const d = JSON.parse(ev.target.result); suites = d.suites; history = d.history; saveData(); location.reload();
    };
    reader.readAsText(e.target.files[0]);
}

showPicker();
