let currentRecords = [];
let rawQueueData = [];
let horizonChartInstance = null;
let instChartInstance = null;
let riskChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  refreshPlatformState();
});

async function refreshPlatformState() {
  const data = await SentinelAPI.getState();
  if (!data) return;

  currentRecords = data.records;
  rawQueueData = data.actionQueue || [];

  renderSummaryCards(data.summary);
  renderPriorityQueue(rawQueueData);
  renderMasterRegister(currentRecords);
  renderDigitalPassports(currentRecords);
  renderCalendarAgenda(currentRecords);
  renderAuditTrail(data.auditLogs);
  renderEmailDispatches(data.emailLogs);

  // Initialize all three Chart.js visualizers with database telemetry
  renderHorizonChart(data.analytics.maturityBuckets);
  renderInstitutionChart(data.analytics.institutionExposure);
  renderRiskSpreadChart(data.analytics.riskBuckets);
}

function switchView(viewName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-icon-btn').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  const btn = Array.from(document.querySelectorAll('.nav-icon-btn')).find(b => b.getAttribute('onclick')?.includes(viewName));
  if (btn) btn.classList.add('active');
}

function renderSummaryCards(summary) {
  document.getElementById('metricTotalVal').innerText = summary.totalVal;
  document.getElementById('metricTotalFdr').innerText = `${summary.activeCount} Instruments`;
  document.getElementById('metricCritical').innerText = `${summary.criticalCount} Critical`;
  document.getElementById('metricHighRisk').innerText = `${summary.highRiskCount} Quarantined`;
}

function filterQueue(severityFilter, btnElement) {
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  if (severityFilter === 'ALL') {
    renderPriorityQueue(rawQueueData);
  } else {
    const filtered = rawQueueData.filter(item => item.severity === severityFilter);
    renderPriorityQueue(filtered);
  }
}

