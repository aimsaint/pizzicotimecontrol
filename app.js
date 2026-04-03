import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, getDoc, setDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tu configuración de PizzicoApp
const firebaseConfig = {
    apiKey: "AIzaSyB9v1mRG1qNGIbb68IO0DfII7mQuIT830o",
    authDomain: "pizzicoapp.firebaseapp.com",
    projectId: "pizzicoapp",
    storageBucket: "pizzicoapp.firebasestorage.app",
    messagingSenderId: "667497262667",
    appId: "1:667497262667:web:7edf9e047321ce1fd867ce"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let accionActual = '';

// ============================================================
// --- SISTEMA DE PROTECCIÓN POR CONTRASEÑA DE POSTACIÓN ---
// ============================================================

// ⚙️ CAMBIA ESTA CONTRASEÑA POR LA QUE TÚ QUIERAS
const PASSWORD_POSTACION = "CAVANI";
const STORAGE_KEY = "pizzico_auth_ok";

// Comprueba si este navegador ya está autenticado
function estaAutenticado() {
    return localStorage.getItem(STORAGE_KEY) === "true";
}

// Muestra u oculta la app según el estado de autenticación
function verificarAcceso() {
    const lockScreen = document.getElementById('lock-screen');
    const appContent = document.getElementById('app-content');
    if (!lockScreen || !appContent) return; // página sin protección

    if (estaAutenticado()) {
        lockScreen.style.display = 'none';
        appContent.style.display = 'block';
    } else {
        lockScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
}

// Función llamada desde el botón de la pantalla de bloqueo
window.desbloquearApp = function() {
    const inputPass = document.getElementById('lock-password');
    if (!inputPass) return;
    const valor = inputPass.value.trim();

    if (valor === PASSWORD_POSTACION) {
        localStorage.setItem(STORAGE_KEY, "true");
        verificarAcceso();
    } else {
        // Animación de error
        inputPass.value = '';
        inputPass.placeholder = '❌ Contraseña incorrecta';
        inputPass.style.borderColor = '#e74c3c';
        setTimeout(() => {
            inputPass.placeholder = 'Contraseña de postación';
            inputPass.style.borderColor = '';
        }, 2000);
    }
}

// Permite cerrar sesión (útil si quieres "desautorizar" la tablet)
window.cerrarSesionPostacion = function() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

// Detectar Enter en el campo de contraseña
document.addEventListener('DOMContentLoaded', () => {
    verificarAcceso();

    const lockInput = document.getElementById('lock-password');
    if (lockInput) {
        lockInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window.desbloquearApp();
        });
    }

    if (document.getElementById('select-mes')) {
        inicializarSelectorMeses();
    }
});

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

// --- CONFIRMAR ACCIÓN (LOGIN/LOGOUT) ---
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
            await updateDoc(docRef, { 
                salida: serverTimestamp() 
            });
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
        await setDoc(doc(db, "usuarios", nombre), {
            nombre: nombre,
            pin: pin
        });
        alert("✅ Usuario " + nombre + " creado correctamente.");
        window.location.href = "index.html";
    } catch (e) {
        alert("Error al guardar el usuario");
    }
}

// --- LÓGICA DE ESTADÍSTICAS ---

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
                const entrada = data.entrada.toDate();
                const salida = data.salida.toDate();
                const horas = (salida - entrada) / (1000 * 60 * 60); 
                
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
            const fila = `<tr>
                <td style="padding: 15px; border-bottom: 1px solid #eee;">${nombre}</td>
                <td style="padding: 15px; border-bottom: 1px solid #eee;"><strong>${resumen[nombre].toFixed(2)} h</strong></td>
            </tr>`;
            tbody.innerHTML += fila;
        });

    } catch (e) {
        console.error("Error cargando estadísticas:", e);
        alert("Error al conectar con la base de datos.");
    }
}
