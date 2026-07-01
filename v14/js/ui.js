/**
 * Interface: painel de poste, filtros, estatisticas.
 */
var UI = (function () {
  var currentPole = null;
  var progressCache = {};   // poleId -> progress
  var totalPoles = 0;

  var ACTIVITY_NAMES = {
    '8.12.1': 'Escavacao',
    '8.12.2': 'Distribuicao',
    '8.12.3': 'Implantacao',
    '8.12.4': 'Concretagem',
    '8.12.5': 'Adensamento',
    '8.12.6': 'Selo'
  };

  var ACTIVITY_FULL_NAMES = {
    '8.12.1': 'Escavacao das Estruturas de Concreto (Postes)',
    '8.12.2': 'Distribuicao das Estruturas de Concreto (Postes, Cruzetas)',
    '8.12.3': 'Implantacao de Estruturas de Concreto',
    '8.12.4': 'Concretagem de Fundacao de Postes',
    '8.12.5': 'Adensamento de Fundacao de Postes',
    '8.12.6': 'Aplicacao de Selo (Acabamento)'
  };

  function init(poles, allProgress) {
    totalPoles = poles.length;

    // Indexar progresso
    allProgress.forEach(function (rec) {
      progressCache[rec.poleId] = rec;
    });

    updateStats();

    // Fechar painel ao clicar no overlay
    document.getElementById('panel-overlay').addEventListener('click', hidePolePanel);

    // Botao GPS
    document.getElementById('btn-gps').addEventListener('click', function () {
      MapController.centerOnGPS();
    });

    // Botao exportar
    document.getElementById('btn-export').addEventListener('click', function () {
      DB.downloadCSV();
    });

    // Fechar painel
    document.getElementById('btn-close-panel').addEventListener('click', hidePolePanel);

    // Salvar apontamento
    document.getElementById('btn-save-panel').addEventListener('click', saveChanges);
  }

  // Estado temporario das mudancas antes de salvar
  var pendingChanges = {};

  function showPolePanel(pole) {
    currentPole = pole;
    pendingChanges = {};
    var panel = document.getElementById('pole-panel');
    var overlay = document.getElementById('panel-overlay');

    // Info do poste
    document.getElementById('pole-title').textContent = pole.id;
    document.getElementById('pole-parque').textContent = pole.parque;
    document.getElementById('pole-barramento').textContent = pole.barramento || '-';
    document.getElementById('pole-topologia').textContent = pole.topologia || '-';
    document.getElementById('pole-ancoragem').textContent = pole.ancoragem || '-';
    document.getElementById('pole-posicao').textContent = pole.posicao || '-';
    document.getElementById('pole-altura').textContent = pole.altura || '-';
    document.getElementById('pole-esforco').textContent = pole.esforco || '-';

    // Atividades
    var progress = progressCache[pole.id] || { poleId: pole.id, activities: {} };
    var container = document.getElementById('activities-list');
    container.innerHTML = '';

    DB.ACTIVITIES.forEach(function (code) {
      var act = (progress.activities && progress.activities[code]) || { done: false, date: null };
      var row = document.createElement('div');
      row.className = 'activity-row' + (act.done ? ' done' : '');
      row.setAttribute('data-code', code);

      var info = document.createElement('div');
      info.className = 'activity-info';

      var name = document.createElement('span');
      name.className = 'activity-name';
      name.textContent = code + ' ' + ACTIVITY_NAMES[code];
      info.appendChild(name);

      if (act.done && act.date) {
        var dateEl = document.createElement('span');
        dateEl.className = 'activity-date';
        var d = new Date(act.date);
        dateEl.textContent = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        info.appendChild(dateEl);
      }

      var toggle = document.createElement('button');
      toggle.className = 'activity-toggle' + (act.done ? ' active' : '');
      toggle.textContent = act.done ? '\u2714' : '';
      toggle.setAttribute('data-code', code);
      toggle.addEventListener('click', function () {
        var newDone = !toggle.classList.contains('active');
        toggle.classList.toggle('active');
        toggle.textContent = newDone ? '\u2714' : '';
        row.classList.toggle('done', newDone);
        pendingChanges[code] = newDone;
        // Mostrar/esconder botao salvar
        document.getElementById('btn-save-panel').style.display = 'block';
      });

      row.appendChild(info);
      row.appendChild(toggle);
      container.appendChild(row);
    });

    // Esconder botao salvar ate haver mudanca
    document.getElementById('btn-save-panel').style.display = 'none';

    overlay.classList.add('visible');
    panel.classList.add('visible');
  }

  function hidePolePanel() {
    document.getElementById('pole-panel').classList.remove('visible');
    document.getElementById('panel-overlay').classList.remove('visible');
    currentPole = null;
  }

  function saveChanges() {
    if (!currentPole || Object.keys(pendingChanges).length === 0) return;

    var poleId = currentPole.id;
    var codes = Object.keys(pendingChanges);
    var btn = document.getElementById('btn-save-panel');

    // Salvar sequencialmente para evitar conflito no IndexedDB
    var chain = Promise.resolve(null);
    codes.forEach(function (code) {
      chain = chain.then(function () {
        var done = pendingChanges[code];
        var date = done ? new Date().toISOString() : null;
        return DB.setActivity(poleId, code, done, date);
      });
    });

    chain.then(function (lastRecord) {
      progressCache[poleId] = lastRecord;
      MapController.updateMarkerColor(poleId, lastRecord);
      updateStats();
      pendingChanges = {};

      // Feedback visual
      btn.textContent = 'Salvo!';
      btn.style.background = '#388E3C';
      setTimeout(function () {
        btn.textContent = 'Salvar Apontamento';
        btn.style.background = '';
        btn.style.display = 'none';
        hidePolePanel();
      }, 800);
    }).catch(function (err) {
      alert('Erro ao salvar: ' + err.message);
    });
  }

  function updateStats() {
    var completed = 0;
    var partial = 0;
    Object.keys(progressCache).forEach(function (id) {
      var rec = progressCache[id];
      if (!rec.activities) return;
      var doneCount = 0;
      DB.ACTIVITIES.forEach(function (code) {
        if (rec.activities[code] && rec.activities[code].done) doneCount++;
      });
      if (doneCount === 6) completed++;
      else if (doneCount > 0) partial++;
    });

    document.getElementById('stats-completed').textContent = completed;
    document.getElementById('stats-partial').textContent = partial;
    document.getElementById('stats-total').textContent = totalPoles;
  }

  function getProgressCache() {
    return progressCache;
  }

  return {
    init: init,
    showPolePanel: showPolePanel,
    hidePolePanel: hidePolePanel,
    getProgressCache: getProgressCache
  };
})();
