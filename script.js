let suites = JSON.parse(localStorage.getItem('qa_suites')) || [];
let history = JSON.parse(localStorage.getItem('qa_history')) || [];
let currentRunState = [];
let activeSuiteId = null;
let editingTests = [];

function saveData() {
    localStorage.setItem('qa_suites', JSON.stringify(suites));
    localStorage.setItem('qa_history', JSON.stringify(history));
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    if (viewId === 'run') showPicker();
    if (viewId === 'suites') renderSuites();
    if (viewId === 'history') renderHistory();
}

function showPicker() {
    const grid = document.getElementById('run-suite-grid');
    grid.innerHTML = suites.map(s => `
        <div class="card" style="cursor:pointer;" onclick="startRun('${s.id}')">
            <h3 style="color:var(--primary)">${s.name}</h3>
            <p>${s.tests.length} steps</p>
        </div>
    `).join('');
}

function startRun(id) {
    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    document.getElementById('active-suite-name').innerText = suite.name;
    currentRunState = suite.tests.map(t => ({ ...t, status: 'Pending', notes: '' }));
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
                <input type="text" class="note-input" placeholder="Note..." value="${test.notes}" onchange="currentRunState[${index}].notes=this.value">
            </div>
        </div>
    `).join('');
}

function updateStatus(i, s) { 
    currentRunState[i].status = s; 
    renderTestRun(); 
}

function generateReport() {
    const suite = suites.find(s => s.id === activeSuiteId);
    const fails = currentRunState.filter(s => s.status === 'Fail');
    const passes = currentRunState.filter(s => s.status === 'Pass');

    let report = `h2. Regression: ${suite.name}\n\n`;
    if (fails.length) report += "{panel:title=🚨 Fails|titleBGColor=#ffebe6}\n" + fails.map(f => `* *${f.text}*: ${f.notes}`).join('\n') + "\n{panel}\n\n";
    report += "{panel:title=✅ Passes|titleBGColor=#e3fcef}\n" + passes.map(p => `* ${p.text}`).join('\n') + "\n{panel}";

    const out = document.getElementById('jira-output');
    out.style.display = 'block'; out.value = report; out.select();
    document.execCommand('copy');
    history.unshift({ id: Date.now(), date: new Date().toLocaleString(), suiteName: suite.name, report });
    saveData(); alert("Copied to clipboard!");
}

// BUILDER
function showSuiteEditor(id = null) {
    document.getElementById('suite-editor').style.display = 'block';
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

function renderEditor() {
    const container = document.getElementById('editor-items-list');
    container.innerHTML = editingTests.map((t, i) => `
        <div class="editor-line" style="margin-left: ${t.level * 30}px">
            <button class="status-btn" onclick="move(${i}, -1)">◀</button>
            <button class="status-btn" onclick="move(${i}, 1)">▶</button>
            <input type="text" class="editor-input" value="${t.text}" oninput="editingTests[${i}].text=this.value">
            <button onclick="editingTests.splice(${i},1);renderEditor()" style="border:none; background:none; color:red; cursor:pointer; padding:5px;">✕</button>
        </div>
    `).join('');
}

function move(i, dir) { editingTests[i].level = Math.max(0, Math.min(3, editingTests[i].level + dir)); renderEditor(); }
function addLine() { editingTests.push({ text: '', level: editingTests[editingTests.length-1]?.level || 0 }); renderEditor(); }

function saveSuite() {
    const name = document.getElementById('edit-suite-name').value;
    const id = document.getElementById('edit-suite-id').value || Date.now().toString();
    const idx = suites.findIndex(s => s.id === id);
    if (idx > -1) suites[idx] = { id, name, tests: editingTests };
    else suites.push({ id, name, tests: editingTests });
    saveData(); document.getElementById('suite-editor').style.display='none'; renderSuites();
}

function renderSuites() {
    document.getElementById('suite-list').innerHTML = suites.map(s => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center">
            <strong>${s.name}</strong>
            <div>
                <button class="status-btn" onclick="showSuiteEditor('${s.id}')">Edit</button>
                <button class="status-btn" style="color:red" onclick="deleteSuite('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function deleteSuite(id) { if(confirm("Delete?")) { suites = suites.filter(s => s.id !== id); saveData(); renderSuites(); } }

function renderHistory() {
    document.getElementById('history-list').innerHTML = history.map(h => `
        <div class="card"><strong>${h.date} - ${h.suiteName}</strong><br><textarea readonly style="width:100%;height:60px;margin-top:10px">${h.report}</textarea></div>
    `).join('');
}

function exportData() {
    const blob = new Blob([JSON.stringify({ suites, history })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "backup.json"; a.click();
}

function importData(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const d = JSON.parse(ev.target.result); suites = d.suites; history = d.history; saveData(); location.reload();
    };
    reader.readAsText(e.target.files[0]);
}

showPicker();
