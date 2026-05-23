const controlTrigger = document.getElementById('controlTrigger');
const editorPanel = document.getElementById('editorPanel');
const toolButtons = document.querySelectorAll('.tool-btn');
const viewButtons = document.querySelectorAll('.view-btn');
const elemTitle = document.getElementById('elemTitle');
const elemDesc = document.getElementById('elemDesc');
const elemCategory = document.getElementById('elemCategory');
const elemSubCategory = document.getElementById('elemSubCategory');
const elemColor = document.getElementById('elemColor');
const elemFill = document.getElementById('elemFill');
const itemsList = document.getElementById('itemsList');
const legendList = document.getElementById('legendList');
const clearAllBtn = document.getElementById('clearAllBtn');


const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const saveElementBtn = document.getElementById('saveElementBtn');

const jsonImporter = document.getElementById('jsonImporter');
const previewModal = document.getElementById('previewModal');
const jsonPreviewArea = document.getElementById('jsonPreviewArea');
const closeModalBtn = document.getElementById('closeModalBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const confirmDownloadBtn = document.getElementById('confirmDownloadBtn');

const toolSectionTitle = document.getElementById('toolSectionTitle');
const normalToolGrid = document.getElementById('normalToolGrid');
const editTypeContainer = document.getElementById('editTypeContainer');
const editElemType = document.getElementById('editElemType');
const shapeWarning = document.getElementById('shapeWarning');
const autosaveToast = document.getElementById('autosaveToast');

let editMode = false;
let selectedTool = 'marker';
let savedFeatures = []; 
let activeLayers = [];
let tempDrawLayer = null;
let firstClickLatLng = null;
let polygonPoints = [];
let hiddenCategories = new Set();
let hiddenSubCategories = new Set();
let pinnedSubCategories = new Set(); 
let currentOverlayLayer = null;

let editingFeatureId = null; 
let tempEditingType = null;

const mapWidth = 8192;
const mapHeight = 8192;

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 1,
    zoomControl: false,
    attributionControl: false,
    doubleClickZoom: false
});

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

const bounds = [[0, 0], [mapHeight, mapWidth]];
map.fitBounds(bounds);

const mapImages = {
    satellite: 'GTAV-HD-MAP-satellite.jpg',
    atlas: 'GTAV_ATLUS_8192x8192.jpg',
    roadmap: 'GTAV-HD-MAP-roadmap.jpg'
};

function changeMapStyle(styleName) {
    if (currentOverlayLayer) {
        map.removeLayer(currentOverlayLayer);
    }
    currentOverlayLayer = L.imageOverlay(mapImages[styleName], bounds).addTo(map);
}

changeMapStyle('satellite');

async function loadDefaultMarkers() {
    try {
        const response = await fetch('markers.json');
        if (response.ok) {
            savedFeatures = await response.json();
            renderFeatures();
        }
    } catch (e) {}
}
loadDefaultMarkers();

function triggerJsonDownload() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedFeatures, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "markers.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

setInterval(() => {
    if (savedFeatures.length > 0) {
        triggerJsonDownload();
        autosaveToast.classList.add('show');
        setTimeout(() => {
            autosaveToast.classList.remove('show');
        }, 3500);
    }
}, 2 * 60 * 1000);

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
                alert("Erreur : Le fichier doit être une liste de repères valide.");
            }
        } catch (err) {
            alert("Erreur lors de la lecture du JSON. Vérifie sa syntaxe.");
        }
    };
    reader.readAsText(file);
});


downloadJsonBtn.addEventListener('click', () => {
    if (savedFeatures.length === 0) {
        alert("frero y'a rien sur la map tu veux save quoi ?");
        return;
    }
    const jsonString = JSON.stringify(savedFeatures, null, 2);
    jsonPreviewArea.value = `Si tu modifie envoie moi le json pour que je change le truc :)\n\n${jsonString}`;
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
    triggerJsonDownload();
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
    if (!editMode) {
        resetDrawState();
        exitEditFeatureMode();
    }
});

toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (editingFeatureId) return; 
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
    polygonPoints = [];
}

