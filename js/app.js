/**
 * Entrada principal - conecta DB, Mapa e UI.
 */
(function () {
  // Registrar Service Worker com auto-update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      console.log('Service Worker registrado');
      // Forcar checagem de atualizacao
      reg.update();
      // Quando novo SW estiver pronto, recarregar
      reg.addEventListener('updatefound', function () {
        var newSW = reg.installing;
        newSW.addEventListener('statechange', function () {
          if (newSW.state === 'activated') {
            window.location.reload();
          }
        });
      });
    }).catch(function (err) {
      console.warn('SW erro:', err);
    });
    // Se o SW controller mudar, recarregar
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      window.location.reload();
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
