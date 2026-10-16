/* Fade Lineup Atlas Practice Mode. Review data is kept separate from map and image records. */
(function () {
  'use strict';
  const PREFIX = 'fadeAtlasPractice_v1_';
  const HIDE_KEY = 'fadeAtlasPracticeHideAnswers_v1';
  const VALID = new Set(['remembered', 'needs']);
  let active = false;
  let view = 'all';
  let marks = Object.create(null);
  let revealed = new Set();
  let undoSnapshot = null;
  let hideAnswers = true;
  let storageError = false;
  let loadedMapId = currentMapId;

  function readPreference() {
    try { return localStorage.getItem(HIDE_KEY) !== 'false'; }
    catch (_) { storageError = true; return true; }
  }
  function mapKey() { return PREFIX + currentMapId; }
  function loadMarks() {
    loadedMapId = currentMapId;
    marks = Object.create(null);
    revealed.clear();
    undoSnapshot = null;
    try {
      const raw = localStorage.getItem(mapKey());
      if (!raw) return;
      const saved = JSON.parse(raw);
      const entries = saved && typeof saved === 'object' ? saved.statuses : null;
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return;
      for (const [id, status] of Object.entries(entries)) {
        if (VALID.has(status)) marks[id] = status;
      }
    } catch (error) {
      storageError = true;
      console.warn('读取跑图复习记录失败', error);
    }
  }
  function saveMarks() {
    try {
      localStorage.setItem(mapKey(), JSON.stringify({version: 1, statuses: marks}));
      storageError = false;
    } catch (error) {
      storageError = true;
      console.error('跑图复习记录无法保存', error);
    }
  }
  function status(id) { return marks[id] || 'pending'; }
  function totals() {
    const rows = db.lineups || [];
    let remembered = 0, needs = 0;
    for (const row of rows) {
      if (status(row.id) === 'remembered') remembered++;
      if (status(row.id) === 'needs') needs++;
    }
    return {total: rows.length, remembered, needs, pending: rows.length - remembered - needs};
  }
  function getVisibleRows(rows) {
    if (!active || view === 'all') return rows;
    return rows.filter(function (row) { return status(row.id) === view; });
  }
  function shortLabel(s) {
    return s === 'remembered' ? '已掌握' : s === 'needs' ? '需加强' : '待复习';
  }
  function savePreference() {
    try { localStorage.setItem(HIDE_KEY, String(hideAnswers)); }
    catch (_) { storageError = true; }
  }

  const launcher = document.createElement('div');
  launcher.className = 'practice-launch';
  launcher.innerHTML =
    '<div class="practice-launch-copy"><strong>跑图复习 <span>Practice Mode</span></strong>' +
    '<small>用已有点位测试记忆，标记掌握情况，随时开启新一轮</small></div>' +
    '<button type="button" id="practiceToggle" class="practice-launch-button" aria-pressed="false">进入复习模式</button>';

  const panel = document.createElement('section');
  panel.id = 'practicePanel';
  panel.className = 'practice-panel hidden';
  panel.setAttribute('aria-label', '跑图复习面板');
  panel.innerHTML =
    '<div class="practice-panel-top"><div><h2>本轮复习进度</h2><small>仅统计当前地图的全部 Fade 点位，不受下方筛选影响</small></div>' +
    '<button id="practiceReset" type="button" class="practice-reset">↻ 重置本轮</button></div>' +
    '<div class="practice-stats" aria-live="polite">' +
      '<div><strong id="practiceRemembered">0</strong><span>✓ 已掌握</span></div>' +
      '<div><strong id="practiceNeeds">0</strong><span>× 需加强</span></div>' +
      '<div><strong id="practicePending">0</strong><span>○ 待复习</span></div>' +
    '</div>' +
    '<div class="practice-progress-track" role="progressbar" id="practiceProgress" aria-label="本轮完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
      '<div id="practiceProgressDone"></div></div>' +
    '<div class="practice-progress-caption" id="practiceSummary">已复习 0 / 0</div>' +
    '<div class="practice-panel-controls">' +
      '<div class="practice-filters" role="group" aria-label="复习状态筛选">' +
        '<button type="button" data-review-filter="all">全部</button>' +
        '<button type="button" data-review-filter="pending">待复习</button>' +
        '<button type="button" data-review-filter="needs">只看需加强</button>' +
        '<button type="button" data-review-filter="remembered">已掌握</button>' +
      '</div>' +
      '<label class="practice-answer-switch"><input type="checkbox" id="practiceHideAnswers" checked> 隐藏瞄点与投法</label>' +
    '</div>' +
    '<div class="practice-panel-foot"><small>点击「记住了」或「没记住」记录本轮结果，再次点击相同按钮可取消标记。</small>' +
    '<button id="practiceUndo" type="button" class="hidden">撤销上次重置</button></div>' +
    '<div class="practice-warning hidden" id="practiceStorageWarning" role="status">浏览器未能保存复习进度。请检查隐私模式或存储权限；当前页面关闭后记录可能丢失。</div>';

  const toolbar = document.querySelector('#fadeWorkspace .tools');
  if (!toolbar) return;
  toolbar.insertAdjacentElement('afterend', launcher);
  launcher.insertAdjacentElement('afterend', panel);

  const $p = function (id) { return document.getElementById(id); };

  function updateUI() {
    launcher.classList.toggle('active', active);
    panel.classList.toggle('hidden', !active);
    document.body.classList.toggle('practice-mode', active);
    $p('practiceToggle').textContent = active ? '退出复习模式' : '进入复习模式';
    $p('practiceToggle').setAttribute('aria-pressed', String(active));
    $p('practiceHideAnswers').checked = hideAnswers;
    $p('practiceUndo').classList.toggle('hidden', !undoSnapshot);
    $p('practiceStorageWarning').classList.toggle('hidden', !storageError);
    const t = totals();
    $p('practiceRemembered').textContent = t.remembered;
    $p('practiceNeeds').textContent = t.needs;
    $p('practicePending').textContent = t.pending;
    const percent = t.total ? Math.round((t.remembered + t.needs) * 100 / t.total) : 0;
    $p('practiceProgressDone').style.width = percent + '%';
    $p('practiceProgress').setAttribute('aria-valuenow', String(percent));
    $p('practiceSummary').textContent = '本轮已复习 ' + (t.remembered + t.needs) + ' / ' + t.total + '（' + percent + '%）';
    panel.querySelectorAll('[data-review-filter]').forEach(function (button) {
      const chosen = button.dataset.reviewFilter === view;
      button.classList.toggle('active', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
  }

  function applyStatus(id, next) {
    if (!(db.lineups || []).some(function (x) { return x.id === id; })) return;
    const value = status(id) === next ? 'pending' : next;
    if (value === 'pending') delete marks[id];
    else marks[id] = value;
    undoSnapshot = null;
    saveMarks();
    render();
    if (!$p('detailOverlay').classList.contains('hidden') && selected === id) showDetail(id);
  }

  function actionButton(text, name, id, selectedStatus) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'practice-action ' + (selectedStatus ? 'chosen ' + name : '');
    button.textContent = text;
    button.setAttribute('aria-pressed', String(selectedStatus));
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      applyStatus(id, name);
    });
    button.addEventListener('keydown', function (event) { event.stopPropagation(); });
    return button;
  }

  function decorateCard(card, id) {
    const state = status(id);
    card.classList.add('practice-card');
    card.classList.add('practice-status-' + state);
    const masked = hideAnswers && !revealed.has(id);
    card.classList.toggle('practice-masked', masked);

    const line = document.createElement('div');
    line.className = 'practice-card-line';
    line.innerHTML = '<strong>' + (state === 'remembered' ? '✓ ' : state === 'needs' ? '× ' : '○ ') + shortLabel(state) + '</strong>' +
      (masked ? '<span>根据站位图回忆瞄点与投法</span>' : '<span>完整教学已显示</span>');
    const top = card.querySelector('.quick-card-top');
    if (top) top.insertAdjacentElement('afterend', line);

    const actions = document.createElement('div');
    actions.className = 'practice-card-actions';
    actions.appendChild(actionButton('✓ 记住了', 'remembered', id, state === 'remembered'));
    actions.appendChild(actionButton('× 没记住', 'needs', id, state === 'needs'));
    if (hideAnswers) {
      const reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'practice-action practice-reveal';
      reveal.textContent = masked ? '查看答案' : '重新隐藏';
      reveal.setAttribute('aria-expanded', String(!masked));
      reveal.addEventListener('click', function (event) {
        event.stopPropagation();
        if (revealed.has(id)) revealed.delete(id); else revealed.add(id);
        render();
      });
      reveal.addEventListener('keydown', function (event) { event.stopPropagation(); });
      actions.appendChild(reveal);
    }
    card.appendChild(actions);
  }

  function decorateDetail(id) {
    if (!active || $p('detailOverlay').classList.contains('hidden')) {
      $p('detailOverlay').classList.remove('practice-detail-masked');
      return;
    }
    const container = $p('detailContent');
    if (!container) return;
    const existing = document.createElement('div');
    existing.className = 'practice-detail-answer';
    while (container.firstChild) existing.appendChild(container.firstChild);

    const state = status(id);
    const controls = document.createElement('div');
    controls.className = 'practice-detail-controls';
    const label = document.createElement('strong');
    label.textContent = '本轮状态：' + shortLabel(state);
    controls.appendChild(label);
    controls.appendChild(actionButton('✓ 记住了', 'remembered', id, state === 'remembered'));
    controls.appendChild(actionButton('× 没记住', 'needs', id, state === 'needs'));
    container.appendChild(controls);

    const masked = hideAnswers && !revealed.has(id);
    $p('detailOverlay').classList.toggle('practice-detail-masked', masked);
    if (masked) {
      existing.classList.add('hidden');
      const gate = document.createElement('div');
      gate.className = 'practice-answer-gate';
      const heading = document.createElement('strong');
      heading.textContent = '根据站位图回忆这个点位';
      const explanation = document.createElement('p');
      explanation.textContent = '站位参考图会一直显示。请先在自定义地图里回忆瞄点和投法，再查看完整教学核对。';
      const lineup = (db.lineups || []).find(function (row) { return row.id === id; });
      const positionShot = lineup ? quickLineupImages(lineup)[0] : null;
      const preview = document.createElement('div');
      preview.className = 'practice-position-preview';
      if (positionShot && positionShot.src) {
        const previewLabel = document.createElement('span');
        previewLabel.textContent = '站位参考图';
        const previewImage = document.createElement('img');
        previewImage.src = positionShot.src;
        previewImage.alt = (lineup.title || '点位') + '站位参考图';
        previewImage.loading = 'lazy';
        preview.append(previewLabel, previewImage);
      } else {
        preview.classList.add('practice-position-missing');
        preview.textContent = '这个点位还没有站位参考图，请在编辑点位时补充。';
      }
      const revealButton = document.createElement('button');
      revealButton.type = 'button';
      revealButton.className = 'practice-launch-button';
      revealButton.textContent = '查看完整教学答案';
      revealButton.onclick = function () {
        revealed.add(id);
        $p('detailOverlay').classList.remove('practice-detail-masked');
        existing.classList.remove('hidden');
        gate.remove();
        render();
      };
      gate.append(heading, preview, explanation, revealButton);
      container.appendChild(gate);
    }
    container.appendChild(existing);
  }

  const baseFiltered = filtered;
  filtered = function () { return getVisibleRows(baseFiltered()); };

  const baseRender = render;
  render = function () {
    if (loadedMapId !== currentMapId) { view = 'all'; loadMarks(); }
    baseRender();
    updateUI();
    if (!active) return;
    document.querySelectorAll('#cards .card[data-id]').forEach(function (card) {
      decorateCard(card, card.dataset.id);
    });
    if (view !== 'all' && !filtered().length) {
      $p('empty').textContent = '当前复习状态下没有点位。可以切换上方复习状态筛选。';
    }
  };

  const baseDetail = showDetail;
  showDetail = function (id) {
    baseDetail(id);
    decorateDetail(id);
  };

  const baseMapSwitch = switchMapCollection;
  switchMapCollection = async function (id) {
    const before = currentMapId;
    const result = await baseMapSwitch(id);
    if (currentMapId !== before) {
      view = 'all';
      loadMarks();
      render();
    }
    return result;
  };

  $p('practiceToggle').onclick = function () {
    active = !active;
    revealed.clear();
    view = 'all';
    render();
    if (!$p('detailOverlay').classList.contains('hidden') && selected) showDetail(selected);
  };
  panel.querySelectorAll('[data-review-filter]').forEach(function (button) {
    button.onclick = function () { view = button.dataset.reviewFilter; render(); };
  });
  $p('practiceHideAnswers').onchange = function (event) {
    hideAnswers = event.target.checked;
    revealed.clear();
    savePreference();
    render();
    if (!$p('detailOverlay').classList.contains('hidden') && selected) showDetail(selected);
  };
  $p('practiceReset').onclick = function () {
    undoSnapshot = Object.assign(Object.create(null), marks);
    marks = Object.create(null);
    revealed.clear();
    saveMarks();
    render();
    if (!$p('detailOverlay').classList.contains('hidden') && selected) showDetail(selected);
  };
  $p('practiceUndo').onclick = function () {
    if (!undoSnapshot) return;
    marks = undoSnapshot;
    undoSnapshot = null;
    saveMarks();
    render();
    if (!$p('detailOverlay').classList.contains('hidden') && selected) showDetail(selected);
  };

  // Import/export hooks are called only after a successful Atlas import.
  window.fadePractice = {
    exportStateForCurrentMap: function () {
      return {version: 1, statuses: Object.assign({}, marks)};
    },
    importStateForCurrentMap: function (data) {
      if (!data || !data.statuses || typeof data.statuses !== 'object') return;
      const ids = new Set((db.lineups || []).map(function (x) { return x.id; }));
      const next = Object.create(null);
      for (const [id, value] of Object.entries(data.statuses)) {
        if (ids.has(id) && VALID.has(value)) next[id] = value;
      }
      marks = next;
      revealed.clear();
      undoSnapshot = null;
      saveMarks();
      render();
    }
  };

  hideAnswers = readPreference();
  loadMarks();
  updateUI();
  window.addEventListener('storage', function (event) {
    if (event.key === mapKey()) { loadMarks(); render(); }
    if (event.key === HIDE_KEY) {
      hideAnswers = readPreference();
      revealed.clear();
      render();
    }
  });
})();