function finishPolygonDrawing() {
    if (!editMode || selectedTool !== 'polygon' || polygonPoints.length < 2) return;

    const title = elemTitle.value.trim() || 'Élément sans nom';
    const desc = elemDesc.value.trim() || '';
    const category = elemCategory.value.trim() || 'Général';
    const subcategory = elemSubCategory.value.trim() || 'Général';
    const color = elemColor.value;
    const fill = elemFill.value;

    savedFeatures.push({
        id: Date.now(),
        type: 'polygon',
        latlngs: [...polygonPoints],
        title, desc, category, subcategory, color, fill
    });
    renderFeatures();
    resetForm();
}

function startEditFeature(id) {
    const feat = savedFeatures.find(f => f.id === id);
    if (!feat) return;

    editingFeatureId = id;
    tempEditingType = feat.type;
    
    elemTitle.value = feat.title;
    elemDesc.value = feat.desc || '';
    elemCategory.value = feat.category || 'Général';
    elemSubCategory.value = feat.subcategory || 'Général';
    elemColor.value = feat.color || '#2563eb';
    if (feat.fill) elemFill.value = feat.fill;

    toolSectionTitle.textContent = "Modification de la forme";
    normalToolGrid.style.display = 'none';
    editTypeContainer.style.display = 'block';
    editElemType.value = feat.type;

    manageShapeWarningVisibility(feat.type);


    downloadJsonBtn.style.display = 'none';
    saveElementBtn.style.display = 'block';

    clearAllBtn.textContent = "Annuler";
    clearAllBtn.classList.remove('btn-danger');
    clearAllBtn.classList.add('btn-secondary');

    resetDrawState();
    elemTitle.focus();
}

editElemType.addEventListener('change', (e) => {
    tempEditingType = e.target.value;
    manageShapeWarningVisibility(tempEditingType);
    resetDrawState();
});

function manageShapeWarningVisibility(type) {
    if (type === 'rectangle' || type === 'circle' || type === 'polygon') {
        shapeWarning.style.display = 'block';
    } else {
        shapeWarning.style.display = 'none';
    }
}

function saveFeatureChanges() {
    if (!editingFeatureId) return;

    const index = savedFeatures.findIndex(f => f.id === editingFeatureId);
    if (index !== -1) {
        const oldFeat = savedFeatures[index];
        
        oldFeat.title = elemTitle.value.trim() || 'Élément sans nom';
        oldFeat.desc = elemDesc.value.trim() || '';
        oldFeat.category = elemCategory.value.trim() || 'Général';
        oldFeat.subcategory = elemSubCategory.value.trim() || 'Général';
        oldFeat.color = elemColor.value;
        oldFeat.fill = elemFill.value;

        if (oldFeat.type !== tempEditingType) {
            oldFeat.type = tempEditingType;
            
            if (tempEditingType === 'marker' || tempEditingType === 'candy' || tempEditingType === 'bunker') {
                if (!firstClickLatLng) {
                    if (oldFeat.latlng) {}
                    else if (oldFeat.bounds) { oldFeat.latlng = L.latLngBounds(oldFeat.bounds).getCenter(); }
                    else if (oldFeat.latlngs) { oldFeat.latlng = L.polygon(oldFeat.latlngs).getBounds().getCenter(); }
                    
                    if (oldFeat.latlng && oldFeat.latlng.lat) {
                        oldFeat.latlng = [parseFloat(oldFeat.latlng.lat.toFixed(2)), parseFloat(oldFeat.latlng.lng.toFixed(2))];
                    }
                }
                delete oldFeat.bounds;
                delete oldFeat.latlngs;
                delete oldFeat.radius;
            } 
        }
    }

    exitEditFeatureMode();
    renderFeatures();
    resetForm();
}

saveElementBtn.addEventListener('click', () => {
    saveFeatureChanges();
});

