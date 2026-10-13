(() => {
  'use strict';
  const STORAGE_KEY = 'opportunity-clarity-v1';
  const INFO_ITEMS = [
    ['eligibility', '參加資格'], ['selection', '錄取及候補規則'],
    ['criteria', '評選標準及權重'], ['accessibility', '無障礙及參與需求'],
    ['policy', '取消、退費或變更規則']
  ];
  const COST_FIELDS = ['fee', 'transport', 'otherCost'];
  const DEMO = {
    eventName: '週末 AI 入門工作坊（示範）', fee: '300', transport: '240', otherCost: '100',
    duration: '6', support: 'yes', eligibility: 'yes', selection: 'yes', criteria: 'unknown',
    accessibility: 'unknown', policy: 'yes', source: 'https://example.com/demo-workshop',
    eventNotes: '示範資料：主辦方提供午餐；交通補助資格及金額請再確認。示範網址非真實活動資訊。',
    budget: '1000', availableTime: '8', personalNotes: '示範資料：需安排大眾運輸往返。'
  };
  const form = document.getElementById('assessmentForm');
  const errorBox = document.getElementById('formError');
  const money = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  let toastTimer;

  function readForm() {
    const data = {};
    for (const [key, value] of new FormData(form).entries()) data[key] = String(value).trim();
    return data;
  }
  function parseNumber(value, label, max) {
    if (value === '') return { value: null };
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > max) return { error: `${label}須為 0 至 ${money.format(max)} 之間的數字。` };
    return { value: n };
  }
  function analyze(data) {
    const errors = [];
    const values = {};
    for (const key of COST_FIELDS) {
      const p = parseNumber(data[key] || '', ({ fee: '報名費', transport: '來回交通費', otherCost: '其他必要支出' })[key], 10000000);
      if (p.error) errors.push(p.error); else values[key] = p.value;
    }
    for (const [key, label, max] of [['budget', '可負擔總預算', 10000000], ['duration', '活動所需時間', 10000], ['availableTime', '可投入時間', 10000]]) {
      const p = parseNumber(data[key] || '', label, max);
      if (p.error) errors.push(p.error); else values[key] = p.value;
    }
    if (data.source && !/^https?:\/\//i.test(data.source)) errors.push('資訊來源網址須以 http:// 或 https:// 開頭。');
    let costTotal = null;
    if (COST_FIELDS.every(k => values[k] !== null)) costTotal = COST_FIELDS.reduce((sum, k) => sum + values[k], 0);
    const infoCount = INFO_ITEMS.filter(([key]) => data[key] && data[key] !== 'unknown').length;
    return { errors, values, costTotal, infoCount, infoPercent: Math.round(infoCount / INFO_ITEMS.length * 100) };
  }
  function setText(id, text) { document.getElementById(id).textContent = text; }
  function setStatus(id, text, type = '') {
    const el = document.getElementById(id); el.textContent = text; el.className = `status-pill${type ? ` ${type}` : ''}`;
  }
  function render() {
    const data = readForm();
    const result = analyze(data);
    errorBox.textContent = result.errors.join(' ');
    if (result.errors.length) {
      setStatus('costStatus', '請修正資料', 'bad'); setStatus('timeStatus', '請修正資料', 'bad');
      return result;
    }
    const { values } = result;
    setText('costTotal', result.costTotal === null ? '待確認' : `NT$ ${money.format(result.costTotal)}`);
    if (result.costTotal === null || values.budget === null) {
      setStatus('costStatus', '資料不足', 'warn');
      setText('costDetail', result.costTotal === null ? '需填妥三項支出，才能計算預估總額。' : `已填預算 NT$ ${money.format(values.budget)}；請補齊活動支出。`);
    } else if (result.costTotal <= values.budget) {
      setStatus('costStatus', '在預算內', 'good'); setText('costDetail', `預估支出低於可用預算 NT$ ${money.format(values.budget - result.costTotal)}。此估算不含未填或突發費用。`);
    } else {
      setStatus('costStatus', '超出預算', 'bad'); setText('costDetail', `預估支出超出可用預算 NT$ ${money.format(result.costTotal - values.budget)}。`);
    }
    setText('timeValue', values.duration === null ? '待確認' : `${values.duration} 小時`);
    if (values.duration === null || values.availableTime === null) {
      setStatus('timeStatus', '資料不足', 'warn'); setText('timeDetail', values.duration === null ? '尚未提供活動所需時間。' : `活動約 ${values.duration} 小時；請填入可投入時間進行比較。`);
    } else if (values.duration <= values.availableTime) {
      setStatus('timeStatus', '時間可配合', 'good'); setText('timeDetail', `比可投入時間多出 ${values.availableTime - values.duration} 小時彈性。`);
    } else {
      setStatus('timeStatus', '超出可用時間', 'bad'); setText('timeDetail', `比可投入時間多 ${values.duration - values.availableTime} 小時。`);
    }
    setText('infoPercent', String(result.infoPercent));
    document.getElementById('infoProgress').style.width = `${result.infoPercent}%`;
    const remaining = INFO_ITEMS.length - result.infoCount;
    setStatus('infoStatus', remaining ? `待確認 ${remaining} 項` : '項目已交代', remaining ? 'warn' : 'good');
    const countedItems = INFO_ITEMS.filter(([key]) => data[key] && data[key] !== 'unknown').map(([, label]) => label);
    setText('infoDetail', `${result.infoCount}／${INFO_ITEMS.length} 項已交代：${countedItems.length ? countedItems.join('、') : '目前沒有項目'}。每項等權 20%；不代表公平或品質評分。`);
    renderMissing(data, result);
    return result;
  }
  function renderMissing(data, result) {
    const items = [];
    if (result.costTotal === null) items.push('費用：確認報名費、往返交通及必要支出；目前僅將填妥的三項加總。');
    if (data.support === 'unknown') items.push('餐飲／交通補助：是否提供、補助金額、資格與核銷方式為何？');
    for (const [key, label] of INFO_ITEMS) if (!data[key] || data[key] === 'unknown') items.push(`${label}：是否有公開說明？可向主辦方索取適用規則或原文連結。`);
    if (!data.duration) items.push('活動時間：包含報到、休息及往返所需時間嗎？');
    if (!data.source) items.push('資訊來源：記下活動頁面或主辦方公告，方便核對與追蹤變更。');
    if (!items.length) items.push('目前已填寫的項目沒有待確認欄位；報名前仍可核對活動是否有更新。');
    if (data.personalNotes) items.push(`你的參與考量：${data.personalNotes}`);
    const ul = document.getElementById('missingList'); ul.replaceChildren(...items.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readForm())); }
    catch (_) { showToast('瀏覽器無法儲存資料；本次分析仍可使用。'); }
  }
  function loadData(data) {
    for (const control of form.elements) if (control.name && Object.hasOwn(data, control.name)) control.value = data[control.name];
    errorBox.textContent = ''; persist(); render();
  }
  function showToast(message) {
    const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function buildReport() {
    const data = readForm(), result = analyze(data);
    if (result.errors.length) { errorBox.textContent = result.errors.join(' '); return null; }
    const { values } = result;
    const costLine = result.costTotal === null ? '預估支出：無法完整計算（請填妥報名費、來回交通費及其他必要支出）' : `預估支出：NT$ ${money.format(result.costTotal)}（報名費 ${values.fee} + 交通 ${values.transport} + 其他 ${values.otherCost}）`;
    const budgetLine = result.costTotal === null || values.budget === null ? '經濟負擔：資料不足，尚無法比較支出與預算。' : result.costTotal <= values.budget ? `經濟負擔：預估在預算內（預算 NT$ ${money.format(values.budget)}，餘額 NT$ ${money.format(values.budget - result.costTotal)}）。` : `經濟負擔：預估超出預算 NT$ ${money.format(result.costTotal - values.budget)}（預算 NT$ ${money.format(values.budget)}）。`;
    const timeLine = values.duration === null || values.availableTime === null ? '時間條件：資料不足，尚無法比較。' : values.duration <= values.availableTime ? `時間條件：可配合（活動 ${values.duration} 小時／可投入 ${values.availableTime} 小時）。` : `時間條件：超出可投入時間 ${values.duration - values.availableTime} 小時（活動 ${values.duration} 小時／可投入 ${values.availableTime} 小時）。`;
    const known = INFO_ITEMS.filter(([key]) => data[key] && data[key] !== 'unknown').map(([, label]) => label);
    const missing = INFO_ITEMS.filter(([key]) => !data[key] || data[key] === 'unknown').map(([, label]) => `- ${label}：尚未提供或確認`);
    const extra = [];
    if (data.support === 'unknown') extra.push('- 餐飲／交通補助：尚未提供資訊');
    if (values.duration === null) extra.push('- 活動所需時間：尚未提供');
    if (!data.source) extra.push('- 資訊來源網址：尚未填寫');
    const questions = [...missing.map(s => `- 請向主辦方確認「${s.slice(2).split('：')[0]}」的規則或公告依據。`), ...(data.support === 'unknown' ? ['- 補助的金額、資格與申請／核銷方式為何？'] : []), ...(values.duration === null ? ['- 活動時間是否包含報到、休息及其他必要時段？'] : [])];
    return [
      '機會透明評估工具 Opportunity Clarity — 分析摘要', `活動：${data.eventName || '（未填寫）'}`, '',
      '【經濟負擔】', costLine, budgetLine, '', '【時間條件】', timeLine, '',
      '【公開資訊完整度】', `${result.infoPercent}%（${result.infoCount}/${INFO_ITEMS.length} 項已交代；每項等權 20%。項目：${known.length ? known.join('、') : '目前沒有已交代項目'}。）`,
      '「未提供」只表示手邊資訊不足，不代表不公平、舞弊或惡意。', '', '【待確認資訊】', ...(extra.length ? extra : ['- 目前五項資訊皆已標記有說明或不適用。']), '', '【報名前可詢問】', ...(questions.length ? questions : ['- 請在報名前確認活動資訊是否有更新。']),
      '', `資訊來源：${data.source || '（未填寫）'}`, `活動備註：${data.eventNotes || '（無）'}`, `個人參與考量：${data.personalNotes || '（無）'}`,
      '', '本摘要只依據使用者輸入計算，不判定活動品質、公平性或主辦方意圖。資料僅存於本機瀏覽器。'
    ].join('\n');
  }
  async function copyReport() {
    const text = buildReport(); if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
        const ok = document.execCommand('copy'); area.remove(); if (!ok) throw new Error('copy failed');
      }
      showToast('分析摘要已複製。');
    } catch (_) { showToast('無法自動複製，請改用下載文字報告。'); }
  }
  function downloadReport() {
    const text = buildReport(); if (!text) return;
    const blob = new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    const safeName = (readForm().eventName || '活動').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 48);
    link.download = `機會透明評估-${safeName}.txt`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    showToast('文字報告已下載。');
  }
  form.addEventListener('input', () => { persist(); render(); });
  form.addEventListener('change', () => { persist(); render(); });
  form.addEventListener('submit', event => { event.preventDefault(); const result = render(); persist(); if (!result.errors.length) showToast('分析已更新。'); });
  document.getElementById('demoBtn').addEventListener('click', () => { loadData(DEMO); showToast('已載入示範活動資料。'); });
  document.getElementById('resetBtn').addEventListener('click', () => { form.reset(); errorBox.textContent = ''; persist(); render(); showToast('表單已重設。'); });
  document.getElementById('clearBtn').addEventListener('click', () => { form.reset(); try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} errorBox.textContent = ''; render(); showToast('表單與本機儲存資料已清除。'); });
  document.getElementById('copyBtn').addEventListener('click', copyReport);
  document.getElementById('downloadBtn').addEventListener('click', downloadReport);
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (saved && typeof saved === 'object') loadData(saved); else render(); }
  catch (_) { render(); }
  // Expose pure calculations for offline verification and manual inspection.
  window.OpportunityClarity = Object.freeze({ analyze, demo: Object.freeze({ ...DEMO }) });
})();
