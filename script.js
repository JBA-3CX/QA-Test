let suites = JSON.parse(localStorage.getItem('qa_suites')) || [];
let history = JSON.parse(localStorage.getItem('qa_history')) || [];
let currentRunState = [];
let activeSuiteId = null;
let editingTests = []; // Temporary array for the editor

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

// --- RUNNER VIEW ---
function showPicker() {
    const grid = document.getElementById('run-suite-grid');
    grid.innerHTML = suites.map(s => `
        <div class="suite-select-card" onclick="startRun('${s.id}')">
            <h3>${s.name}</h3>
            <p>${s.tests.length} steps</p>
        </div>
    `).join('');
    document.getElementById('run-empty-msg').style.display = suites.length === 0 ? 'block' : 'none';
}

function startRun(id) {
    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    document.getElementById('active-suite-name').innerText = suite.name;
    // Map existing structure to run state
    currentRunState = suite.tests.map(t => ({ ...t, status: 'Pending', notes: '' }));
    
    document.getElementById('suite-picker-section').classList.add('hidden');
    document.getElementById('active-test-section').classList.remove('hidden');
    renderTestRun();
}

function renderTestRun() {
    const container = document.getElementById('test-container');
    container.innerHTML = currentRunState.map((test, index) => {
        const isHeader = index < currentRunState.length - 1 && currentRunState[index+1].level > test.level;
        return `
            <div class="test-row level-${test.level} ${isHeader ? 'is-header' : ''}">
                <span class="test-text">${test.text}</span>
                <div class="test-actions ${isHeader ? 'hidden' : ''}">
                    <button class="status-btn p ${test.status==='Pass'?'active':''}" onclick="updateStatus(${index}, 'Pass')">Pass</button>
                    <button class="status-btn f ${test.status==='Fail'?'active':''}" onclick="updateStatus(${index}, 'Fail')">Fail</button>
                    <input type="text" placeholder="Note..." value="${test.notes}" onchange="updateNotes(${index}, this.value)">
                </div>
            </div>
        `;
    }).join('');
}

function updateStatus(i, s) { currentRunState[i].status = s; renderTestRun(); }
function updateNotes(i, n) { currentRunState[i].notes = n; }

// --- EDITOR VIEW (The User-Friendly Part) ---
function showSuiteEditor(id = null) {
    const editor = document.getElementById('suite-editor');
    editor.style.display = 'block';
    if(id) {
        const s = suites.find(x => x.id === id);
        document.getElementById('edit-suite-id').value = s.id;
        document.getElementById('edit-suite-name').value = s.name;
        editingTests = JSON.parse(JSON.stringify(s.tests));
    } else {
        document.getElementById('edit-suite-id').value = '';
        document.getElementById('edit-suite-name').value = '';
        editingTests = [{ text: 'New Category', level: 0 }];
    }
    renderEditorList();
}

function renderEditorList() {
    const list = document.getElementById('editor-items-list');
    list.innerHTML = editingTests.map((t, i) => `
        <div class="editor-item-row level-${t.level}">
            <button class="btn-icon" onclick="changeLevel(${i}, -1)">◀</button>
            <button class="btn-icon" onclick="changeLevel(${i}, 1)">▶</button>
            <input type="text" value="${t.text}" onchange="editingTests[${i}].text = this.value">
            <button class="btn-icon danger" onclick="removeLine(${i})">✕</button>
        </div>
    `).join('') + `<button class="btn-outline" onclick="addLine()">+ Add Step</button>`;
}

function addLine() { editingTests.push({ text: '', level: 0 }); renderEditorList(); }
function removeLine(i) { editingTests.splice(i, 1); renderEditorList(); }
function changeLevel(i, dir) {
    editingTests[i].level = Math.max(0, Math.min(3, editingTests[i].level + dir));
    renderEditorList();
}

function saveSuite() {
    const id = document.getElementById('edit-suite-id').value || Date.now().toString();
    const name = document.getElementById('edit-suite-name').value;
    const idx = suites.findIndex(s => s.id === id);
    if(idx > -1) suites[idx] = { id, name, tests: editingTests };
    else suites.push({ id, name, tests: editingTests });
    saveData(); switchView('suites');
}

// ... Rest of global logic (Export/Import) stays similar ...
