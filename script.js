// Data structure now supports children
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
    if (window.event) event.currentTarget.classList.add('active');
    if (viewId === 'run') showPicker();
    if (viewId === 'suites') renderSuites();
    if (viewId === 'history') renderHistory();
}

function showPicker() {
    document.getElementById('suite-picker-section').classList.remove('hidden');
    document.getElementById('active-test-section').classList.add('hidden');
    const grid = document.getElementById('run-suite-grid');
    grid.innerHTML = suites.length === 0 ? "" : suites.map(s => `
        <div class="suite-select-card" onclick="startRun('${s.id}')">
            <h3>${s.name}</h3>
            <p>${s.tests.length} Items</p>
        </div>
    `).join('');
    document.getElementById('run-empty-msg').className = suites.length === 0 ? "empty-state" : "hidden";
}

function startRun(id) {
    activeSuiteId = id;
    const suite = suites.find(s => s.id === id);
    document.getElementById('active-suite-name').innerText = suite.name;
    
    // Process tests to identify depth based on leading dashes or spaces
    currentRunState = suite.tests.map(t => {
        const depth = (t.match(/^[\s\t·-]+/) || [""])[0].length;
        return {
            name: t.trim().replace(/^[\s\t·-]+/, ""),
            status: 'Pending',
            notes: '',
            depth: depth > 0 ? Math.floor(depth / 2) + 1 : 0 // Calculate indentation level
        };
    });
    
    document.getElementById('suite-picker-section').classList.add('hidden');
    document.getElementById('active-test-section').classList.remove('hidden');
    renderTestRun();
}

function renderTestRun() {
    const container = document.getElementById('test-container');
    container.innerHTML = currentRunState.map((test, index) => {
        const isHeader = index < currentRunState.length - 1 && currentRunState[index+1].depth > test.depth;
        return `
            <div class="test-row depth-${test.depth} ${isHeader ? 'row-header' : ''}">
                <div class="test-title">${test.name}</div>
                <div class="test-controls ${isHeader ? 'hidden' : ''}">
                    <button class="status-btn ${test.status === 'Pass' ? 'active' : ''}" data-status="Pass" onclick="updateStatus(${index}, 'Pass')">P</button>
                    <button class="status-btn ${test.status === 'Fail' ? 'active' : ''}" data-status="Fail" onclick="updateStatus(${index}, 'Fail')">F</button>
                    <button class="status-btn ${test.status === 'Skip' ? 'active' : ''}" data-status="Skip" onclick="updateStatus(${index}, 'Skip')">S</button>
                    <input type="text" placeholder="Note..." value="${test.notes}" onchange="updateNotes(${index}, this.value)">
                </div>
            </div>
        `;
    }).join('');
}

function updateStatus(i, s) { currentRunState[i].status = s; renderTestRun(); }
function updateNotes(i, n) { currentRunState[i].notes = n; }

function generateReport() {
    const suite = suites.find(s => s.id === activeSuiteId);
    const fails = currentRunState.filter(s => s.status === 'Fail');
    const passes = currentRunState.filter(s => s.status === 'Pass');

    let report = `h2. Regression: ${suite.name}\n\n`;
    if (fails.length) report += "{panel:title=🚨 Fails|titleBGColor=#ffebe6}\n" + fails.map(f => `* ${f.name}: ${f.notes}`).join('\n') + "\n{panel}\n\n";
    report += "{panel:title=✅ Passes|titleBGColor=#e3fcef}\n" + passes.map(p => `* ${p.name}`).join('\n') + "\n{panel}";

    const out = document.getElementById('jira-output');
    out.style.display = 'block'; out.value = report; out.select();
    document.execCommand('copy');
    history.unshift({ id: Date.now(), date: new Date().toLocaleString(), suiteName: suite.name, report: report });
    saveData();
    alert("Copied!");
}

// SUITE MGMT
function renderSuites() {
    const list = document.getElementById('suite-list');
    list.innerHTML = suites.map(s => `
        <div class="card suite-card-item">
            <div><strong>${s.name}</strong></div>
            <div class="suite-actions">
                <button class="btn-outline" onclick="editSuite('${s.id}')">Edit</button>
                <button class="btn-outline" onclick="exportSingleSuite('${s.id}')">Export</button>
                <button class="btn-danger" onclick="deleteSuite('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function showSuiteEditor() { 
    document.getElementById('suite-editor').style.display = 'block'; 
    document.getElementById('edit-suite-id').value = '';
}

function saveSuite() {
    const id = document.getElementById('edit-suite-id').value || Date.now().toString();
    const name = document.getElementById('edit-suite-name').value;
    const tests = document.getElementById('edit-suite-tests').value.split('\n').filter(t => t.trim().length > 0);
    const idx = suites.findIndex(s => s.id === id);
    if (idx > -1) suites[idx] = { id, name, tests };
    else suites.push({ id, name, tests });
    saveData(); document.getElementById('suite-editor').style.display='none'; renderSuites();
}

function editSuite(id) {
    const s = suites.find(x => x.id === id);
    document.getElementById('edit-suite-id').value = s.id;
    document.getElementById('edit-suite-name').value = s.name;
    document.getElementById('edit-suite-tests').value = s.tests.join('\n');
    showSuiteEditor();
}

function deleteSuite(id) { if(confirm("Delete?")) { suites = suites.filter(s => s.id !== id); saveData(); renderSuites(); } }

// Storage and history functions remain the same...
function renderHistory() {
    document.getElementById('history-list').innerHTML = history.map(h => `
        <div class="card"><strong>${h.date}</strong><br><textarea readonly>${h.report}</textarea></div>
    `).join('');
}

showPicker();
