const App = {
    // URL del Script de Google
    apiUrl: 'https://script.google.com/macros/s/AKfycbxMAbrtMKhcr4lygPSuZr_cRibeaEApERysqFbo-lnl_IC3WHDRHKee1VAH9-g4X9OOaw/exec',

    user: null, // Datos del usuario logueado

    init: () => {
        App.nav.init();
        App.panic.init();
        App.gps.init();

        // Listeners for Forms
        const regForm = document.getElementById('form-register');
        if (regForm) regForm.addEventListener('submit', App.handleRegister);

        const loginForm = document.getElementById('form-login');
        if (loginForm) loginForm.addEventListener('submit', App.handleLogin);

        // Check Login
        const savedUser = localStorage.getItem('av_user');
        if (savedUser) {
            App.user = JSON.parse(savedUser);
            App.nav.to('screen-home');
            App.updateUI();

            // INICIAR ESCUCHA ACTIVA DE ALERTAS
            App.monitor.start();
        }
    },

    updateUI: () => {
        if (App.user) {
            const el = document.getElementById('user-name');
            // Agregar FAMILIA si no lo tiene el dato
            let display = App.user.familia.toUpperCase();
            if (!display.includes("FAMILIA")) display = "FAMILIA " + display;
            el.innerText = display;

            // Logout Trigger
            el.parentElement.style.cursor = 'pointer';
            el.parentElement.title = 'Tocar para Cerrar Sesión';
            el.parentElement.onclick = () => {
                if (confirm("¿Cerrar sesión de " + App.user.familia + "?")) {
                    localStorage.removeItem('av_user');
                    window.location.reload();
                }
            };

            if (document.getElementById('user-addr')) {
                document.getElementById('user-addr').innerText = `Mz ${App.user.mz} - Lote ${App.user.lote}`;
            }

            // Manejo de roles (Botón Admin)
            const adminBtn = document.getElementById('btn-admin-access');
            if (adminBtn) {
                const rol = (App.user.rol || "").toUpperCase();
                if (rol === "ADMIN" || rol === "PRESIDENTE") {
                    adminBtn.classList.remove('hidden');
                } else {
                    adminBtn.classList.add('hidden');
                }
            }
        }
    },

    // --- FORM HANDLERS ---
    handleRegister: (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = "ENVIANDO...";
        btn.disabled = true;

        const data = {
            action: 'register_user',
            nombre: document.getElementById('reg-nombre').value.toUpperCase(),
            familia: document.getElementById('reg-familia').value.toUpperCase(),
            telefono: document.getElementById('reg-telefono').value,
            email: document.getElementById('reg-email').value.toUpperCase(), // Email en Mayúsculas
            pass: document.getElementById('reg-pass').value, // Password se respeta o se puede normalizar si se desea
            direccion: `Urb: ${document.getElementById('reg-urb').value}, Calle: ${document.getElementById('reg-calle').value}, Mz: ${document.getElementById('reg-mz').value}, Lt: ${document.getElementById('reg-lote').value}`.toUpperCase(),
            mz: document.getElementById('reg-mz').value.toUpperCase(),
            lote: document.getElementById('reg-lote').value.toUpperCase(),
            coords: document.getElementById('reg-coords').value || App.gps.current || 'No GPS'
        };

        console.log("Enviando registro:", data);

        // Send to Backend
        fetch(App.apiUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        })
            .then(() => {
                alert("✅ Solicitud enviada correctamente.\nEl Administrador debe aprobar tu cuenta.");
                btn.innerText = "ENVIADO";
                // Guardar localmente para demo (aunque no esté aprobado aun)
                localStorage.setItem('av_user', JSON.stringify(data));
                App.user = data;
                App.updateUI();
                App.nav.to('screen-home');
            })
            .catch(err => {
                console.error(err);
                alert("Error al conectar con servidor.");
                btn.innerText = originalText;
                btn.disabled = false;
            });
    },

    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        btn.innerText = "VERIFICANDO...";
        btn.disabled = true;

        // Usamos GET para poder leer la respuesta JSON (cors friendly en Apps Script para GET simple)
        const timestamp = new Date().getTime();
        const url = `${App.apiUrl}?action=login&email=${encodeURIComponent(email)}&pass=${encodeURIComponent(pass)}&t=${timestamp}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    // Guardar Usuario
                    localStorage.setItem('av_user', JSON.stringify(data.user));
                    App.user = data.user;
                    App.updateUI();
                    App.nav.to('screen-home');
                    // Iniciar monitoreo
                    App.monitor.start();
                } else {
                    alert("⚠️ " + data.message);
                }
                btn.innerText = originalText;
                btn.disabled = false;
            })
            .catch(err => {
                console.error(err);
                alert("Error de conexión con el servidor.\nVerifica tu internet.");
                btn.innerText = originalText;
                btn.disabled = false;
            });
    },

    // --- NAVEGACIÓN ---
    nav: {
        init: () => {
            window.onpopstate = () => App.nav.back();
        },
        to: (screenId) => {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(screenId).classList.add('active');
            history.pushState({ screen: screenId }, screenId, `#${screenId}`);
        },
        back: () => {
            history.back();
        }
    },

    // --- PÁNICO (3 TOQUES) ---
    panic: {
        taps: 0,
        lastTap: 0,

        init: () => {
            const btn = document.getElementById('btn-panic');
            if (!btn) return;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const now = new Date().getTime();
                if (now - App.panic.lastTap > 800) App.panic.taps = 0;

                App.panic.taps++;
                App.panic.lastTap = now;

                if (navigator.vibrate) navigator.vibrate(50);
                btn.classList.add('active-tap');
                setTimeout(() => btn.classList.remove('active-tap'), 100);

                if (App.panic.taps === 3) {
                    App.panic.trigger();
                    App.panic.taps = 0;
                }
            });
        },

        trigger: () => {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
            App.api.sendAlert();
            alert("🚨 ALERTA ENVIADA 🚨\n\nSe ha notificado vía Telegram a toda la comunidad y a la central.");
            // Reset visual
            const btn = document.getElementById('btn-panic');
            if (btn) btn.classList.remove('active-tap');
        }
    },

    // --- GPS ---
    gps: {
        current: null,
        init: () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        App.gps.current = `${pos.coords.latitude},${pos.coords.longitude}`;
                        console.log("GPS:", App.gps.current);
                        const box = document.getElementById('gps-box');
                        if (box) {
                            document.getElementById('gps-msg').innerText = "Coordenadas Capturadas";
                            document.getElementById('gps-icon').innerText = "check_circle";
                            document.getElementById('gps-box').classList.add('success');
                            if (document.getElementById('reg-coords')) document.getElementById('reg-coords').value = App.gps.current;
                        }
                    },
                    (err) => console.error(err),
                    { enableHighAccuracy: true }
                );
            }
        }
    },

    // --- API ---
    api: {
        sendAlert: () => {
            fetch(App.apiUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'send_alert',
                    user_id: App.user?.email || 'anon',
                    familia: App.user?.familia || 'Vecino',
                    direccion: App.user ? `Mz ${App.user.mz} Lt ${App.user.lote}` : 'S/N',
                    coords: App.gps.current
                })
            });
        }
    },

    // --- MONITOR DE ALERTAS (POLLING OPTIMIZADO) ---
    monitor: {
        interval: null,
        isRedScreenActive: false,
        baseInterval: 20000,
        currentAlertCoords: null,
        currentAlertId: null,      // ID de la alerta actual en pantalla
        lastSeenAlertId: null,     // Última alerta que el usuario cerró ("Enterado")

        start: () => {
            if (App.monitor.interval) clearInterval(App.monitor.interval);
            App.monitor.check();
            App.monitor.startLoop();

            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    App.monitor.stopLoop();
                } else {
                    App.monitor.check();
                    App.monitor.startLoop();
                }
            });
        },

        startLoop: () => {
            if (App.monitor.interval) clearInterval(App.monitor.interval);
            App.monitor.interval = setInterval(() => {
                const jitter = Math.random() * 2000;
                setTimeout(App.monitor.check, jitter);
            }, App.monitor.baseInterval);
        },

        stopLoop: () => {
            if (App.monitor.interval) clearInterval(App.monitor.interval);
            App.monitor.interval = null;
        },

        check: () => {
            if (document.hidden) return;

            const timestamp = new Date().getTime();
            fetch(`${App.apiUrl}?action=check_status&t=${timestamp}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success' && data.alert) {

                        // --- FILTROS DE ALERTA ---

                        // 1. Filtrar si soy yo mismo (evitar auto-susto)
                        const myEmail = App.user ? String(App.user.email).toLowerCase().trim() : '';
                        const alertEmail = data.alert.from_email ? String(data.alert.from_email).toLowerCase().trim() : '';

                        // Si la alerta viene de mí, la ignoro (ya vi mi confirmación de envío)
                        if (myEmail && alertEmail && myEmail === alertEmail) {
                            return;
                        }

                        // 2. Filtrar si ya vi esta alerta específica (Baneada por ID)
                        if (App.monitor.lastSeenAlertId === data.alert.id) {
                            return; // Ya pulsé "Enterado", no volver a mostrar
                        }

                        // Si pasa los filtros, mostrar
                        App.monitor.showRedScreen(data.alert);

                    } else if (App.monitor.isRedScreenActive) {
                        // Si el servidor ya NO reporta alerta (se canceló o expiró), cerrar pantalla
                        // Pasamos false para NO marcarla como "vista por el usuario", simplemente desapareció
                        App.monitor.hideRedScreen(false);
                    }
                })
                .catch(e => console.error("Monitor network error (silenced)"));
        },

        showRedScreen: (alertData) => {
            if (App.monitor.isRedScreenActive) return;

            App.monitor.isRedScreenActive = true;
            App.monitor.currentAlertCoords = alertData.coords;
            App.monitor.currentAlertId = alertData.id; // Guardamos ID actual

            const overlay = document.getElementById('red-alert-overlay');

            let familia = alertData.user || "VECINO";
            if (!familia.toUpperCase().includes("FAMILIA")) {
                familia = "FAMILIA " + familia.toUpperCase();
            }

            document.getElementById('alert-who').innerHTML = `ALERTA REPORTADA POR:<br>${familia}`;
            document.getElementById('alert-where').innerText = alertData.address || "UBICACIÓN DESCONOCIDA";
            document.getElementById('alert-time').innerText = "¡OCURRIENDO AHORA!";

            overlay.classList.remove('hidden');

            if (navigator.vibrate) navigator.vibrate([1000, 500, 1000, 500, 1000]);
        },

        hideRedScreen: (userAck = true) => {
            // Si el usuario confirma (userAck=true), bloqueamos este ID para siempre (mientras dure la sesión)
            if (userAck && App.monitor.currentAlertId) {
                App.monitor.lastSeenAlertId = App.monitor.currentAlertId;
            }

            App.monitor.isRedScreenActive = false;
            document.getElementById('red-alert-overlay').classList.add('hidden');
        }
    },

    // --- MAPA ---
    map: {
        open: () => {
            // Usar coordenadas de la alerta si existen, si no, nada
            if (App.monitor.currentAlertCoords) {
                window.open(`https://maps.google.com/?q=${App.monitor.currentAlertCoords}`, '_blank');
            } else {
                alert("Ubicación no disponible");
            }
        }
    },

    // --- LLAMADAS ---
    call: (number) => {
        if (number === 'admin') number = '999999999';
        window.location.href = `tel:${number}`;
    }
};

window.onload = App.init;