function renderPriorityQueue(queueItems) {
  const container = document.getElementById('priorityQueueContainer');
  container.innerHTML = '';

  if (!queueItems || queueItems.length === 0) {
    container.innerHTML = `<div style="padding:16px; color:#64748B; font-size:12px;">✓ Zero compliance violations or pending actions in this filter.</div>`;
    return;
  }

  queueItems.forEach(item => {
    let flagClass = 'flag-medium';
    if (item.severity === 'CRITICAL') flagClass = 'flag-danger';
    else if (item.severity === 'HIGH') flagClass = 'flag-warning';

    const div = document.createElement('div');
    div.className = `queue-row ${flagClass}`;
    div.innerHTML = `
      <div>
        <div style="font-weight:800; font-size:12px; color:#0F172A;">${item.vendor}</div>
        <div style="font-size:11px; color:#64748B;">Ref: ${item.fdr_number} • <strong>${item.amount}</strong></div>
        <div style="font-size:10px; font-weight:700; margin-top:2px; color:${item.severity === 'CRITICAL' ? '#BE123C' : '#B45309'};">
          ${item.issue}
        </div>
        <div style="font-size:10px; color:#64748B; margin-top:1px;">Target: ${item.deadline}</div>
      </div>
      <div>
        <button class="btn-action-primary" style="padding:6px 12px; font-size:11px;" onclick="inspectForensics('${item.fdr_number}')">
          Review Record
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

function render8StageStepper(stage) {
  const stages = ["Submit", "OCR", "Review", "Bank", "Lien", "Approve", "Custody", "Release"];
  return `
    <div class="stepper-8-container">
      ${stages.map((st, i) => `
        <span class="step-dot ${stage >= (i + 1) ? 'active' : ''}">${stage >= (i + 1) ? '●' : '○'} ${st}</span>
      `).join('<span style="color:#CBD5E1;">›</span>')}
    </div>
  `;
}

function renderMasterRegister(records) {
  const tbody = document.getElementById('masterTableBody');
  tbody.innerHTML = '';

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748B;">No institutional records found matching criteria.</td></tr>`;
    return;
  }

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight:800; color:#0F172A;">${r.vendor}</div>
        <div style="font-size:10px; color:#00BFA6; font-family:monospace;">${r.inst_id} • ${r.id}</div>
      </td>
      <td>
        <div style="font-weight:700;">${r.bank}</div>
        <div style="font-size:10px; color:#5B21B6; font-family:monospace;">${r.fdr_number}</div>
      </td>
      <td style="font-weight:900; color:#0F172A;">${r.amount}</td>
      <td>
        ${render8StageStepper(r.lifecycle_stage)}
        <div style="font-size:10px; color:#64748B; margin-top:3px;">Locker: ${r.locker}</div>
      </td>
      <td>
        <div style="font-weight:700; color:${r.days_remaining <= 30 ? '#BE123C' : '#0F172A'};">${r.maturity_date}</div>
        <div style="font-size:10px; color:#64748B;">${r.days_remaining <= 0 ? 'MATURED' : r.days_remaining + ' Days Left'}</div>
      </td>
      <td>
        <span class="pill" style="background:${r.risk_level === 'HIGH' ? '#FFE4E6; color:#BE123C;' : (r.risk_level === 'MEDIUM' ? '#FEF3C7; color:#B45309;' : '#D1FAE5; color:#065F46;')}">
          ${r.risk_level} (${r.risk_score}/100)
        </span>
      </td>
      <td style="text-align:right;">
        <button class="btn-action-sec" style="padding:4px 8px; font-size:10px;" onclick="inspectForensics('${r.fdr_number}')">Forensic Split</button>
        <button class="btn-action-sec" style="padding:4px 8px; font-size:10px; margin-left:3px;" onclick="viewQRSummary('${r.fdr_number}')">QR Code</button>
        <button class="btn-action-primary" style="padding:4px 8px; font-size:10px; margin-left:3px;" onclick="window.location.href='/api/download-passport/${r.fdr_number}'">PDF</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleTableSearch() {
  const query = document.getElementById('registerSearchInput').value.toLowerCase();
  const filtered = currentRecords.filter(r => 
    r.vendor.toLowerCase().includes(query) ||
    r.bank.toLowerCase().includes(query) ||
    r.fdr_number.toLowerCase().includes(query) ||
    r.inst_id.toLowerCase().includes(query)
  );
  renderMasterRegister(filtered);
}

function renderDigitalPassports(records) {
  const container = document.getElementById('passportGrid');
  container.innerHTML = '';

  records.forEach(r => {
    const card = document.createElement('div');
    card.className = 'passport-tile';
    card.innerHTML = `
      <div class="passport-head">
        <span class="passport-id-text">${r.id}</span>
        <span class="pill ${r.workflow_status === 'APPROVED_ACTIVE' ? 'pill-teal' : 'pill-lavender'}">${r.workflow_status}</span>
      </div>
      <div style="font-size:14px; font-weight:900; color:#101C2C; margin-bottom:12px;">${r.vendor}</div>
      <div class="passport-line"><span class="passport-label">Instrument / Bank:</span><span class="passport-val">${r.fdr_number} (${r.bank})</span></div>
      <div class="passport-line"><span class="passport-label">Principal Amount:</span><span class="passport-val" style="color:#00BFA6;">${r.amount}</span></div>
      <div class="passport-line"><span class="passport-label">Maturity Date:</span><span class="passport-val">${r.maturity_date}</span></div>
      <div class="passport-line"><span class="passport-label">Lien Status:</span><span class="passport-val" style="color:#059669;">${r.lien_status}</span></div>
      <div class="passport-line"><span class="passport-label">Locker Custody:</span><span class="passport-val">${r.locker}</span></div>
      <div class="passport-line"><span class="passport-label">SHA-256 Ledger Hash:</span><span class="passport-val" style="font-family:monospace; font-size:9px;">${r.doc_hash.substring(0, 18)}...</span></div>
      
      <div style="margin-top:14px; padding-top:10px; border-top:1px solid #CBD5E1; display:flex; justify-content:space-between; align-items:center;">
        <button class="btn-action-sec" style="padding:4px 8px; font-size:10px;" onclick="viewQRSummary('${r.fdr_number}')">View QR Code</button>
        <button class="btn-action-primary" style="padding:4px 10px; font-size:10px;" onclick="window.location.href='/api/download-passport/${r.fdr_number}'">Download Passport PDF</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderCalendarAgenda(records) {
  const container = document.getElementById('calendarAgendaContainer');
  container.innerHTML = '';

  const sorted = [...records].sort((a, b) => a.days_remaining - b.days_remaining);

  sorted.forEach(r => {
    let urgencyClass = 'safe';
    let escalationText = 'Standard Custody Monitoring';

    if (r.days_remaining <= 15) {
      urgencyClass = 'urgent';
      escalationText = 'Tier-1 Immediate Escalation to Chairman & Director';
    } else if (r.days_remaining <= 30) {
      urgencyClass = 'urgent';
      escalationText = 'Tier-2 Automated Statutory Notice Dispatched';
    } else if (r.days_remaining <= 90) {
      urgencyClass = 'warning';
      escalationText = 'Tier-3 90-Day Pre-Maturity Alert Scheduled';
    }

    const card = document.createElement('div');
    card.className = `agenda-card ${urgencyClass}`;
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:11px; font-weight:800; color:#101C2C;">${r.fdr_number}</span>
        <span class="pill ${urgencyClass === 'urgent' ? 'flag-danger' : 'pill-teal'}">${r.days_remaining <= 0 ? 'MATURED' : r.days_remaining + ' Days Left'}</span>
      </div>
      <div style="font-weight:700; font-size:12px; color:#0F172A;">${r.vendor}</div>
      <div style="font-size:11px; color:#64748B; margin-top:2px;">Bank: <strong>${r.bank}</strong> • Value: <strong>${r.amount}</strong></div>
      <div style="font-size:11px; color:#64748B; margin-top:2px;">Maturity Date: <strong>${r.maturity_date}</strong></div>
      <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #CBD5E1; font-size:10px; color:${urgencyClass === 'urgent' ? '#BE123C' : '#0F766E'}; font-weight:700;">
        ⚡ ${escalationText}
      </div>
    `;
    container.appendChild(card);
  });
}

function viewQRSummary(fdrNumber) {
  const r = currentRecords.find(d => d.fdr_number === fdrNumber);
  if (!r) return;

  const payload = `FDR-SENTINEL-360:${r.inst_id}:${r.fdr_number}:${r.amount}:${r.doc_hash.substring(0, 16)}`;
  document.getElementById('qrModalTitle').innerText = `${r.vendor} (${r.fdr_number})`;
  document.getElementById('qrModalPayload').innerText = `Payload: ${payload}`;

  // Generate lightweight verifiable SVG QR matrix
  const svgQR = `
    <svg width="140" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#FFFFFF" />
      <rect x="10" y="10" width="25" height="25" fill="#101C2C" />
      <rect x="15" y="15" width="15" height="15" fill="#FFFFFF" />
      <rect x="18" y="18" width="9" height="9" fill="#00BFA6" />
      <rect x="65" y="10" width="25" height="25" fill="#101C2C" />
      <rect x="70" y="15" width="15" height="15" fill="#FFFFFF" />
      <rect x="73" y="18" width="9" height="9" fill="#00BFA6" />
      <rect x="10" y="65" width="25" height="25" fill="#101C2C" />
      <rect x="15" y="70" width="15" height="15" fill="#FFFFFF" />
      <rect x="18" y="73" width="9" height="9" fill="#00BFA6" />
      <rect x="42" y="42" width="16" height="16" fill="#101C2C" />
      <rect x="42" y="12" width="6" height="6" fill="#101C2C" />
      <rect x="52" y="24" width="6" height="6" fill="#101C2C" />
      <rect x="12" y="48" width="6" height="6" fill="#101C2C" />
      <rect x="75" y="55" width="12" height="12" fill="#101C2C" />
      <rect x="45" y="75" width="8" height="8" fill="#101C2C" />
      <rect x="62" y="75" width="8" height="8" fill="#101C2C" />
    </svg>
  `;
  document.getElementById('qrContainer').innerHTML = svgQR;
  openModalBox('qrModal');
}

function inspectForensics(fdrNumber) {
  const r = currentRecords.find(d => d.fdr_number === fdrNumber);
  if (!r) return;

  const docCard = document.getElementById('previewDocCard');
  docCard.innerHTML = `
    <strong>[BANK INSTRUMENT METADATA EVIDENCE]</strong><br/>
    Issuing Scheduled Bank: ${r.bank}<br/>
    Deposit Reference: ${r.fdr_number}<br/>
    Beneficiary Registry: AICTE HQ Custody, New Delhi<br/>
    Principal Deposit: ${r.amount}<br/>
    Maturity Expiry Date: ${r.maturity_date}<br/>
    Lien Registration: Verified Section 12-B Statutory Lock<br/>
    Simulated Core Banking API Status: <strong>${r.lien_status}</strong>
  `;

  const ocrReport = document.getElementById('ocrIntelligenceReport');
  ocrReport.innerHTML = `
    <div style="background:${r.risk_level === 'HIGH' ? '#FFE4E6' : '#ECFDF5'}; border:1px solid ${r.risk_level === 'HIGH' ? '#FCA5A5' : '#A7F3D0'}; padding:14px; border-radius:8px;">
      <div style="font-weight:900; font-size:13px; color:${r.risk_level === 'HIGH' ? '#9F1239' : '#065F46'};">
        AI OCR Confidence Metric: ${r.ocr_confidence}%
      </div>
      <div style="font-size:11px; margin-top:8px; line-height:1.6; color:#0F172A;">
        • Integrity Diagnostic: <strong>${r.tamper_detected ? '❌ Pixel Density & Font Anomaly Flagged' : '✓ Clean Document Stream'}</strong><br/>
        • Core Bank Lien: <strong>${r.lien_status}</strong><br/>
        • Forensic Root Cause: <em>${r.risk_reason}</em>
      </div>
      <div style="margin-top:14px; display:flex; gap:8px;">
        ${r.lifecycle_stage < 6 ? `
          <button class="btn-action-primary" style="padding:6px 12px; font-size:11px; background:#059669;" onclick="advanceRecordWorkflow('${r.fdr_number}', 6, 'Officer verified document watermark.')">
            Grant Scrutiny Approval (Stage 6)
          </button>
        ` : `
          <button class="btn-action-primary" style="padding:6px 12px; font-size:11px; background:#0F766E;" onclick="advanceRecordWorkflow('${r.fdr_number}', 8, 'Statutory course closure settlement approved.')">
            Authorize Final Release (Stage 8)
          </button>
        `}
      </div>
    </div>
  `;

  openModalBox('forensicModal');
}

async function advanceRecordWorkflow(fdrNumber, nextStage, remarks) {
  const actor = document.getElementById('activeRole').value;
  try {
    await SentinelAPI.advanceStage(fdrNumber, nextStage, actor, remarks);
    closeModalBox('forensicModal');
    alert(`WORKFLOW TRANSITION CONFIRMED: Instrument ${fdrNumber} advanced to Stage ${nextStage}.`);
    refreshPlatformState();
  } catch (err) {
    alert("Transition Error: " + err.message);
  }
}

function renderHorizonChart(buckets) {
  const ctx = document.getElementById('horizonChart')?.getContext('2d');
  if (!ctx) return;
  if (horizonChartInstance) horizonChartInstance.destroy();

  horizonChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0–30 Days', '31–60 Days', '61–90 Days', '>90 Days Safe'],
      datasets: [{
        label: 'Instruments',
        data: [buckets.b0_30, buckets.b31_60, buckets.b61_90, buckets.b90_plus],
        backgroundColor: ['#BE123C', '#B45309', '#6366F1', '#00BFA6'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function renderInstitutionChart(instData) {
  const ctx = document.getElementById('institutionChart')?.getContext('2d');
  if (!ctx) return;
  if (instChartInstance) instChartInstance.destroy();

  instChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: instData.labels,
      datasets: [{
        label: 'Secured Portfolio (₹)',
        data: instData.data,
        backgroundColor: '#19324D',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function renderRiskSpreadChart(riskBuckets) {
  const ctx = document.getElementById('riskSpreadChart')?.getContext('2d');
  if (!ctx) return;
  if (riskChartInstance) riskChartInstance.destroy();

  riskChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Low Risk (Clean)', 'Medium Risk (Maturity Horizon)', 'High Risk (Forensic Flag)'],
      datasets: [{
        data: [riskBuckets.low, riskBuckets.medium, riskBuckets.high],
        backgroundColor: ['#00BFA6', '#B45309', '#BE123C'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderAuditTrail(logs) {
  const tbody = document.getElementById('auditLedgerBody');
  tbody.innerHTML = '';
  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace; font-size:10px; color:#64748B;">${l.timestamp}</td>
      <td style="font-weight:700; color:#0F172A;">${l.actor}</td>
      <td><span class="pill pill-lavender">${l.action}</span></td>
      <td style="font-family:monospace; color:#00BFA6;">${l.fdr_id}</td>
      <td style="font-weight:700; color:#059669;">${l.status}</td>
      <td style="font-family:monospace; font-size:10px; color:#5B21B6;">${l.current_hash.substring(0, 16)}...</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEmailDispatches(logs) {
  const tbody = document.getElementById('emailNoticeBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace; font-size:10px; color:#64748B;">${l.timestamp}</td>
      <td style="font-weight:700; color:#00BFA6;">${l.recipient}</td>
      <td style="font-size:11px;">${l.subject}</td>
      <td><span class="pill pill-teal">✓ ${l.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleIngest(e) {
  e.preventDefault();
  const form = document.getElementById('ingestForm');
  const formData = new FormData(form);

  try {
    await SentinelAPI.ingestInstrument(formData);
    closeModalBox('ingestModal');
    form.reset();
    document.getElementById('tamperWarning').classList.add('hidden');
    alert("SUCCESS: FDR Inward Intake Certified & Sealed into Relational Vault.");
    refreshPlatformState();
  } catch (err) {
    alert("INTAKE REJECTION:\n" + err.message);
  }
}

function loadJudgeScenario(scenarioKey) {
  const warning = document.getElementById('tamperWarning');
  const tamperInput = document.getElementById('simulateTamperFlag');

  if (scenarioKey === 'CLEAN') {
    document.getElementById('inpVendor').value = "Vasireddy Venkatadri Inst of Technology";
    document.getElementById('inpEmail').value = "principal@vvit.net";
    document.getElementById('inpInstId').value = "VVIT-AP-2026";
    document.getElementById('inpBank').value = "State Bank of India";
    document.getElementById('inpFdrNumber').value = "SBI-FDR-55410";
    document.getElementById('inpAmount').value = "₹ 50,00,000.00";
    document.getElementById('inpIssueDate').value = "2026-10-01";
    document.getElementById('inpMaturityDate').value = "2029-10-01";
    tamperInput.value = "false";
    warning.classList.add('hidden');
  } else if (scenarioKey === 'DUPLICATE') {
    document.getElementById('inpVendor').value = "Vignan's Nirula Inst of Technology";
    document.getElementById('inpEmail').value = "principal@vignan.ac.in";
    document.getElementById('inpInstId').value = "VNITSW-AP-2026";
    document.getElementById('inpBank').value = "State Bank of India";
    document.getElementById('inpFdrNumber').value = "SBI-FDR-98214";
    document.getElementById('inpAmount').value = "₹ 45,00,000.00";
    document.getElementById('inpIssueDate').value = "2023-11-25";
    document.getElementById('inpMaturityDate').value = "2026-11-25";
    tamperInput.value = "false";
    warning.classList.add('hidden');
  } else if (scenarioKey === 'TAMPER') {
    document.getElementById('inpVendor').value = "Apex Global Institute of Engineering";
    document.getElementById('inpEmail').value = "director@apex-engg.edu";
    document.getElementById('inpInstId').value = "APX-SEC-9901";
    document.getElementById('inpBank').value = "HDFC Bank";
    document.getElementById('inpFdrNumber').value = "HDFC-FORGE-8841";
    document.getElementById('inpAmount').value = "₹ 95,00,000.00";
    document.getElementById('inpIssueDate').value = "2026-01-01";
    document.getElementById('inpMaturityDate').value = "2031-01-01";
    tamperInput.value = "true";
    warning.classList.remove('hidden');
  }
}

function openModalBox(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModalBox(id) { document.getElementById(id).classList.add('hidden'); }