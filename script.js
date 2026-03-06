const GAS_URL = "https://script.google.com/macros/s/AKfycbzPpqtxTZyr_bC_DxbJrEMqlp-jQjDwiQt12TXLjsM9rlucGgfRoPabtBh_-IEfo4RL/exec";

async function loadInOut() {
    try {
        const res = await fetch(GAS_URL);
        const logs = await res.json();

        if (!Array.isArray(logs)) {
            console.error("Dữ liệu không hợp lệ", logs);
            alert("GAS chưa có dữ liệu hoặc lỗi");
            return;
        }

        processLogs(logs);

    } catch (err) {
        console.error(err);
        alert("Không tải được dữ liệu");
    }
}
function processLogs(logs) {

    const map = {};
    const validUIDs = new Set(addedUIDs);

    validUIDs.forEach(uid => {
        map[uid] = {
            lastIn: null,
            lastOut: null,
            location: "-"
        };
    });

    logs.forEach(item => {

        if (!validUIDs.has(item.uid)) return;

        const time = new Date(item.time);

        // ghép area + slot
        const location = item.area + item.slot;

        if (item.direction === "IN") {

            if (!map[item.uid].lastIn || time > map[item.uid].lastIn) {
                map[item.uid].lastIn = time;
                map[item.uid].location = location;   
            }

        }

        if (item.direction === "OUT") {

            if (!map[item.uid].lastOut || time > map[item.uid].lastOut) {
                map[item.uid].lastOut = time;
            }

        }

    });

    renderInOutTable(map);
}
function renderInOutTable(map) {

    let insideCount = 0;
    const tbody = document.getElementById("inoutTableBody");
    tbody.innerHTML = "";

    for (const uid in map) {

        const { lastIn, lastOut, location } = map[uid];

        let status = "Chưa vào";
        let statusClass = "status-none";

        if (lastIn && (!lastOut || lastIn > lastOut)) {
            status = "Đang trong bãi";
            statusClass = "status-in";
            insideCount++;
        } else if (lastOut) {
            status = "Đã ra";
            statusClass = "status-out";
        }

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${uid}</td>
            <td>${location}</td>
            <td>${lastIn ? formatTime(lastIn) : "-"}</td>
            <td>${lastOut ? formatTime(lastOut) : "-"}</td>
            <td class="${statusClass}">${status}</td>
        `;

        tbody.appendChild(tr);
    }

    document.getElementById("inoutSummary").innerText =
        "Xe đang trong bãi: " + insideCount;
}
function formatTime(date) {
    return new Date(date).toLocaleString("vi-VN");
}
/***********************
 * MQTT CONFIG
 ***********************/
const broker = "wss://347b5cbd61ee4efc8309c3c918b7c3f7.s1.eu.hivemq.cloud:8884/mqtt";

let addedUIDs = JSON.parse(localStorage.getItem("addedUIDs")) || [];
let removedUIDs = JSON.parse(localStorage.getItem("removedUIDs")) || [];

// document.addEventListener("DOMContentLoaded", () => {
//     renderTables();
// });

const options = {
    username: "RimuruTempest",
    password: "Dongkaiza2004@",
    reconnectPeriod: 1000
};

const mqttClient = mqtt.connect(broker, options);

mqttClient.on("connect", () => {
    console.log("MQTT Connected");
    setStatus("online");
    mqttClient.subscribe("mtt/area");
});

mqttClient.on("message", (topic, message) => {
    if (topic === "mtt/area") {
        try {
            const packet = JSON.parse(message.toString());
            applyParkingData(packet);
        } catch (e) {
            console.error("JSON parse error", e);
        }
    }
});

function sendUID(action) {
    const uid = document.getElementById("uidInput").value.trim();
    if (!uid) return;

    publishUID(uid, action);

    if (action === "add") {
        if (!addedUIDs.includes(uid))
            addedUIDs.push(uid);

        removedUIDs = removedUIDs.filter(u => u !== uid);
    } else {
        if (!removedUIDs.includes(uid))
            removedUIDs.push(uid);

        addedUIDs = addedUIDs.filter(u => u !== uid);
    }

    renderTables();
    localStorage.setItem("addedUIDs", JSON.stringify(addedUIDs));
    localStorage.setItem("removedUIDs", JSON.stringify(removedUIDs));
}
function publishUID(uid, action) {
    const packet = {
        type: "uid",
        action: action,
        uid: uid
    };

    mqttClient.publish("mtt/control", JSON.stringify(packet));
}
function saveUIDStorage() {
    localStorage.setItem("addedUIDs", JSON.stringify(addedUIDs));
    localStorage.setItem("removedUIDs", JSON.stringify(removedUIDs));
}
function addAll() {

    const list = [...addedUIDs];

    let i = 0;

    const interval = setInterval(() => {

        if (i >= list.length) {
            clearInterval(interval);
            return;
        }

        const uid = list[i];

        publishUID(uid, "add");

        i++;

    }, 500);
}

function removeAll() {

    const list = [...removedUIDs];

    let i = 0;

    const interval = setInterval(() => {

        if (i >= list.length) {
            clearInterval(interval);
            return;
        }

        const uid = list[i];

        publishUID(uid, "remove");

        i++;

    }, 500);
}
function deleteUID() {

    const input = document.getElementById("uidInput");
    if (!input) {
        console.error("Không tìm thấy uidInput");
        return;
    }

    const uid = input.value.trim();
    if (!uid) {
        alert("Vui lòng nhập UID");
        return;
    }

    const beforeCount =
        addedUIDs.length + removedUIDs.length;

    // Xóa khỏi cả 2 mảng
    addedUIDs = addedUIDs.filter(u => u !== uid);
    removedUIDs = removedUIDs.filter(u => u !== uid);

    const afterCount =
        addedUIDs.length + removedUIDs.length;

    if (beforeCount === afterCount) {
        alert("UID không tồn tại");
        return;
    }

    saveUIDStorage();
    renderTables();

    input.value = "";
}
function loadUIDStorage() {
    const savedAdded = localStorage.getItem("addedUIDs");
    const savedRemoved = localStorage.getItem("removedUIDs");

    addedUIDs = savedAdded ? JSON.parse(savedAdded) : [];
    removedUIDs = savedRemoved ? JSON.parse(savedRemoved) : [];

    renderTables();
}

window.onload = function(){
    loadUIDStorage();
    loadTimeoutConfig();
}
const statusEl = document.getElementById("mqttStatus");

function setStatus(state) {

    const statusEl = document.getElementById("mqttStatus");
    if (!statusEl) return;

    statusEl.className = "mqtt-status " + state;

    const textEl = statusEl.querySelector(".text");
    if (!textEl) return;

    if (state === "online") {
        textEl.innerText = "MQTT: Connected";
    }
    else if (state === "reconnecting") {
        textEl.innerText = "MQTT: Reconnecting...";
    }
    else {
        textEl.innerText = "MQTT: Disconnected";
    }
}
function sendTimeout(){

    const park = document.getElementById("timeoutPark").value;
    const left = document.getElementById("timeoutLeft").value;

    if(!park || !left){
        alert("Nhập đủ 2 giá trị timeout");
        return;
    }

    const msg = {
        type: "timeout_config",
        park_timeout: parseInt(park),
        left_timeout: parseInt(left)
    };

    mqttClient.publish("mtt/control", JSON.stringify(msg));

    // lưu vào localStorage
    localStorage.setItem("timeoutPark", park);
    localStorage.setItem("timeoutLeft", left);

    console.log("Send timeout:", msg);
}
function loadTimeoutConfig(){

    const park = localStorage.getItem("timeoutPark");
    const left = localStorage.getItem("timeoutLeft");

    if(park){
        document.getElementById("timeoutPark").value = park;
    }

    if(left){
        document.getElementById("timeoutLeft").value = left;
    }
}
function applyParkingData(packet) {

    if (!packet.areas) return;

    for (let areaName in packet.areas) {

        const areaData = packet.areas[areaName];
        const slots = areaData.slots;

        // tìm đúng khu trong activeLayout
        const areaObj = activeLayout.find(
            a => a.type === "area" && a.name === areaName
        );

        if (!areaObj) continue;

        // lưu trạng thái slot vào object
        areaObj.slots = slots;
    }

    renderParking();
}

function renderTables() {
    const addedTable = document.getElementById("addedTable");
    const removedTable = document.getElementById("removedTable");

    addedTable.innerHTML = "";
    removedTable.innerHTML = "";

    addedUIDs.forEach(uid => {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.innerText = uid;
        cell.onclick = () => moveToRemoved(uid);
        row.appendChild(cell);
        addedTable.appendChild(row);
    });

    removedUIDs.forEach(uid => {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.innerText = uid;
        cell.onclick = () => moveToAdded(uid);
        row.appendChild(cell);
        removedTable.appendChild(row);
    });
}
function moveToRemoved(uid) {
    addedUIDs = addedUIDs.filter(u => u !== uid);
    removedUIDs.push(uid);
    renderTables();
    saveUIDStorage();
}

function moveToAdded(uid) {
    removedUIDs = removedUIDs.filter(u => u !== uid);
    addedUIDs.push(uid);
    renderTables();
    saveUIDStorage();
}
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
function fitParkingView() {
    if (!activeLayout.length) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    activeLayout.forEach(o => {
        minX = Math.min(minX, o.x);
        minY = Math.min(minY, o.y);

        if (o.type === "area") {
            const w = o.cols * 30;
            const h = o.rows * 42;
            maxX = Math.max(maxX, o.x + w);
            maxY = Math.max(maxY, o.y + h);
        } else {
            maxX = Math.max(maxX, o.x + o.w);
            maxY = Math.max(maxY, o.y + o.h);
        }
    });

    const mapW = maxX - minX;
    const mapH = maxY - minY;

    const canvas = parkingCanvas;
    const rect = canvas.getBoundingClientRect();

    const tabbar = document.querySelector('.tabbar');
    const tabbarH = tabbar ? tabbar.offsetHeight : 0;

    const padding = 40;

    const usableW = rect.width  - padding * 2;
    const usableH = rect.height - tabbarH - padding * 2;

    const scaleX = usableW / mapW;
    const scaleY = usableH / mapH;
    const scale  = Math.min(scaleX, scaleY, 3);

    const state = viewState.parking;
    state.scale = scale;

    state.x =
        rect.width / 2 - (minX + mapW / 2) * scale;
    state.y =
        (usableH / 2) - (minY + mapH / 2) * scale;

    parkingInner.style.transform =
        `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
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

    renderEditorAxis(); 

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
    //fetchParkingState();
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
        s.className = "slot";

        if (!o.slots) {
            s.classList.add("nodata");
        } else {
            if (o.slots[i] === 1) {
                s.classList.add("busy");
            } else {
                s.classList.add("free");
            }
        }
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

function go(page){
    window.location.hash = page;
}
function loadPage(){

    const hash = window.location.hash.replace("#","");

    if(!hash){
        showSection("parking");
        return;
    }

    showSection(hash);
}
window.addEventListener("hashchange", loadPage);
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
function renderEditorAxis() {
    // xóa axis cũ nếu có
    editorInner.querySelectorAll(".axis-x,.axis-y,.axis-origin")
        .forEach(e => e.remove());

    const ox = 0;
    const oy = 0;

    const axisX = document.createElement("div");
    axisX.className = "axis-x";
    axisX.style.left = ox + "px";
    axisX.style.top  = oy + "px";

    const axisY = document.createElement("div");
    axisY.className = "axis-y";
    axisY.style.left = ox + "px";
    axisY.style.top  = oy + "px";

    const label = document.createElement("div");
    label.className = "axis-origin";
    label.style.left = ox + "px";
    label.style.top  = oy + "px";
    label.innerText = "(0,0)";

    editorInner.appendChild(axisX);
    editorInner.appendChild(axisY);
    editorInner.appendChild(label);
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
 * BLOCK RIGHT CLICK
 ***********************/
document.addEventListener("contextmenu", e => e.preventDefault());

/***********************
 * INIT
 ***********************/
window.addEventListener("load", loadPage);