function exitEditFeatureMode() {
    editingFeatureId = null;
    tempEditingType = null;
    
    toolSectionTitle.textContent = "Outils de dessin";
    normalToolGrid.style.display = 'grid';
    editTypeContainer.style.display = 'none';
    shapeWarning.style.display = 'none';


    downloadJsonBtn.style.display = 'block';
    saveElementBtn.style.display = 'none';
    
    clearAllBtn.textContent = "Vider";
    clearAllBtn.classList.add('btn-danger');
    clearAllBtn.classList.remove('btn-secondary');
}

const inputsToWatch = [elemTitle, elemDesc, elemCategory, elemSubCategory, elemColor, elemFill, editElemType];
inputsToWatch.forEach(input => {
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                if (editingFeatureId) {
                    saveFeatureChanges(); 
                }
            }
        });
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (editingFeatureId) {
            exitEditFeatureMode();
            resetForm();
        } else if (editMode && (firstClickLatLng || polygonPoints.length > 0)) {
            resetDrawState();
        }
    }
});

map.on('click', (e) => {
    if (!editMode) return; 

    const pt = [parseFloat(e.latlng.lat.toFixed(2)), parseFloat(e.latlng.lng.toFixed(2))];

    if (editingFeatureId) {
        const index = savedFeatures.findIndex(f => f.id === editingFeatureId);
        if (index === -1) return;

        const targetType = tempEditingType;
        const color = elemColor.value;
        const fill = elemFill.value;

        if (targetType === 'marker' || targetType === 'candy' || targetType === 'bunker') {
            savedFeatures[index].latlng = pt;
            saveFeatureChanges();
        }
        else if (targetType === 'rectangle') {
            if (!firstClickLatLng) {
                firstClickLatLng = e.latlng;
                tempDrawLayer = L.rectangle([firstClickLatLng, firstClickLatLng], { color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
            } else {
                savedFeatures[index].bounds = [
                    [parseFloat(firstClickLatLng.lat.toFixed(2)), parseFloat(firstClickLatLng.lng.toFixed(2))],
                    pt
                ];
                saveFeatureChanges();
            }
        }
        else if (targetType === 'circle') {
            if (!firstClickLatLng) {
                firstClickLatLng = e.latlng;
                tempDrawLayer = L.circle(firstClickLatLng, { radius: 0, color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
            } else {
                const dx = e.latlng.lng - firstClickLatLng.lng;
                const dy = e.latlng.lat - firstClickLatLng.lat;
                const radius = parseFloat(Math.sqrt(dx * dx + dy * dy).toFixed(2));
                savedFeatures[index].latlng = [parseFloat(firstClickLatLng.lat.toFixed(2)), parseFloat(firstClickLatLng.lng.toFixed(2))];
                savedFeatures[index].radius = radius;
                saveFeatureChanges();
            }
        }
        else if (targetType === 'polygon') {
            polygonPoints.push(pt);
            if (polygonPoints.length === 1) {
                tempDrawLayer = L.polygon([pt, pt], { color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
            } else {
                tempDrawLayer.setLatLngs([...polygonPoints, pt]);
            }
        }
        return;
    }

    const title = elemTitle.value.trim() || 'Élément sans nom';
    const desc = elemDesc.value.trim() || '';
    const category = elemCategory.value.trim() || 'Général';
    const subcategory = elemSubCategory.value.trim() || 'Général';
    const color = elemColor.value;
    const fill = elemFill.value;

    if (selectedTool === 'marker' || selectedTool === 'candy' || selectedTool === 'bunker') {
        savedFeatures.push({
            id: Date.now(),
            type: selectedTool,
            latlng: pt,
            title, desc, category, subcategory, color
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
                    pt
                ],
                title, desc, category, subcategory, color, fill
            });
            renderFeatures();
            resetForm();
        }
    } 
    else if (selectedTool === 'circle') {
        if (!firstClickLatLng) {
            firstClickLatLng = e.latlng;
            tempDrawLayer = L.circle(firstClickLatLng, { radius: 0, color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
        } else {
            const dx = e.latlng.lng - firstClickLatLng.lng;
            const dy = e.latlng.lat - firstClickLatLng.lat;
            const radius = parseFloat(Math.sqrt(dx * dx + dy * dy).toFixed(2));
            savedFeatures.push({
                id: Date.now(),
                type: 'circle',
                latlng: [parseFloat(firstClickLatLng.lat.toFixed(2)), parseFloat(firstClickLatLng.lng.toFixed(2))],
                radius, title, desc, category, subcategory, color, fill
            });
            renderFeatures();
            resetForm();
        }
    }
    else if (selectedTool === 'polygon') {
        polygonPoints.push(pt);
        if (polygonPoints.length === 1) {
            tempDrawLayer = L.polygon([pt, pt], { color, weight: 2, fillOpacity: 0.2, fillColor: fill }).addTo(map);
        } else {
            tempDrawLayer.setLatLngs([...polygonPoints, pt]);
        }
    }
});

map.on('mousemove', (e) => {
    if (!editMode || !tempDrawLayer) return;
    
    const currentType = editingFeatureId ? tempEditingType : selectedTool;

    if (currentType === 'rectangle' && firstClickLatLng) {
        tempDrawLayer.setBounds([firstClickLatLng, e.latlng]);
    } else if (currentType === 'circle' && firstClickLatLng) {
        const dx = e.latlng.lng - firstClickLatLng.lng;
        const dy = e.latlng.lat - firstClickLatLng.lat;
        const radius = Math.sqrt(dx * dx + dy * dy);
        tempDrawLayer.setRadius(radius);
    } else if (currentType === 'polygon' && polygonPoints.length > 0) {
        const mousePt = [parseFloat(e.latlng.lat.toFixed(2)), parseFloat(e.latlng.lng.toFixed(2))];
        tempDrawLayer.setLatLngs([...polygonPoints, mousePt]);
    }
});

map.on('dblclick', (e) => {
    if (editingFeatureId) {
        if (tempEditingType === 'polygon' && polygonPoints.length >= 2) {
            const index = savedFeatures.findIndex(f => f.id === editingFeatureId);
            if (index !== -1) {
                savedFeatures[index].latlngs = [...polygonPoints];
                saveFeatureChanges();
            }
        }
        return;
    }
    finishPolygonDrawing();
});

function resetForm() {
    elemTitle.value = '';
    elemDesc.value = '';
    resetDrawState();
}

function deleteFeature(id) {
    if (editingFeatureId === id) exitEditFeatureMode();
    savedFeatures = savedFeatures.filter(f => f.id !== id);
    renderFeatures();
}

clearAllBtn.addEventListener('click', () => {
    if (editingFeatureId) {
        exitEditFeatureMode();
        resetForm();
        return;
    }
    if (confirm('Voulez-vous effacer tous les éléments actuellement affichés ?')) {
        savedFeatures = [];
        renderFeatures();
    }
});

function renderFeatures() {
    activeLayers.forEach(layer => map.removeLayer(layer));
    activeLayers = [];
    itemsList.innerHTML = '';
    const hierarchy = {};

    savedFeatures.forEach(feat => {
        const cat = feat.category || 'Général';
        const sub = feat.subcategory || 'Général';
        const subKey = `${cat}:${sub}`;

        if (!hierarchy[cat]) hierarchy[cat] = new Set();
        hierarchy[cat].add(sub);

        const isCatHidden = hiddenCategories.has(cat);
        const isSubHidden = hiddenSubCategories.has(subKey);
        const isTitlePinned = pinnedSubCategories.has(subKey);

        const itemRow = document.createElement('div');
        itemRow.className = `saved-item-row ${editingFeatureId === feat.id ? 'editing-active' : ''}`;
        itemRow.innerHTML = `
            <span class="saved-item-name" style="color: ${feat.color}">${feat.title} <small style="color:#64748b">(${sub})</small></span>
            <div class="item-row-actions">
                <span class="edit-item-icon" data-id="${feat.id}">✏️</span>
                <span class="delete-item-icon" data-id="${feat.id}">&times;</span>
            </div>
        `;
        itemRow.querySelector('.edit-item-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!editMode) {
                controlTrigger.click();
            }
            startEditFeature(feat.id);
        });
        itemRow.querySelector('.delete-item-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFeature(feat.id);
        });
        itemRow.addEventListener('click', () => {
            if (feat.type === 'rectangle' && feat.bounds) map.fitBounds(feat.bounds);
            else if (feat.type === 'polygon' && feat.latlngs) map.fitBounds(feat.latlngs);
            else if (feat.latlng) map.setView(feat.latlng, map.getZoom());
        });
        itemsList.appendChild(itemRow);

        if (isCatHidden || isSubHidden) return;

        let layer;
        const content = `<div><h3>${feat.title}</h3>${feat.desc ? `<p>${feat.desc}</p>` : ''}<small style="color:#64748b;display:block;margin-top:4px;">Catégorie: ${cat} | ${sub}</small></div>`;

        if (feat.type === 'marker' && feat.latlng) {
            const customIcon = L.divIcon({
                className: 'custom-div-marker',
                html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="${feat.color}" stroke="#000" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
                popupAnchor: [0, -24]
            });
            layer = L.marker(feat.latlng, { icon: customIcon });
        } 
        else if (feat.type === 'candy' && feat.latlng) {
            const candyIcon = L.icon({
                iconUrl: 'drogue.jpg',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            });
            layer = L.marker(feat.latlng, { icon: candyIcon });
        }
        else if (feat.type === 'bunker' && feat.latlng) {
            const bunkerIcon = L.icon({
                iconUrl: 'bunker.jpg',
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -20],
                className: 'bunker-custom-icon'
            });
            layer = L.marker(feat.latlng, { icon: bunkerIcon });
        }
        else if (feat.type === 'rectangle' && feat.bounds) {
            layer = L.rectangle(feat.bounds, { color: feat.color, weight: 2, fillColor: feat.fill, fillOpacity: 0.25 });
        } 
        else if (feat.type === 'circle' && feat.latlng) {
            layer = L.circle(feat.latlng, { radius: feat.radius || 10, color: feat.color, weight: 2, fillColor: feat.fill, fillOpacity: 0.25 });
        }
        else if (feat.type === 'polygon' && feat.latlngs) {
            layer = L.polygon(feat.latlngs, { color: feat.color, weight: 2, fillColor: feat.fill, fillOpacity: 0.25 });
        }

        if (layer) {
            layer.bindPopup(content).addTo(map);
            activeLayers.push(layer);

            if (isTitlePinned) {
                let labelLatLng = feat.latlng;
                if (feat.type === 'rectangle' && feat.bounds) {
                    labelLatLng = L.latLngBounds(feat.bounds).getCenter();
                } else if (feat.type === 'polygon' && feat.latlngs) {
                    labelLatLng = L.polygon(feat.latlngs).getBounds().getCenter();
                }
                
                if (labelLatLng) {
                    layer.bindTooltip(`<div class="permanent-label-content" style="color: ${feat.color}">${feat.title}</div>`, {
                        permanent: true,
                        direction: 'top',
                        className: 'permanent-map-label',
                        offset: (feat.type === 'marker' || feat.type === 'candy' || feat.type === 'bunker') ? [0, -15] : [0, 0]
                    }).addTo(map);
                }
            }
        }
    });

    renderLegend(hierarchy);
}

function renderLegend(hierarchy) {
    legendList.innerHTML = '';
    const categoriesSorted = Object.keys(hierarchy).sort();

    if (categoriesSorted.length === 0) return;

    categoriesSorted.forEach(cat => {
        const isCatHidden = hiddenCategories.has(cat);
        const catGroup = document.createElement('div');
        catGroup.className = 'legend-cat-group';

        const mainTitle = document.createElement('div');
        mainTitle.className = `legend-main-title ${isCatHidden ? 'muted' : ''}`;
        mainTitle.innerHTML = `<span>${cat}</span><small style="font-size:10px; opacity:0.6;">${isCatHidden ? '👁️ Masqué' : '👁️ Visible'}</small>`;
        
        mainTitle.addEventListener('click', () => {
            if (hiddenCategories.has(cat)) hiddenCategories.delete(cat);
            else hiddenCategories.add(cat);
            renderFeatures();
        });

        catGroup.appendChild(mainTitle);

        const subListContainer = document.createElement('div');
        subListContainer.className = 'legend-sub-list';

        const subCategoriesSorted = Array.from(hierarchy[cat]).sort();
        subCategoriesSorted.forEach(sub => {
            const subKey = `${cat}:${sub}`;
            const isSubHidden = hiddenSubCategories.has(subKey);
            const isTitlePinned = pinnedSubCategories.has(subKey);

            const feat = savedFeatures.find(f => (f.category || 'Général') === cat && (f.subcategory || 'Général') === sub);
            const color = feat ? feat.color : '#2563eb';

            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'legend-item-wrapper';

            const legItem = document.createElement('div');
            legItem.className = `legend-item ${isSubHidden ? 'muted' : ''}`;
            legItem.innerHTML = `<div class="legend-color" style="background-color: ${color}"></div><span>${sub}</span>`;
            
            legItem.addEventListener('click', () => {
                if (hiddenSubCategories.has(subKey)) hiddenSubCategories.delete(subKey);
                else hiddenSubCategories.add(subKey);
                renderFeatures();
            });

            const pinBtn = document.createElement('span');
            pinBtn.className = `pin-title-btn ${isTitlePinned ? 'pinned' : ''}`;
            pinBtn.innerHTML = isTitlePinned ? '📌' : '📍';
            pinBtn.title = isTitlePinned ? "Masquer les titres fixes sur la map" : "Afficher fixement les titres sur la map";
            
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pinnedSubCategories.has(subKey)) pinnedSubCategories.delete(subKey);
                else pinnedSubCategories.add(subKey);
                renderFeatures();
            });

            itemWrapper.appendChild(legItem);
            itemWrapper.appendChild(pinBtn);
            subListContainer.appendChild(itemWrapper);
        });

        catGroup.appendChild(subListContainer);
        legendList.appendChild(catGroup);
    });
}

