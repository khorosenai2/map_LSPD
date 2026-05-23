const controlTrigger = document.getElementById('controlTrigger');
const editorPanel = document.getElementById('editorPanel');
const toolButtons = document.querySelectorAll('.tool-btn');
const viewButtons = document.querySelectorAll('.view-btn');
const elemTitle = document.getElementById('elemTitle');
const elemDesc = document.getElementById('elemDesc');
const elemCategory = document.getElementById('elemCategory');
const elemColor = document.getElementById('elemColor');
const elemFill = document.getElementById('elemFill');
const itemsList = document.getElementById('itemsList');
const legendList = document.getElementById('legendList');
const clearAllBtn = document.getElementById('clearAllBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const jsonImporter = document.getElementById('jsonImporter');

const previewModal = document.getElementById('previewModal');
const jsonPreviewArea = document.getElementById('jsonPreviewArea');
const closeModalBtn = document.getElementById('closeModalBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const confirmDownloadBtn = document.getElementById('confirmDownloadBtn');

let editMode = false;
let selectedTool = 'marker';
let savedFeatures = []; 
let activeLayers = [];
let tempDrawLayer = null;
let firstClickLatLng = null;
let hiddenCategories = new Set();
let currentOverlayLayer = null;

const mapWidth = 8192;
const mapHeight = 8192;

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 1,
    zoomControl: false,
    attributionControl: false
});

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

const bounds = [[0, 0], [mapHeight, mapWidth]];
map.fitBounds(bounds);

const mapImages = {
    atlas: 'GTAV_ATLUS_8192x8192.jpg',
    satellite: 'GTAV-HD-MAP-satellite.jpg',
    roadmap: 'GTAV-HD-MAP-roadmap.jpg'
};

function changeMapStyle(styleName) {
    if (currentOverlayLayer) {
        map.removeLayer(currentOverlayLayer);
    }
    currentOverlayLayer = L.imageOverlay(mapImages[styleName], bounds).addTo(map);
}

changeMapStyle('atlas');

async function loadDefaultMarkers() {
    try {
        const response = await fetch('markers.json');
        if (response.ok) {
            savedFeatures = await response.json();
            renderFeatures();
        }
    } catch (e) {
        console.log("Fichier markers.json par défaut introuvable.");
    }
}
loadDefaultMarkers();

jsonImporter.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (Array.isArray(parsedData)) {
                savedFeatures = parsedData;
                renderFeatures();
                alert("Fichier JSON chargé avec succès !");
            } else {
                alert("Erreur : Le fichier doit être une liste de repères valide [ ... ].");
            }
        } catch (err) {
            alert("Erreur lors de la lecture du JSON. Vérifie sa syntaxe.");
        }
    };
    reader.readAsText(file);
});

downloadJsonBtn.addEventListener('click', () => {
    if (savedFeatures.length === 0) {
        alert("Rien à sauvegarder ! Crée d'abord des éléments sur la carte.");
        return;
    }

    const jsonString = JSON.stringify(savedFeatures, null, 2);
    
    jsonPreviewArea.value = `// Ton commentaire ici : à modifier à la ligne 101 du fichier app.js\n// Aperçu avant export final\n\n${jsonString}`;
    
    previewModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    previewModal.classList.remove('active');
});

copyCodeBtn.addEventListener('click', () => {
    jsonPreviewArea.select();
    navigator.clipboard.writeText(jsonPreviewArea.value);
    alert("Code JSON copié dans le presse-papier !");
});

confirmDownloadBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedFeatures, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "markers.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    previewModal.classList.remove('active');
});

viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        changeMapStyle(btn.getAttribute('data-style'));
    });
});

controlTrigger.addEventListener('click', () => {
    editMode = !editMode;
    controlTrigger.classList.toggle('active', editMode);
    editorPanel.classList.toggle('open', editMode);
    if (!editMode) resetDrawState();
});

toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        toolButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTool = btn.getAttribute('data-type');
        resetDrawState();
    });
});

function resetDrawState() {
    if (tempDrawLayer) {
        map.removeLayer(tempDrawLayer);
        tempDrawLayer = null;
    }
    firstClickLatLng = null;
}

