import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, getDoc, setDoc, Timestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB9v1mRG1qNGIbb68IO0DfII7mQuIT830o",
    authDomain: "pizzicoapp.firebaseapp.com",
    projectId: "pizzicoapp",
    storageBucket: "pizzicoapp.firebasestorage.app",
    messagingSenderId: "667497262667",
    appId: "1:667497262667:web:7edf9e047321ce1fd867ce"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let accionActual = '';

// ============================================================
// --- SISTEMA DE PROTECCIÓN POR CONTRASEÑA DE POSTACIÓN ---
// ============================================================

const PASSWORD_POSTACION = "PIZZICO2025";
const STORAGE_KEY = "pizzico_auth_ok";

function estaAutenticado() {
    return localStorage.getItem(STORAGE_KEY) === "true";
}

function verificarAcceso() {
    const lockScreen = document.getElementById('lock-screen');
    const appContent = document.getElementById('app-content');
    if (!lockScreen || !appContent) return;

    if (estaAutenticado()) {
        lockScreen.style.display = 'none';
        appContent.style.display = 'block';
    } else {
        lockScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
}

window.desbloquearApp = function() {
    const inputPass = document.getElementById('lock-password');
    if (!inputPass) return;
    const valor = inputPass.value.trim();

    if (valor === PASSWORD_POSTACION) {
        localStorage.setItem(STORAGE_KEY, "true");
        verificarAcceso();
    } else {
        inputPass.value = '';
        inputPass.placeholder = '❌ Contraseña incorrecta';
        inputPass.style.borderColor = '#e74c3c';
        setTimeout(() => {
            inputPass.placeholder = 'Contraseña de postación';
            inputPass.style.borderColor = '';
        }, 2000);
    }
}

window.cerrarSesionPostacion = function() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

// ============================================================
// --- LOGOUT AUTOMÁTICO A LAS 00:30 ---
// Cierra todas las sesiones abiertas antes de las 00:30 de hoy
// Se ejecuta cada vez que alguien abre la app
// ============================================================

async function cerrarSesionesOlvidadas() {
    try {
        const ahora = new Date();
        // Calculamos las 00:30 de hoy
        const medianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 30, 0);

        // Solo actuamos si ya pasaron las 00:30 de hoy
        if (ahora < medianoche) return;

        // Buscamos todas las sesiones abiertas (salida == null)
        const q = query(collection(db, "fichajes"), where("salida", "==", null));
        const snap = await getDocs(q);

        if (snap.empty) return;

        const promesas = [];
        snap.forEach(documento => {
            const data = documento.data();
            if (data.entrada) {
                const entradaDate = data.entrada.toDate();
                // Si la entrada es anterior a las 00:30 de hoy → cerrar sesión
                if (entradaDate < medianoche) {
                    // Ponemos la salida exactamente a las 00:30 de ese día
                    const salidaAutomatica = new Date(
                        entradaDate.getFullYear(),
                        entradaDate.getMonth(),
                        entradaDate.getDate(),
                        0, 30, 0
                    );
                    promesas.push(
                        updateDoc(doc(db, "fichajes", documento.id), {
                            salida: Timestamp.fromDate(salidaAutomatica),
                            cierreAutomatico: true
                        })
                    );
                }
            }
        });

        if (promesas.length > 0) {
            await Promise.all(promesas);
            console.log(`✅ ${promesas.length} sesión(es) cerrada(s) automáticamente a las 00:30`);
        }
    } catch (e) {
        console.error("Error en cierre automático de sesiones:", e);
    }
}

// ============================================================
// --- FUNCIONES PARA EL MODAL (index.html) ---
// ============================================================

window.openModal = function(tipo) {
    accionActual = tipo;
    const modal = document.getElementById('auth-modal');
    if(modal) {
        modal.style.display = 'flex';
        document.getElementById('modal-title').innerText = tipo === 'entrada' ? 'CONFIRMAR ENTRADA' : 'CONFIRMAR SALIDA';
        document.getElementById('modal-title').style.color = tipo === 'entrada' ? '#27ae60' : '#e74c3c';
    }
}

window.closeModal = function() {
    const modal = document.getElementById('auth-modal');
    if(modal) modal.style.display = 'none';
}