const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');

searchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchContainer.classList.toggle('open');
    if (searchContainer.classList.contains('open')) {
        searchInput.focus();
    } else {
        searchResults.classList.remove('active');
        searchInput.value = '';
    }
});

searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';

    if (!query) {
        searchResults.classList.remove('active');
        return;
    }

    const matches = savedFeatures.filter(feat => 
        feat.title.toLowerCase().includes(query) || 
        (feat.desc && feat.desc.toLowerCase().includes(query)) ||
        (feat.category && feat.category.toLowerCase().includes(query)) ||
        (feat.subcategory && feat.subcategory.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
        const noResult = document.createElement('div');
        noResult.className = 'search-item';
        noResult.style.color = '#64748b';
        noResult.textContent = 'Aucun résultat trouvé';
        searchResults.appendChild(noResult);
        searchResults.classList.add('active');
        return;
    }

    matches.forEach(feat => {
        const item = document.createElement('div');
        item.className = 'search-item';
        const sub = feat.subcategory || 'Général';
        item.innerHTML = `<strong style="color: ${feat.color || '#2563eb'}">${feat.title}</strong> <span style="color: #64748b; font-size:10px;">(${sub})</span>`;
        
        item.addEventListener('click', () => {
            if (feat.type === 'rectangle' || feat.type === 'polygon') {
                map.fitBounds(feat.bounds || feat.latlngs);
            } else if (feat.latlng) {
                map.setView(feat.latlng, 0);
            }

            activeLayers.forEach(layer => {
                if (layer.getPopup()) {
                    const content = layer.getPopup().getContent();
                    if (content.includes(`<h3>${feat.title}</h3>`)) {
                        layer.openPopup();
                    }
                }
            });

            searchResults.classList.remove('active');
            searchInput.value = '';
            searchContainer.classList.remove('open');
        });

        searchResults.appendChild(item);
    });

    searchResults.classList.add('active');
});

document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
        searchResults.classList.remove('active');
        searchContainer.classList.remove('open');
        searchInput.value = '';
    }
});
