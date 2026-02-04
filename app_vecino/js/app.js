const App = {
    // URL del Script de Google
    apiUrl: 'https://script.google.com/macros/s/AKfycbxMAbrtMKhcr4lygPSuZr_cRibeaEApERysqFbo-lnl_IC3WHDRHKee1VAH9-g4X9OOaw/exec',

    user: null, // Datos del usuario logueado

    init: () => {
        App.nav.init();
        App.panic.init();
        App.gps.init();
        App.checkMaintenance(); // Verificar si la app está bloqueada

        // Listeners for Forms
        const regForm = document.getElementById('form-register');
        if (regForm) regForm.addEventListener('submit', App.handleRegister);

        const loginForm = document.getElementById('form-login');
        if (loginForm) loginForm.addEventListener('submit', App.handleLogin);

        const reportForm = document.getElementById('form-report');
        if (reportForm) reportForm.addEventListener('submit', App.handleReport);

        // Check Login
        const savedUser = localStorage.getItem('av_user');
        if (savedUser) {
            App.user = JSON.parse(savedUser);
            App.nav.to('screen-home');
            App.updateUI();

            // INICIAR ESCUCHA ACTIVA DE ALERTAS
            App.monitor.start();
        }

        // Intervalo de mantenimiento (cada 60 seg)
        setInterval(App.checkMaintenance, 60000);
    },

    checkMaintenance: () => {
        // SEGURIDAD: Solo el SUPER ADMIN (hjalmar) puede saltarse el bloqueo para dar mantenimiento.
        // El Presidente y los Vecinos deben ver el bloqueo.
        if (App.user && App.user.rol === 'ADMIN') {
            const overlay = document.getElementById('maintenance-screen');
            if (overlay) overlay.style.display = 'none';
            return;
        }

        fetch(App.apiUrl + '?action=get_maint')
            .then(r => r.json())
            .then(data => {
                const overlay = document.getElementById('maintenance-screen');
                if (data.isMaint) {
                    overlay.style.display = 'flex';
                } else {
                    overlay.style.display = 'none';
                }
            })
            .catch(e => console.error("Err Maint:", e));
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
                alert("✅ Solicitud enviada correctamente.\nEl Administrador debe aprobar tu cuenta antes de que puedas ingresar.");
                btn.innerText = "ENVIADO";
                document.getElementById('form-register').reset();

                // NO Loguear. Redirigir al inicio para esperar aprobación.
                setTimeout(() => {
                    App.nav.to('screen-login');
                    btn.innerText = originalText;
                    btn.disabled = false;
                }, 1000);
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
            const screen = document.getElementById(screenId);
            if (!screen) {
                console.warn(`Screen ${screenId} not found`);
                return;
            }

            // Si es la pantalla de ADMIN, cargar el iframe si está vacío
            if (screenId === 'screen-admin') {
                const iframe = document.getElementById('admin-iframe');
                if (iframe && iframe.src === 'about:blank') {
                    iframe.src = '../admin_panel/index.html';
                }
            }

            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            screen.classList.add('active');
            history.pushState({ screen: screenId }, screenId, `#${screenId}`);
        },
        back: () => {
            history.back();
        }
    },

    // ... (rest of the file remains, but I can't match it all easily so I'll just skip to window.onload)
    // Wait, I cannot skip with replace_file_content unless I target specific chunks. I will do 2 separate edits.


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

    // --- MONITOR DE ALERTAS (MODO: ON-DEMAND / AHORRO TOTAL) ---
    // Estrategia: Solo chequear al ABRIR la app o al VOLVER a ella.
    // No hay consumo pasivo en segundo plano ni bucles infinitos.
    monitor: {
        isRedScreenActive: false,
        currentAlertCoords: null,
        currentAlertId: null,
        lastSeenAlertId: null,

        start: () => {
            // 1. Chequeo inicial al cargar
            App.monitor.check();

            // 2. Chequeo al volver a la app (cambio de visibilidad)
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) {
                    console.log("App en primer plano: Chequeando estado...");
                    App.monitor.check();
                }
            });
        },

        check: () => {
            if (document.hidden) return;

            const timestamp = new Date().getTime();
            fetch(`${App.apiUrl}?action=check_status&t=${timestamp}`)
                .then(res => res.json())
                .then(data => {
                    // 1. CHEQUEO DE ALERTAS
                    if (data.status === 'success' && data.alert) {
                        const myEmail = App.user ? String(App.user.email).toLowerCase().trim() : '';
                        const alertEmail = data.alert.from_email ? String(data.alert.from_email).toLowerCase().trim() : '';

                        // Filtro: No notificarme mi propia alerta (ya tengo feedback visual del botón)
                        if (myEmail && alertEmail && myEmail === alertEmail) return;

                        // Filtro: Si ya le di "Enterado" a esta alerta específica, no volver a mostrar
                        if (App.monitor.lastSeenAlertId === data.alert.id) return;

                        App.monitor.showRedScreen(data.alert);

                    } else if (App.monitor.isRedScreenActive) {
                        // Si ya no hay alerta activa en el servidor, quitar la pantalla roja
                        App.monitor.hideRedScreen(false);
                    }
                })
                .catch(e => console.error("Monitor network error (silenced)"));
        },

        showRedScreen: (alertData) => {
            if (App.monitor.isRedScreenActive) return;

            App.monitor.isRedScreenActive = true;
            App.monitor.currentAlertCoords = alertData.coords;
            App.monitor.currentAlertId = alertData.id;

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

    // --- DIRECTORIO ---
    directory: {
        data: [
            { name: "Comisaría Sectorial", phone: "105", icon: "local_police", desc: "Emergencias Policiales" },
            { name: "Bomberos Voluntarios", phone: "116", icon: "local_fire_department", desc: "Incendios y Rescates" },
            { name: "Serenazgo Central", phone: "014444444", icon: "security", desc: "Patrullaje Municipal" },
            { name: "Centro de Salud", phone: "113", icon: "medical_services", desc: "Atención Médica Urgente" },
            { name: "Gasfitero Zonal", phone: "999000111", icon: "plumbing", desc: "Servicio Técnico" },
            { name: "Electricista", phone: "999000222", icon: "electric_bolt", desc: "Servicio Técnico" }
        ],
        load: () => {
            const container = document.querySelector('#screen-directory .scroll-content');
            if (!container) return;

            container.innerHTML = `
                <div class="header-simple"><h2>Directorio</h2></div>
                <h3 style="margin:10px 0 20px; color:var(--text-sec); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Números de Emergencia</h3>
                <div class="directory-list"></div>
             `;
            const list = container.querySelector('.directory-list');

            App.directory.data.forEach(item => {
                const el = document.createElement('div');
                el.className = 'contact-card';
                el.innerHTML = `
                    <div style="display:flex; align-items:center; flex:1;">
                        <div class="contact-avatar">
                            <span class="material-icons-round">${item.icon}</span>
                        </div>
                        <div class="contact-info">
                            <h4>${item.name}</h4>
                            <p>${item.desc}</p>
                        </div>
                    </div>
                    <button class="btn-call" onclick="App.call('${item.phone}')">
                        <span class="material-icons-round">call</span>
                    </button>
                 `;
                list.appendChild(el);
            });
        }
    },

    call: (number) => {
        if (number === 'admin') number = '999999999';
        window.location.href = `tel:${number}`;
    },

    handleReport: (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        btn.innerText = "ENVIANDO...";
        btn.disabled = true;

        const type = document.getElementById('report-type').value;
        const desc = document.getElementById('report-desc').value;
        const imageBase64 = App.report.currentImageBase64 || "";

        const data = {
            action: 'report_incident',
            user_id: App.user ? App.user.email : 'anon',
            familia: App.user ? App.user.familia : 'Vecino',
            tipo: type,
            descripcion: desc,
            imagen: imageBase64,
            coords: App.gps.current || ""
        };

        // Send to Backend
        fetch(App.apiUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        })
            .then(() => {
                alert("✅ Reporte enviado correctamente.");
                btn.innerText = "ENVIADO";
                document.getElementById('form-report').reset();
                App.report.clearImage();

                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.disabled = false;
                    App.nav.to('screen-home');
                }, 1000);
            })
            .catch(err => {
                console.error(err);
                alert("Error al enviar reporte.");
                btn.innerText = originalText;
                btn.disabled = false;
            });
    },

    // --- REPORTAR CON FOTO ---
    report: {
        currentImageBase64: null,

        previewImage: (input) => {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();

                reader.onload = (e) => {
                    // Mostrar preview
                    const img = document.getElementById('image-preview');
                    img.src = e.target.result;
                    document.getElementById('image-preview-container').classList.remove('hidden');
                    document.querySelector('.file-upload-box').style.display = 'none';

                    // Convertir y Comprimir a Base64
                    App.report.compressImage(img, (base64) => {
                        App.report.currentImageBase64 = base64;
                        console.log("Imagen procesada. Longitud: " + base64.length);
                    });
                };
                reader.readAsDataURL(file);
            }
        },

        clearImage: () => {
            document.getElementById('report-photo').value = "";
            document.getElementById('image-preview').src = "";
            document.getElementById('image-preview-container').classList.add('hidden');
            document.querySelector('.file-upload-box').style.display = 'flex';
            App.report.currentImageBase64 = null;
        },

        compressImage: (imgElement, callback) => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Limitar ancho para reducir tamaño
            const scaleSize = MAX_WIDTH / imgElement.width;

            // Si es más pequeña, no redimensionar
            let newWidth = imgElement.width;
            let newHeight = imgElement.height;

            if (scaleSize < 1) {
                newWidth = MAX_WIDTH;
                newHeight = imgElement.height * scaleSize;
            }

            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(imgElement, 0, 0, newWidth, newHeight);

            // Exportar a JPG con calidad reducida (0.6)
            const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
            callback(dataUrl);
        }
    },

    // --- NOTICIAS ---
    news: {
        load: (silent = false) => {
            const container = document.querySelector('#screen-feed .scroll-content');
            if (!container) return;

            if (!silent) {
                container.innerHTML = '<div style="text-align:center; padding:40px;"><span class="material-icons-round" style="animation:spin 1s infinite">refresh</span></div>';
            }

            const timestamp = new Date().getTime();
            fetch(`${App.apiUrl}?action=get_news&t=${timestamp}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success' && data.data.length > 0) {

                        // Limpiar siempre para repintar ordenado
                        container.innerHTML = "";

                        // HEADER CON BOTÓN REFRESH MANUAL
                        const header = document.createElement('div');
                        header.className = 'header-simple';
                        header.style.display = 'flex';
                        header.style.justifyContent = 'space-between';
                        header.style.alignItems = 'center';

                        header.innerHTML = `
                            <h2 style="margin:0;">Noticias</h2>
                            <button class="btn-icon" id="btn-refresh-news" style="background:rgba(255,255,255,0.1); width:40px; height:40px; border-radius:50%;">
                                <span class="material-icons-round">refresh</span>
                            </button>
                        `;
                        container.appendChild(header);

                        header.querySelector('#btn-refresh-news').onclick = () => {
                            App.news.load(false);
                        };

                        data.data.forEach(n => {
                            const date = new Date(n.fecha).toLocaleDateString();
                            const tagClass = (n.tipo && n.tipo === 'ALERTA') ? 'alert' : 'info';

                            let imgHtml = "";
                            if (n.imagen && n.imagen.length > 50) {
                                // Limpieza agresiva de saltos de línea y espacios
                                let cleanSrc = n.imagen.replace(/(\r\n|\n|\r)/gm, "").trim();

                                // Si es base64 pero le falta el prefijo, agregarlo
                                if (!cleanSrc.startsWith('http') && !cleanSrc.startsWith('data:image')) {
                                    cleanSrc = "data:image/jpeg;base64," + cleanSrc;
                                }

                                imgHtml = `<img src="${cleanSrc}" class="news-image" loading="lazy" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-top:10px;">`;
                            }

                            const card = document.createElement('div');
                            card.className = "news-card";

                            const cuerpoTexto = n.cuerpo || "";

                            // Reordenamos: Titulo -> Imagen -> Texto -> Footer
                            card.innerHTML = `
                                <div class="news-header">
                                    <span class="chip ${tagClass}">${n.tipo || 'COMUNICADO'}</span>
                                    <small style="color:var(--text-sec); font-size:0.75rem;">${date}</small>
                                </div>
                                <h3 class="news-title" style="margin-bottom:5px;">${n.titulo}</h3>
                                ${imgHtml}
                                <div class="news-body" style="margin-top:10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${cuerpoTexto}</div>
                            `;

                            card.onclick = () => {
                                App.news.showDetail(n);
                            };

                            container.appendChild(card);
                        });

                        const badge = document.getElementById('news-badge');
                        if (badge) {
                            badge.innerText = data.data.length;
                            badge.style.display = 'flex';
                        }

                    } else {
                        // Estado Vacío con Botón Refresh
                        container.innerHTML = `
                            <div class="header-simple" style="display:flex; justify-content:space-between; align-items:center;">
                                <h2 style="margin:0;">Noticias</h2>
                                <button class="btn-icon" onclick="App.news.load()" style="background:rgba(255,255,255,0.1); width:40px; height:40px; border-radius:50%;">
                                    <span class="material-icons-round">refresh</span>
                                </button>
                            </div>
                            <div style="text-align:center; padding:60px 20px; opacity:0.6;">
                                <span class="material-icons-round" style="font-size:4rem; color:#cbd5e1; margin-bottom:10px;">newspaper</span>
                                <p>No hay noticias recientes</p>
                            </div>`;
                    }
                })
                .catch(e => {
                    container.innerHTML = `
                        <div class="header-simple"><h2>Noticias</h2></div>
                        <div style="text-align:center; padding:40px;">
                            <p style="color:#f43f5e;">Error de conexión</p>
                            <button class="btn-primary" onclick="App.news.load()" style="margin-top:10px;">Reintentar</button>
                        </div>
                    `;
                });
        },

        showDetail: (n) => {
            const overlay = document.createElement('div');
            overlay.className = 'screen active';
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '2000';
            overlay.style.background = 'rgba(15, 23, 42, 0.95)';
            overlay.style.backdropFilter = 'blur(10px)';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.padding = '24px';

            let imgFull = "";
            if (n.imagen && (n.imagen.startsWith('http') || n.imagen.startsWith('data:image'))) {
                const cleanSrc = n.imagen.replace(/(\r\n|\n|\r)/gm, "");
                imgFull = `<img src="${cleanSrc}" style="width:100%; border-radius:12px; margin: 20px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">`;
            }

            const date = new Date(n.fecha).toLocaleString();

            overlay.innerHTML = `
                <div style="flex:1; overflow-y:auto; padding-bottom:80px;">
                    <button class="btn-icon-back" style="position:sticky; top:0; background:rgba(255,255,255,0.1); backdrop-filter:blur(5px);">
                        <span class="material-icons-round">close</span>
                    </button>
                    
                    <span class="chip ${n.tipo === 'ALERTA' ? 'alert' : 'info'}" style="margin-top:10px; display:inline-block;">${n.tipo || 'COMUNICADO'}</span>
                    
                    <h1 style="font-size:1.8rem; margin:15px 0 10px; line-height:1.2;">${n.titulo}</h1>
                    <small style="color:var(--text-sec); display:block; margin-bottom:20px;">${date}</small>
                    
                    ${imgFull}
                    
                    <div style="font-size:1.1rem; line-height:1.6; color:#e2e8f0; white-space: pre-wrap;">${n.cuerpo || ""}</div>
                    
                    ${n.autor ? `<div style="margin-top:30px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1); color:var(--text-sec); font-size:0.9rem;">Publicado por: <b>${n.autor}</b></div>` : ''}
                </div>
            `;

            overlay.querySelector('button').onclick = () => {
                overlay.style.opacity = '0';
                setTimeout(() => document.body.removeChild(overlay), 300);
            };

            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(overlay);

            setTimeout(() => overlay.style.opacity = '1', 10);
        }
    }
};

window.onload = () => {
    App.init();
    // App.news.load(); // Deshabilitado en Lite
    App.directory.load();
};