window.confirmarAccion = async function() {
    const nombre = document.getElementById('modal-nombre').value.trim();
    const pin = document.getElementById('modal-pin').value.trim();

    if (!nombre || pin.length < 4) return alert("Por favor, introduce nombre y PIN de 4 cifras");

    try {
        const userRef = doc(db, "usuarios", nombre);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || userSnap.data().pin !== pin) {
            return alert("Usuario o PIN incorrectos");
        }

        const qBuscador = query(collection(db, "fichajes"), 
                          where("nombre", "==", nombre), 
                          where("salida", "==", null));
        const snap = await getDocs(qBuscador);

        if (accionActual === 'entrada') {
            if (!snap.empty) {
                return alert("⚠️ Ya tienes una entrada activa. Debes marcar SALIDA antes de entrar de nuevo.");
            }
            await addDoc(collection(db, "fichajes"), {
                nombre: nombre,
                entrada: serverTimestamp(),
                salida: null,
                mesAnio: `${new Date().getMonth() + 1}-${new Date().getFullYear()}`,
                horas: 0
            });
            alert("✅ Entrada registrada. ¡Hola " + nombre + "!");
        } else {
            if (snap.empty) {
                return alert("❌ No puedes marcar SALIDA porque no tienes una entrada registrada hoy.");
            }
            const docRef = doc(db, "fichajes", snap.docs[0].id);
            await updateDoc(docRef, { salida: serverTimestamp() });
            alert("✅ Salida registrada. ¡Buen descanso, " + nombre + "!");
        }
        closeModal();
    } catch (e) {
        console.error(e);
        alert("Error de conexión con la base de datos");
    }
}

// --- CREAR USUARIO (registro.html) ---
window.crearUsuario = async function() {
    const nombre = document.getElementById('new-nome').value.trim();
    const pin = document.getElementById('new-pin').value.trim();

    if (!nombre || pin.length < 4) return alert("Introduce un nombre y un PIN de 4 cifras");

    try {
        await setDoc(doc(db, "usuarios", nombre), { nombre, pin });
        alert("✅ Usuario " + nombre + " creado correctamente.");
        window.location.href = "index.html";
    } catch (e) {
        alert("Error al guardar el usuario");
    }
}

// ============================================================
// --- ESTADÍSTICAS MENSUALES (estadisticas.html) ---
// ============================================================

function inicializarSelectorMeses() {
    const select = document.getElementById('select-mes');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione un mes...</option>';
    const ahora = new Date();
    
    for (let i = 0; i < 6; i++) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const mes = d.getMonth() + 1;
        const anio = d.getFullYear();
        const label = d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        const value = `${mes}-${anio}`;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        select.appendChild(option);
    }
}

window.cargarEstadisticas = async function() {
    const mesSeleccionado = document.getElementById('select-mes').value;
    const tbody = document.getElementById('stats-body');
    if (!mesSeleccionado || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px;">Calculando horas...</td></tr>';

    try {
        const q = query(collection(db, "fichajes"), where("mesAnio", "==", mesSeleccionado));
        const snap = await getDocs(q);
        const resumen = {};

        snap.forEach(doc => {
            const data = doc.data();
            if (data.salida && data.entrada) {
                const horas = (data.salida.toDate() - data.entrada.toDate()) / (1000 * 60 * 60);
                if (!resumen[data.nombre]) resumen[data.nombre] = 0;
                resumen[data.nombre] += horas;
            }
        });

        tbody.innerHTML = '';
        const nombres = Object.keys(resumen);
        if (nombres.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px;">No hay registros para este mes.</td></tr>';
            return;
        }
        nombres.forEach(nombre => {
            tbody.innerHTML += `<tr>
                <td style="padding: 15px; border-bottom: 1px solid #eee;">${nombre}</td>
                <td style="padding: 15px; border-bottom: 1px solid #eee;"><strong>${resumen[nombre].toFixed(2)} h</strong></td>
            </tr>`;
        });
    } catch (e) {
        console.error("Error cargando estadísticas:", e);
        alert("Error al conectar con la base de datos.");
    }
}

// ============================================================
// --- REPORTES: SEMANAL Y MENSUAL (reportes.html) ---
// ============================================================

function formatHora(date) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatFecha(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatDuracion(ms) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m.toString().padStart(2,'0')}m`;
}

// Construye la tabla HTML para un conjunto de fichajes
function construirTablaReporte(fichajes, titulo, subtitulo) {
    const container = document.getElementById('reporte-container');
    if (!container) return;

    if (fichajes.length === 0) {
        container.innerHTML += `
            <div class="reporte-bloque">
                <h2 class="reporte-titulo">${titulo}</h2>
                <p class="reporte-subtitulo">${subtitulo}</p>
                <p style="text-align:center; color:#999; padding:20px;">No hay fichajes en este período.</p>
            </div>`;
        return;
    }

    // Agrupar por empleado
    const porEmpleado = {};
    fichajes.forEach(f => {
        if (!porEmpleado[f.nombre]) porEmpleado[f.nombre] = [];
        porEmpleado[f.nombre].push(f);
    });

    let html = `<div class="reporte-bloque">
        <h2 class="reporte-titulo">${titulo}</h2>
        <p class="reporte-subtitulo">${subtitulo}</p>`;

    for (const nombre of Object.keys(porEmpleado).sort()) {
        const registros = porEmpleado[nombre].sort((a,b) => a.entrada - b.entrada);
        let totalMs = 0;

        let filas = '';
        registros.forEach(r => {
            const entrada = r.entrada;
            const salida = r.salida;
            const durMs = salida - entrada;
            totalMs += durMs;
            const auto = r.cierreAutomatico ? ' <span class="badge-auto">auto</span>' : '';
            filas += `<tr>
                <td>${formatFecha(entrada)}</td>
                <td>${formatHora(entrada)}</td>
                <td>${formatHora(salida)}${auto}</td>
                <td><strong>${formatDuracion(durMs)}</strong></td>
            </tr>`;
        });

        html += `
        <div class="empleado-bloque">
            <div class="empleado-header">
                <span class="empleado-nombre">👤 ${nombre}</span>
                <span class="empleado-total">Total: <strong>${formatDuracion(totalMs)}</strong></span>
            </div>
            <table class="tabla-reporte">
                <thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Horas</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
    }

    html += '</div>';
    container.innerHTML += html;
}

