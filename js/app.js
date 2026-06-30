/**
 * Entrada principal - conecta DB, Mapa e UI.
 */
(function () {
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function () {
      console.log('Service Worker registrado');
    }).catch(function (err) {
      console.warn('SW erro:', err);
    });
  }

  // Iniciar app
  DB.open().then(function () {
    return DB.getAllProgress();
  }).then(function (allProgress) {
    // Indexar progresso por poleId
    var progressMap = {};
    allProgress.forEach(function (rec) {
      progressMap[rec.poleId] = rec;
    });

    // Inicializar mapa
    MapController.init();
    MapController.addPoleMarkers(POLES_DATA, progressMap);

    // Inicializar UI
    UI.init(POLES_DATA, allProgress);

    // Esconder splash
    var splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(function () { splash.style.display = 'none'; }, 300);
    }
  }).catch(function (err) {
    console.error('Erro ao iniciar:', err);
    alert('Erro ao iniciar o app: ' + err.message);
  });
})();
