// initialisation et ajouter les maps
var map = L.map('map').setView([29.0860066, -8.9037855], 5);
var esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics'
});
var esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'esri Satellite'
}).addTo(map);
var esriGray = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'esri Gray'
});
var baseMaps = {
     "ESRI Satellite": esriSat,
     "ESRI Topo": esriTopo,
};
// Fonction pour définir la couleur selon un attribut (ex: "ID_PROV")
function getColor(d) {
    return d > 1000000  ? '#ff0000' :
           d > 100000   ? '#fbff03' :
           d > 10000    ? '#00700f' :
                          '#ffffff'; // Default color
}

// Définition du style dynamique
function styleProvince(feature) {
    return {
        fillColor: getColor(feature.properties.Population), // Remplacez par votre attribut
        weight: 2,
        opacity: 1,
        color: 'black', // Couleur de la bordure
        dashArray: '3',
        fillOpacity: '1'
    };
}
// couche WMS
// 1. Définition des couches (votre code)
var wmsLayer = L.tileLayer.wms("http://localhost:8080/geoserver/wms", {
    layers: "gage-geoportail:population_region",
    format: "image/png",
    transparent: true,
});

var geojsonLayer = L.geoJSON(null, {
    style: styleProvince,
    onEachFeature: function(feature, layer) {
        layer.bindPopup("Province: " + feature.properties.nom + "<br>Population: " + feature.properties.Population);
    }
});

fetch('geojson/Province.geojson')
    .then(res => res.json())
    .then(data => geojsonLayer.addData(data));

// 2. Ajout du contrôleur
var overlayMaps = {
    "maroc region": wmsLayer,
    "maroc province": geojsonLayer
};
L.control.layers(baseMaps, overlayMaps).addTo(map);
// 3. Gestion dynamique de la légende
function updateLegend() {
    // Supprimer la légende existante
    if (window.currentLegend) {
        map.removeControl(window.currentLegend);
        window.currentLegend = null;
    }

    var hasWMS = map.hasLayer(wmsLayer);
    var hasGeoJSON = map.hasLayer(geojsonLayer);

    // Si aucune couche n'est active, on ne crée rien
    if (!hasWMS && !hasGeoJSON) return;

    window.currentLegend = L.control({ position: "bottomright" });

    window.currentLegend.onAdd = function() {
        var div = L.DomUtil.create("div", "info legend");
        // Style CSS rapide pour le conteneur
        div.style.background = "white";
        div.style.padding = "8px";
        div.style.lineHeight = "18px";
        div.style.boxShadow = "0 0 15px rgba(0,0,0,0.2)";
        div.style.borderRadius = "5px";

        var content = "<strong>Légende</strong><br>";
        // Bloc WMS (Récupère l'image depuis GeoServer)
        if (hasWMS) {
            var legendUrl = "http://localhost:8080/geoserver/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=gage-geoportail:population_region";
            content += `<div style="margin-top:10px;">
                          <b>Régions</b><br>
                          <img src="${legendUrl}" alt="Légende Régions">
                        </div>`;
        }

        // Bloc GeoJSON
        if (hasGeoJSON) {
    var grades = [10000, 100000, 1000000];
    content += '<div style="margin-top:10px;"><b>Provinces (Densité)</b><br>';
    for (var i = 0; i < grades.length; i++) {
        content += '<i style="background:' + getColor(grades[i] + 1) + '; width:12px; height:12px; display:inline-block"></i> ' +
            grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
    }
    content += '</div>';
}

        div.innerHTML = content;
        return div;
    };

    window.currentLegend.addTo(map);
}

// 4. Écouteurs d'événements
map.on('overlayadd overlayremove', updateLegend);
var date = new Date();
// ajouter print control
L.control.browserPrint({
    title: 'Imprimer la carte',
    documentTitle: 'Carte thématique marocaine',
    printModes: [
        L.BrowserPrint.Mode.Landscape("A4", {
            header: {
                enabled: true,
                text: "<span style='font-size: 24px; font-weight: bold; color: #000000; text-transform: uppercase;'>Carte Thématique du Maroc</span>",
                size: "10mm",
                overTheMap: false
            },
            footer: {
                enabled: true,
                text: "<span>www.geoportail.ma - 2026</span>",
                size: "10mm",
                overTheMap: false
            }
        }),
        "Portrait",
        L.BrowserPrint.Mode.Auto("B4", { title: "Auto" }),
        L.BrowserPrint.Mode.Custom("B5", { title: "Zone personnalisée" })
    ],
    manualMode: false
}).addTo(map);
// ajouter les outils de dessin
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
var drawControl = new L.Control.Draw({
    edit: {featureGroup: drawnItems},
    draw: {
        polygon: true,
        polyline: true,
        rectangle: true,
        circle: false,
        marker: false,
        circlemarker: true
    }
});
map.addControl(drawControl);
// les evenements de dessin
map.on(L.Draw.Event.CREATED, function(e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        mesure(e);
});
map.on(L.Draw.Event.EDITED, mesure);
// fonction de calculer distance et area
function mesure(e)
    {
    const layer = e.layer || e.layers.getLayers()[0];
    const geojson = layer.toGeoJSON();
    let result = '';
if (geojson.geometry.type === 'LineString') {
        const length = turf.length(geojson, {units: 'meters'});
        result = `Length: ${length.toFixed(2)} m`;
}
if (geojson.geometry.type === 'Polygon') {
    const area = turf.area(geojson);
    result = `Area: ${area.toFixed(2)} m²`
}
if (geojson.geometry.type === 'Point') {
    result = `Point: ${geojson.geometry.coordinates[0]}, ${geojson.geometry.coordinates[1]}`;
}
layer.bindPopup(result).openPopup();
    }
//ajouter bare d'echelle
var echelle = new L.control.scale({metric: true, imperial: false, position: 'bottomleft'}).addTo(map);
// ajouter mini map postion bottom left
var miniMap = new L.Control.MiniMap(esriGray, { toggleDisplay: false, position: 'bottomleft' }).addTo(map);
map.on("browser-print-start", function(e) {
    var printMap = e.printMap;
    printMap.setView(map.getCenter(), map.getZoom());
    miniMap.setPosition('topright').addTo(e.printMap);
    var printNorth = L.control({position: "topleft"});
    printNorth.onAdd = function(printMap) {
        var div = L.DomUtil.create("div", "info north");
        div.innerHTML = '<img src="/images/flech-nord.png" alt="North Arrow" style="width:50px; height:50px;">';
        return div;
    };
    printNorth.addTo(printMap);
    echelle.addTo(printMap);
    if (window.currentLegend) {
        var printLegend = L.control({ position: "bottomright" });
        printLegend.onAdd = function() {
            // Utilisation de la méthode JS native pour cloner le contenu HTML
            var clone = window.currentLegend.getContainer().cloneNode(true);
            return clone;
        };
        printLegend.addTo(printMap);
    }
});