window.cargarReportes = async function() {
    const container = document.getElementById('reporte-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; padding:30px; color:#666;">Cargando reportes...</p>';

    try {
        const hoy = new Date();

        // --- SEMANA PASADA (lun-dom) ---
        const diaSemana = hoy.getDay(); // 0=dom, 1=lun...
        const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
        const lunesEstaSeamana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasDesdeLunes);
        const lunes = new Date(lunesEstaSeamana);
        lunes.setDate(lunes.getDate() - 7);
        lunes.setHours(0, 0, 0, 0);
        const domingo = new Date(lunes);
        domingo.setDate(domingo.getDate() + 6);
        domingo.setHours(23, 59, 59, 999);

        // --- MES ACTUAL ---
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

        // Cargamos todos los fichajes necesarios de una sola vez
        const mesAnioActual = `${hoy.getMonth() + 1}-${hoy.getFullYear()}`;
        const mesAnioSemana = `${lunes.getMonth() + 1}-${lunes.getFullYear()}`;

        const mesesAConsultar = [...new Set([mesAnioActual, mesAnioSemana])];

        let todosFichajes = [];
        for (const mes of mesesAConsultar) {
            const q = query(collection(db, "fichajes"), 
                where("mesAnio", "==", mes),
                where("salida", "!=", null));
            const snap = await getDocs(q);
            snap.forEach(d => {
                const data = d.data();
                todosFichajes.push({
                    nombre: data.nombre,
                    entrada: data.entrada.toDate(),
                    salida: data.salida.toDate(),
                    cierreAutomatico: data.cierreAutomatico || false
                });
            });
        }

        // Filtrar para semana pasada
        const fichajesSemana = todosFichajes.filter(f => f.entrada >= lunes && f.entrada <= domingo);

        // Filtrar para mes actual
        const fichajesMes = todosFichajes.filter(f => f.entrada >= inicioMes && f.entrada <= finMes);

        container.innerHTML = '';

        const labelSemana = `${lunes.toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit'})} — ${domingo.toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
        const labelMes = hoy.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

        construirTablaReporte(fichajesSemana, '📅 Semana Pasada', labelSemana);
        construirTablaReporte(fichajesMes, `📆 ${labelMes.charAt(0).toUpperCase() + labelMes.slice(1)}`, 'Mes en curso');

    } catch(e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; color:red; padding:20px;">Error al cargar los reportes.</p>';
    }
}

// ============================================================
// --- INIT ---
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    verificarAcceso();

    const lockInput = document.getElementById('lock-password');
    if (lockInput) {
        lockInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') window.desbloquearApp();
        });
    }

    if (document.getElementById('select-mes')) {
        inicializarSelectorMeses();
    }

    // Logout automático: se ejecuta cada vez que se abre la app
    if (estaAutenticado()) {
        await cerrarSesionesOlvidadas();
    }

    // Cargar reportes si estamos en reportes.html
    if (document.getElementById('reporte-container')) {
        await cargarReportes();
    }
});
