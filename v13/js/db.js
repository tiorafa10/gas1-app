/**
 * IndexedDB wrapper para persistencia offline.
 * Database: gas1_tracking
 * Store: progress (chave: poleId)
 */
const DB = (function () {
  const DB_NAME = 'gas1_tracking';
  const DB_VERSION = 1;
  const STORE_NAME = 'progress';
  let db = null;

  const ACTIVITIES = [
    '8.12.1', '8.12.2', '8.12.3',
    '8.12.4', '8.12.5', '8.12.6'
  ];

  function open() {
    return new Promise(function (resolve, reject) {
      if (db) { resolve(db); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'poleId' });
        }
      };
      request.onsuccess = function (e) {
        db = e.target.result;
        resolve(db);
      };
      request.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  function emptyActivities() {
    const acts = {};
    ACTIVITIES.forEach(function (code) {
      acts[code] = { done: false, date: null };
    });
    return acts;
  }

  function getProgress(poleId) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(poleId);
      request.onsuccess = function () {
        resolve(request.result || { poleId: poleId, activities: emptyActivities() });
      };
      request.onerror = function (e) { reject(e.target.error); };
    });
  }

  function setActivity(poleId, activityCode, done, date) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(poleId);
      getReq.onsuccess = function () {
        const record = getReq.result || { poleId: poleId, activities: emptyActivities() };
        record.activities[activityCode] = { done: done, date: date };
        const putReq = store.put(record);
        putReq.onsuccess = function () { resolve(record); };
        putReq.onerror = function (e) { reject(e.target.error); };
      };
      getReq.onerror = function (e) { reject(e.target.error); };
    });
  }

  function getAllProgress() {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = function () {
        resolve(request.result || []);
      };
      request.onerror = function (e) { reject(e.target.error); };
    });
  }

  function exportAll() {
    return getAllProgress().then(function (records) {
      const lines = ['PoleId;Barramento;Parque;Atividade;Concluido;Data'];
      records.forEach(function (rec) {
        var pole = POLES_DATA.find(function (p) { return p.id === rec.poleId; });
        var parque = pole ? pole.parque : '';
        var barramento = pole ? pole.barramento : '';
        Object.keys(rec.activities).forEach(function (code) {
          var act = rec.activities[code];
          if (act.done) {
            lines.push([rec.poleId, barramento, parque, code, 'Sim', act.date || ''].join(';'));
          }
        });
      });
      return lines.join('\n');
    });
  }

  function downloadCSV() {
    return exportAll().then(function (csv) {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'apontamento_gas1_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return {
    open: open,
    getProgress: getProgress,
    setActivity: setActivity,
    getAllProgress: getAllProgress,
    exportAll: exportAll,
    downloadCSV: downloadCSV,
    ACTIVITIES: ACTIVITIES
  };
})();
