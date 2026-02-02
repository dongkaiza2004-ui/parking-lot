/***********************
 * GLOBAL STATE
 ***********************/
let draftLayout = [];
let activeLayout = [];
let selected = null;

const viewState = {
    editor: { scale: 1, x: 0, y: 0 },
    parking: { scale: 1, x: 0, y: 0 }
};

/***********************
 * STORAGE
 ***********************/
function saveDraft() {
    localStorage.setItem(
        "parking_draftLayout",
        JSON.stringify(draftLayout)
    );
}

function saveActive() {
    localStorage.setItem(
        "parking_activeLayout",
        JSON.stringify(activeLayout)
    );
}

function loadFromStorage() {
    const draft  = localStorage.getItem("parking_draftLayout");
    const active = localStorage.getItem("parking_activeLayout");

    if (draft) {
        try { draftLayout = JSON.parse(draft); } catch {}
    }
    if (active) {
        try { activeLayout = JSON.parse(active); } catch {}
    }
}

loadFromStorage();

/***********************
 * NAVIGATION
 ***********************/
function showSection(id) {
    document.querySelectorAll(".section")
        .forEach(s => s.classList.remove("active"));

    document.getElementById(id).classList.add("active");

    if (id === "settings") renderEditor();
    if (id === "parking")  renderParking();
}

/***********************
 * ADD
 ***********************/
function addArea() {
    draftLayout.push({
        type: "area",
        name: areaName.value || "A",
        rows: +areaRows.value,
        cols: +areaCols.value,
        x: 40,
        y: 40
    });
    saveDraft();
    renderEditor();
}

function addRoad() {
    draftLayout.push({
        type: "road",
        x: 120,
        y: 300,
        w: 320,
        h: 50
    });
    saveDraft();
    renderEditor();
}

/***********************
 * DELETE
 ***********************/
function deleteSelected() {
    if (!selected) return;
    draftLayout = draftLayout.filter(o => o !== selected);
    selected = null;
    saveDraft();
    renderEditor();
}

/***********************
 * ACCEPT
 ***********************/
function acceptLayout() {
    activeLayout = JSON.parse(JSON.stringify(draftLayout));
    saveActive();
    alert("Đã áp dụng & lưu sơ đồ");
}

/***********************
 * EDITOR RENDER
 ***********************/
function renderEditor() {
    editorInner.innerHTML = "";
    draftLayout.forEach(o => {
        const el = o.type === "area"
            ? renderArea(o, true)
            : renderRoad(o, true);

        el.onclick = e => {
            e.stopPropagation();
            select(o, el);
        };

        editorInner.appendChild(el);
    });
}

/***********************
 * PARKING RENDER
 ***********************/
function renderParking() {
    parkingInner.innerHTML = "";
    activeLayout.forEach(o => {
        parkingInner.appendChild(
            o.type === "area"
                ? renderArea(o, false)
                : renderRoad(o, false)
        );
    });
    mockMQTT();
}

/***********************
 * SELECT
 ***********************/
function select(o, el) {
    selected = o;
    document.querySelectorAll(".selected")
        .forEach(e => e.classList.remove("selected"));
    el.classList.add("selected");
}

/***********************
 * AREA
 ***********************/
function renderArea(o, edit) {
    const el = document.createElement("div");
    el.className = "area";
    el.style.left = o.x + "px";
    el.style.top  = o.y + "px";
    el.innerHTML = `<h4>KHU ${o.name}</h4>`;

    const g = document.createElement("div");
    g.className = "grid";
    g.style.gridTemplateColumns = `repeat(${o.cols},1fr)`;

    for (let i = 0; i < o.rows * o.cols; i++) {
        const s = document.createElement("div");
        s.className = "slot nodata";
        g.appendChild(s);
    }

    el.appendChild(g);
    if (edit) drag(el, o);
    return el;
}

/***********************
 * ROAD
 ***********************/
