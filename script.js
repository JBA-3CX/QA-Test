// --- DATA MANAGEMENT ---
let suites = JSON.parse(localStorage.getItem('qa_suites')) || [];
let history = JSON.parse(localStorage.getItem('qa_history')) || [];
let sessions = JSON.parse(localStorage.getItem('qa_sessions')) || []; 
let activeSuiteId = null;
let editingTests = []; 
let undoStack = []; 
let currentRunState = [];
let dragSrcIndex = null;

function saveData() {
    localStorage.setItem('qa_suites', JSON.stringify(suites));
    localStorage.setItem('qa_history', JSON.stringify(history));
    localStorage.setItem('qa_sessions', JSON.stringify(sessions));
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
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewId)) {
            item.classList.add('active');
        }
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
    const activeSess = sessions.find(s => s.suiteId === activeSuiteId);
    const bar = document.getElementById('progress-bar-fill');
    if (!activeSess || !bar) {
        if (bar) bar.style.width = '0%';
        return;
    }
    const completed = activeSess.state.filter(x => x.status !== 'Pending').length;
    const percent = Math.round((completed / activeSess.state.length) * 100);
    bar.style.width = percent + '%';
}

// --- RUNNER LOGIC ---
function showPicker() {
    activeSuiteId = null; 
    document.getElementById('suite-picker-section').classList.remove('hidden');
    document.getElementById('active-test-section').classList.add('hidden');
    
    const grid = document.getElementById('run-suite-grid');
    let html = '';

    // 1. List Active Sessions
    if (sessions.length > 0) {
        html += `<h3 style="grid-column: 1/-1; margin-top: 10px; color: var(--text-light); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Active Sessions</h3>`;
        html += sessions.map(sess => `
        <div class="card" style="grid-column: 1 / -1; background: #fff9e6; border-left: 6px solid #ffcc00; display:flex; justify-content:space-between; align-items:center; padding: 15px 20px;">
            <div>
                <strong style="color: #856404; font-size: 1.1rem;">⏳ ${sess.suiteName}</strong>
                <span style="color: #6b778c; margin-left: 15px;">${sess.progress}% Complete</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="status-btn" style="color:#ff5630; border-color:#ff5630; background: white;" onclick="cancelSession('${sess.suiteId}')">Discard</button>
                <button class="btn-primary" style="background:#ffcc00; color:#443300;" onclick="resumeSession('${sess.suiteId}')">Resume</button>
            </div>
        </div>`).join('');
    }

    // 2. List All Available Suites
    if (suites.length > 0) {
        html += `<h3 style="grid-column: 1/-1; margin-top: 25px; color: var(--text-light); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Start New Run</h3>`;
        html += suites.map(s => `
            <div class="card" style="cursor:pointer; border-top: 1px solid #eee;" onclick="startRun('${s.id}')">
                <h3 style="color:var(--primary);">${s.name}</h3>
                <p style="color:var(--text-light); font-size:14px; margin-top:5px;">${s.tests.length} Steps</p>
            </div>
        `).join('');
    }

    // 3. Dynamic Empty State (IQ-Level Fix)
    if (suites.length === 0 && sessions.length === 0) {
        html = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📂</div>
                <h3 style="color: var(--text-dark);">No suites found</h3>
                <p style="color: var(--text-light); margin-top: 10px;">Visit "Manage Suites" to create your first test plan.</p>
                <button class="btn-primary" style="margin-top: 20px;" onclick="switchView('suites')">Go to Manage Suites</button>
            </div>
        `;
    }

    grid.innerHTML = html;
    updateProgressBar();
}

function startRun(id) {
    const existing = sessions.find(s => s.suiteId === id);
    if (existing) return resumeSession(id);

    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    if (!suite) return;

    currentRunState = suite.tests.map(t => ({ ...t, status: 'Pending', notes: '' }));
    sessions.push({ 
        suiteId: id, 
        suiteName: suite.name, 
        state: currentRunState, 
        progress: 0 
    });
    saveData();
    resumeSession(id);
}

function resumeSession(id) {
    activeSuiteId = id;
    const sess = sessions.find(s => s.suiteId === id);
    if (!sess) return showPicker();

    currentRunState = sess.state;
    document.getElementById('active-suite-name').innerText = sess.suiteName;
    document.getElementById('suite-picker-section').classList.add('hidden');
    document.getElementById('active-test-section').classList.remove('hidden');
    
    renderTestRun();
    window.scrollTo(0,0);
}

function cancelSession(id) {
    if(confirm("Discard this session? Progress will be lost.")) {
        sessions = sessions.filter(s => s.suiteId !== id);
        saveData();
        showPicker();
    }
}

function editCurrentSuite() {
    const suiteId = activeSuiteId;
    switchView('suites');
    showSuiteEditor(suiteId);
}

function renderTestRun() {
    const container = document.getElementById('test-container');
    container.innerHTML = `
        <div style="margin-bottom: 25px; display:flex; gap:12px; background: rgba(0,0,0,0.03); padding: 15px; border-radius: 8px;">
            <button class="status-btn" onclick="editCurrentSuite()">⚙️ Edit Requirements</button>
            <button class="status-btn" style="color: #ff5630;" onclick="showPicker()">💾 Save & Exit to Menu</button>
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
    const sessIdx = sessions.findIndex(sess => sess.suiteId === activeSuiteId);
    if (sessIdx > -1) {
        const completed = currentRunState.filter(x => x.status !== 'Pending').length;
        sessions[sessIdx].progress = Math.round((completed / currentRunState.length) * 100);
        sessions[sessIdx].state = currentRunState;
    }
    saveData();
    renderTestRun(); 
}

function updateNoteState(i, val) {
    currentRunState[i].notes = val;
    const sessIdx = sessions.findIndex(sess => sess.suiteId === activeSuiteId);
    if (sessIdx > -1) sessions[sessIdx].state = currentRunState;
    saveData();
}

function generateReport() {
    const sess = sessions.find(s => s.suiteId === activeSuiteId);
    const fails = currentRunState.filter(s => s.status === 'Fail');
    const passes = currentRunState.filter(s => s.status === 'Pass');

    let report = `## Regression: ${sess.suiteName}\n\n`;
    if (fails.length) report += `### 🚨 FAILS\n` + fails.map(f => `* **${f.text}**: ${f.notes || 'No notes'}`).join('\n') + "\n\n";
    report += `### ✅ PASSES\n` + passes.map(p => `* ${p.text}`).join('\n');

    navigator.clipboard.writeText(report).then(() => {
        history.unshift({ id: Date.now(), date: new Date().toLocaleString(), suiteName: sess.suiteName, report });
        sessions = sessions.filter(s => s.suiteId !== activeSuiteId); 
        saveData(); 
        alert("Report Copied! Session closed.");
        showPicker();
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
            <input type="text" class="editor-input" tabindex="0" value="${t.text}" oninput="editingTests[${i}].text=this.value" style="flex:1; margin:0 10px; border:1px solid #ddd; padding:8px; border-radius:6px;">
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
        const sessIdx = sessions.findIndex(sess => sess.suiteId === id);
        if (sessIdx > -1) {
            const oldState = sessions[sessIdx].state;
            sessions[sessIdx].state = newTestData.map(newStep => {
                const existing = oldState.find(os => os.text === newStep.text && os.level === newStep.level);
                return existing ? existing : { ...newStep, status: 'Pending', notes: '' };
            });
            sessions[sessIdx].suiteName = name;
        }
    } else {
        suites.push({ id, name, tests: newTestData });
    }
    
    saveData(); 
    document.getElementById('suite-editor').style.display='none'; 
    renderSuites();
    
    const sessIdx = sessions.findIndex(sess => sess.suiteId === id);
    if (sessIdx > -1) {
        switchView('run');
        resumeSession(id);
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