map.on('click', (e) => {
    if (!editMode) return;

    const title = elemTitle.value.trim() || 'Élément sans nom';
    const desc = elemDesc.value.trim() || '';
    const category = elemCategory.value.trim() || 'Général';
    const color = elemColor.value;
    const fill = elemFill.value;

    if (selectedTool === 'marker') {
        savedFeatures.push({
            id: Date.now(),
            type: 'marker',
            latlng: [parseFloat(e.latlng.lat.toFixed(2)), parseFloat(e.latlng.lng.toFixed(2))],
            title, desc, category, color
        });
        renderFeatures();
        resetForm();
    } 
    else if (selectedTool === 'rectangle') {
        if (!firstClickLatLng) {
            firstClickLatLng = e.latlng;
            tempDrawLayer = L.rectangle([firstClickLatLng, firstClickLatLng], { color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
        } else {
            savedFeatures.push({
                id: Date.now(),
                type: 'rectangle',
                bounds: [
                    [parseFloat(firstClickLatLng.lat.toFixed(2)), parseFloat(firstClickLatLng.lng.toFixed(2))],
                    [parseFloat(e.latlng.lat.toFixed(2)), parseFloat(e.latlng.lng.toFixed(2))]
                ],
                title, desc, category, color, fill
            });
            renderFeatures();
            resetForm();
        }
    } 
    else if (selectedTool === 'circle') {
        if (!firstClickLatLng) {
            firstClickLatLng = e.latlng;
            tempDrawLayer = L.circle(firstClickLatLng, { radius: 1, color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
        } else {
            const radius = parseFloat(firstClickLatLng.distanceTo(e.latlng).toFixed(2));
            savedFeatures.push({
                id: Date.now(),
                type: 'circle',
                latlng: [parseFloat(firstClickLatLng.lat.toFixed(2)), parseFloat(firstClickLatLng.lng.toFixed(2))],
                radius, title, desc, category, color, fill
            });
            renderFeatures();
            resetForm();
        }
    }
});

map.on('mousemove', (e) => {
    if (!editMode || !firstClickLatLng || !tempDrawLayer) return;
    if (selectedTool === 'rectangle') {
        tempDrawLayer.setBounds([firstClickLatLng, e.latlng]);
    } else if (selectedTool === 'circle') {
        tempDrawLayer.setRadius(firstClickLatLng.distanceTo(e.latlng));
    }
});

function resetForm() {
    elemTitle.value = '';
    elemDesc.value = '';
    resetDrawState();
}

function deleteFeature(id) {
    savedFeatures = savedFeatures.filter(f => f.id !== id);
    renderFeatures();
}

clearAllBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous effacer tous les éléments actuellement affichés ?')) {
        savedFeatures = [];
        renderFeatures();
    }
});

function renderFeatures() {
    activeLayers.forEach(layer => map.removeLayer(layer));
    activeLayers = [];
    itemsList.innerHTML = '';
    const categories = new Set();

    savedFeatures.forEach(feat => {
        categories.add(feat.category);
        const isHidden = hiddenCategories.has(feat.category);

        const itemRow = document.createElement('div');
        itemRow.className = 'saved-item-row';
        itemRow.innerHTML = `
            <span class="saved-item-name" style="color: ${feat.color}">${feat.title} <small style="color:#64748b">(${feat.category})</small></span>
            <span class="delete-item-icon" data-id="${feat.id}">&times;</span>
        `;
        itemRow.querySelector('.delete-item-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFeature(feat.id);
        });
        itemRow.addEventListener('click', () => {
            if (feat.type === 'rectangle') map.fitBounds(feat.bounds);
            else map.setView(feat.latlng, map.getZoom());
        });
        itemsList.appendChild(itemRow);

        if (isHidden) return;

        let layer;
        const content = `<div><h3>${feat.title}</h3>${feat.desc ? `<p>${feat.desc}</p>` : ''}<small style="color:#64748b;display:block;margin-top:4px;">Catégorie: ${feat.category}</small></div>`;

        if (feat.type === 'marker') {
            const customIcon = L.divIcon({
                className: 'custom-div-marker',
                html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="${feat.color}" stroke="#000" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
                popupAnchor: [0, -24]
            });
            layer = L.marker(feat.latlng, { icon: customIcon });
        } else if (feat.type === 'rectangle') {
            layer = L.rectangle(feat.bounds, { color: feat.color, weight: 2, fillColor: feat.fill, fillOpacity: 0.25 });
        } else if (feat.type === 'circle') {
            layer = L.circle(feat.latlng, { radius: feat.radius, color: feat.color, weight: 2, fillColor: feat.fill, fillOpacity: 0.25 });
        }

        if (layer) {
            layer.bindPopup(content).addTo(map);
            activeLayers.push(layer);
        }
    });
    renderLegend(Array.from(categories));
}

function renderLegend(categoriesList) {
    legendList.innerHTML = '';
    if (categoriesList.length === 0) return;
    
    categoriesList.forEach(cat => {
        const feat = savedFeatures.find(f => f.category === cat);
        const color = feat ? feat.color : '#2563eb';
        const isHidden = hiddenCategories.has(cat);

        const legItem = document.createElement('div');
        legItem.className = `legend-item ${isHidden ? 'muted' : ''}`;
        legItem.innerHTML = `<div class="legend-color" style="background-color: ${color}"></div><span>${cat}</span>`;
        legItem.addEventListener('click', () => {
            if (hiddenCategories.has(cat)) hiddenCategories.delete(cat);
            else hiddenCategories.add(cat);
            renderFeatures();
        });
        legendList.appendChild(legItem);
    });
}