function renderRoad(o, edit) {
    const el = document.createElement("div");
    el.className = "road";
    Object.assign(el.style, {
        left:   o.x + "px",
        top:    o.y + "px",
        width:  o.w + "px",
        height: o.h + "px"
    });

    if (edit) {
        drag(el, o);

        const r = document.createElement("div");
        r.className = "resize";
        r.onmousedown = e => {
            e.stopPropagation();

            document.onmousemove = ev => {
                o.w = Math.max(
                    60,
                    (ev.clientX - el.getBoundingClientRect().left)
                    / viewState.editor.scale
                );
                o.h = Math.max(
                    30,
                    (ev.clientY - el.getBoundingClientRect().top)
                    / viewState.editor.scale
                );
                el.style.width  = o.w + "px";
                el.style.height = o.h + "px";
            };

            document.onmouseup = () => {
                document.onmousemove = null;
                saveDraft();
            };
        };
        el.appendChild(r);
    }
    return el;
}

/***********************
 * DRAG (WORLD SPACE)
 ***********************/
function drag(el, o) {
    el.onmousedown = e => {
        if (e.button !== 0) return;
        e.preventDefault();

        const canvas = el.closest(".editor-canvas");
        const state  = viewState.editor;
        const rect   = canvas.getBoundingClientRect();

        const startX = (e.clientX - rect.left - state.x) / state.scale;
        const startY = (e.clientY - rect.top  - state.y) / state.scale;
        const ox = o.x, oy = o.y;

        document.onmousemove = ev => {
            const mx = (ev.clientX - rect.left - state.x) / state.scale;
            const my = (ev.clientY - rect.top  - state.y) / state.scale;
            o.x = ox + (mx - startX);
            o.y = oy + (my - startY);
            el.style.left = o.x + "px";
            el.style.top  = o.y + "px";
        };

        document.onmouseup = () => {
            document.onmousemove = null;
            saveDraft();
        };
    };
}

/***********************
 * ZOOM
 ***********************/
function enableZoom(canvas, inner, key) {
    const state = viewState[key];

    canvas.addEventListener("wheel", e => {
        e.preventDefault();

        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;

        const zoom = e.deltaY < 0 ? 1.1 : 0.9;
        const ns = Math.min(3, Math.max(0.3, state.scale * zoom));

        const wx = (mx - state.x) / state.scale;
        const wy = (my - state.y) / state.scale;

        state.x = mx - wx * ns;
        state.y = my - wy * ns;
        state.scale = ns;

        inner.style.transform =
            `translate(${state.x}px,${state.y}px) scale(${state.scale})`;
    });
}

/***********************
 * PAN
 ***********************/
function enablePan(canvas, inner, key) {
    const state = viewState[key];
    let panning = false;
    let sx = 0, sy = 0;

    canvas.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        if (e.target.closest(".area") || e.target.closest(".road")) return;

        panning = true;
        sx = e.clientX - state.x;
        sy = e.clientY - state.y;
        canvas.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", e => {
        if (!panning) return;
        state.x = e.clientX - sx;
        state.y = e.clientY - sy;
        inner.style.transform =
            `translate(${state.x}px,${state.y}px) scale(${state.scale})`;
    });

    document.addEventListener("mouseup", () => {
        if (!panning) return;
        panning = false;
        canvas.style.cursor = "default";
    });
}

/***********************
 * ENABLE
 ***********************/
enableZoom(editorCanvas, editorInner, "editor");
enableZoom(parkingCanvas, parkingInner, "parking");
enablePan(editorCanvas, editorInner, "editor");
enablePan(parkingCanvas, parkingInner, "parking");

/***********************
 * MOCK MQTT
 ***********************/
function mockMQTT() {
    document.querySelectorAll(".slot").forEach(s => {
        const r = Math.random();
        s.className =
            "slot " + (r < 0.4 ? "free" : r < 0.7 ? "busy" : "nodata");
    });
}

/***********************
 * BLOCK RIGHT CLICK
 ***********************/
document.addEventListener("contextmenu", e => e.preventDefault());

/***********************
 * INIT
 ***********************/
renderEditor();
