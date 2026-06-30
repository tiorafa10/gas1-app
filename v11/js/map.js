/**
 * Controle do mapa Leaflet com tiles offline e marcadores de postes.
 */
var MapController = (function () {
  var map = null;
  var markers = {};       // poleId -> L.circleMarker
  var gpsMarker = null;
  var gpsCircle = null;
  var allParques = [];

  // Cores por status
  var COLOR_NONE = '#9E9E9E';     // cinza
  var COLOR_PARTIAL = '#FF9800';   // laranja
  var COLOR_DONE = '#4CAF50';      // verde

  function init() {
    map = L.map('map', {
      center: [-8.9, -41.82],
      zoom: 13,
      zoomControl: false
    });

    // Zoom no canto direito
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Tiles locais (offline) - maxNativeZoom=15, permite zoom ate 19 escalando os tiles
    L.tileLayer('tiles/{z}/{x}/{y}.png', {
      minZoom: 10,
      maxZoom: 19,
      maxNativeZoom: 15,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Iniciar GPS via API nativa do navegador
    startGPS();
  }

  var lastGPSLatLng = null;

  function updateGPSMarker(latlng, accuracy) {
    var radius = accuracy / 2;
    if (gpsMarker) {
      gpsMarker.setLatLng(latlng);
      gpsCircle.setLatLng(latlng).setRadius(radius);
    } else {
      gpsMarker = L.circleMarker(latlng, {
        radius: 8,
        color: '#2196F3',
        fillColor: '#2196F3',
        fillOpacity: 1,
        weight: 2,
        pane: 'markerPane'
      }).addTo(map);

      gpsCircle = L.circle(latlng, {
        radius: radius,
        color: '#2196F3',
        fillColor: '#2196F3',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(map);
    }

    // Atualizar precisao na barra de status
    var gpsEl = document.getElementById('status-gps');
    if (gpsEl) {
      gpsEl.textContent = 'GPS: ~' + Math.round(accuracy) + 'm';
    }
  }

  function startGPS() {
    if (!navigator.geolocation) return;

    // Watch com GPS real (alta precisao)
    navigator.geolocation.watchPosition(
      function (pos) {
        var latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        lastGPSLatLng = latlng;
        updateGPSMarker(latlng, pos.coords.accuracy);
      },
      function () {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 60000 }
    );
  }

  function centerOnGPS() {
    var btn = document.getElementById('btn-gps');

    if (lastGPSLatLng) {
      map.setView(lastGPSLatLng, 17);
      return;
    }

    if (!navigator.geolocation) {
      alert('GPS nao disponivel neste dispositivo');
      return;
    }

    // Feedback visual - buscando...
    btn.style.background = '#FF9800';

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        lastGPSLatLng = latlng;
        updateGPSMarker(latlng, pos.coords.accuracy);
        map.setView(latlng, 17);
        btn.style.background = '';
      },
      function (err) {
        btn.style.background = '';
        alert('Erro GPS (codigo ' + err.code + '): ' + err.message + '\n\nVerifique se o GPS do celular esta ligado.');
      },
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 10000 }
    );
  }

  function getStatusColor(progress) {
    if (!progress || !progress.activities) return COLOR_NONE;
    var doneCount = 0;
    DB.ACTIVITIES.forEach(function (code) {
      if (progress.activities[code] && progress.activities[code].done) {
        doneCount++;
      }
    });
    if (doneCount === 0) return COLOR_NONE;
    if (doneCount === 6) return COLOR_DONE;
    return COLOR_PARTIAL;
  }

  function addPoleMarkers(poles, progressMap) {
    var parqueSet = {};
    poles.forEach(function (pole) {
      var color = getStatusColor(progressMap[pole.id]);

      var marker = L.circleMarker([pole.lat, pole.lng], {
        radius: 7,
        color: '#333',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9
      }).addTo(map);

      marker.poleId = pole.id;
      marker.poleData = pole;

      marker.on('click', function () {
        UI.showPolePanel(pole);
      });

      // Tooltip com o ID
      marker.bindTooltip(pole.barramento || pole.id, {
        permanent: false,
        direction: 'top',
        className: 'pole-tooltip'
      });

      markers[pole.id] = marker;
      parqueSet[pole.parque] = true;
    });
    allParques = Object.keys(parqueSet).sort();
  }

  function updateMarkerColor(poleId, progress) {
    var marker = markers[poleId];
    if (marker) {
      marker.setStyle({ fillColor: getStatusColor(progress) });
    }
  }

  function filterByParque(parque) {
    Object.keys(markers).forEach(function (id) {
      var marker = markers[id];
      if (!parque || marker.poleData.parque === parque) {
        if (!map.hasLayer(marker)) map.addLayer(marker);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });
  }

  function getParques() {
    return allParques;
  }

  function fitToMarkers(parque) {
    var visibleMarkers = [];
    Object.keys(markers).forEach(function (id) {
      var m = markers[id];
      if (!parque || m.poleData.parque === parque) {
        visibleMarkers.push(m.getLatLng());
      }
    });
    if (visibleMarkers.length > 0) {
      map.fitBounds(L.latLngBounds(visibleMarkers), { padding: [30, 30] });
    }
  }

  return {
    init: init,
    addPoleMarkers: addPoleMarkers,
    updateMarkerColor: updateMarkerColor,
    filterByParque: filterByParque,
    getParques: getParques,
    fitToMarkers: fitToMarkers,
    centerOnGPS: centerOnGPS
  };
})();
