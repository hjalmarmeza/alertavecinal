const Admin = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxMAbrtMKhcr4lygPSuZr_cRibeaEApERysqFbo-lnl_IC3WHDRHKee1VAH9-g4X9OOaw/exec',

    user: null, // Usuario logueado

    init: () => {
        // Verificar Roles y Permisos
        Admin.checkAuth();

        // Cargar datos iniciales
        Admin.loadUsers();
        Admin.loadSOSHistory();
        Admin.syncMaintSwitch(); // Sincronizar estado real del switch

        // Cargar config y directorio desde el inicio para que estén listos
        Admin.loadConfig();
        Admin.loadDirectory();
    },

    checkAuth: () => {
        const raw = localStorage.getItem('av_user');
        if (!raw) {
            alert("Debes iniciar sesión primero.");
            window.location.href = '../app_vecino/index.html';
            return;
        }

        Admin.user = JSON.parse(raw);
        const rol = (Admin.user.rol || "").toUpperCase();

        // 1. Validar Acceso Básico
        if (rol !== 'ADMIN' && rol !== 'PRESIDENTE') {
            alert("Acceso Denegado: Solo Directiva.");
            window.location.href = '../app_vecino/index.html';
            return;
        }

        // 2. Actualizar UI Perfil
        const profileName = document.querySelector('.user-profile strong');
        if (profileName) profileName.innerText = Admin.user.familia;
        const profileRole = document.querySelector('.user-profile small');
        if (profileRole) profileRole.innerText = rol;

        // 3. SUPER PODER DEL ADMIN (Modo Mantenimiento y Config)
        if (rol === 'PRESIDENTE') {
            // El Presidente ve Directorio y Teléfonos, pero NO el control de Mantenimiento Global
            document.querySelectorAll('.maint-toggle').forEach(d => d.style.display = 'none');

            // Forzar que las secciones de configuración SE VEAN
            const configTab = document.getElementById('tab-config');
            if (configTab) configTab.style.display = 'block';
        }

        // 4. Update Config Tab Info
        const confName = document.getElementById('conf-name');
        const confRole = document.getElementById('conf-role');
        const confAvatar = document.getElementById('conf-avatar');
        if (confName) confName.innerText = Admin.user.familia;
        if (confRole) confRole.innerText = rol;
        if (confAvatar) confAvatar.src = `https://ui-avatars.com/api/?name=${Admin.user.familia}&background=random&size=64`;
    },

    nav: (tabId) => {
        // 1. Hide all Tabs
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');

        // 2. Update Desktop Sidebar
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        // Find which desktop menu corresponds to this tab (manual mapping or by onclick context)
        // Since we pass tabId, let's map: tab-users -> 0, tab-config -> 1, tab-sos -> 2 in desktop
        // Simpler: Just rely on the clicked event IF it exists, otherwise manual sync.

        // 3. Update Mobile Nav
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        // 4. Highlight current trigger safely
        if (event && event.currentTarget) {
            event.currentTarget.classList.add('active');

            // SYNC: If I clicked mobile, highlight desktop too (and vice versa)
            // This is a bit tricky wihtout IDs on buttons, but let's try a simple approach based on text or specific attributes.
            // We will settle for: The clicked one gets active. 
            // Ideally we should select by the tabId target.
            try {
                // Try to find the OTHER button that points to this tabID and activate it too
                const selector = `button[onclick="Admin.nav('${tabId}')"]`;
                document.querySelectorAll(selector).forEach(btn => btn.classList.add('active'));
            } catch (e) { }
        }

        // Title Update based on Tab
        const titles = {
            'tab-users': 'Usuarios',
            'tab-sos': 'Historial SOS',
            'tab-config': 'Ajustes'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerText = titles[tabId] || 'Panel';

        // Load Data
        if (tabId === 'tab-users') Admin.loadUsers();
        if (tabId === 'tab-sos') Admin.loadSOSHistory();

        // Cargar Datos de Configuración cuando se entra a la pestaña
        if (tabId === 'tab-config') {
            Admin.loadConfig();
            Admin.loadDirectory();
        }
    },

    loadConfig: () => {
        fetch(Admin.apiUrl + '?action=get_config')
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    document.getElementById('cfg-phone-police').value = data.phones.police;
                    document.getElementById('cfg-phone-fire').value = data.phones.fire;
                    document.getElementById('cfg-phone-serenazgo').value = data.phones.serenazgo;
                }
            });
    },

    saveConfig: () => {
        const p = document.getElementById('cfg-phone-police').value;
        const f = document.getElementById('cfg-phone-fire').value;
        const s = document.getElementById('cfg-phone-serenazgo').value;

        // Usar GET para máxima compatibilidad con GAS
        const query = `?action=save_config&police=${encodeURIComponent(p)}&fire=${encodeURIComponent(f)}&serenazgo=${encodeURIComponent(s)}`;

        fetch(Admin.apiUrl + query)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast("Números guardados en Sheet");
                    Admin.loadConfig(); // Recargar para confirmar
                } else {
                    alert("Error: " + data.message);
                }
            });
    },

    loadDirectory: () => {
        fetch(Admin.apiUrl + '?action=get_dir')
            .then(r => r.json())
            .then(data => {
                const container = document.getElementById('dir-list-container');
                if (!container) return;
                container.innerHTML = "";
                if (data.status === 'success' && data.data.length > 0) {
                    data.data.forEach(item => Admin.addDirRow(item));
                }
            });
    },

    addDirRow: (data = { nombre: '', cargo: '', telf: '' }) => {
        const container = document.getElementById('dir-list-container');
        const div = document.createElement('div');
        div.className = "dir-row";
        div.style.cssText = "display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:5px; margin-bottom:5px; align-items:center;";
        div.innerHTML = `
            <input type="text" placeholder="Nombre" value="${data.nombre}" class="dir-name" style="background:rgba(0,0,0,0.1); border:1px solid var(--border); color:white; padding:5px; border-radius:4px; font-size:0.8rem;">
            <input type="text" placeholder="Cargo" value="${data.cargo}" class="dir-cargo" style="background:rgba(0,0,0,0.1); border:1px solid var(--border); color:white; padding:5px; border-radius:4px; font-size:0.8rem;">
            <input type="text" placeholder="Teléf" value="${data.telf}" class="dir-telf" style="background:rgba(0,0,0,0.1); border:1px solid var(--border); color:white; padding:5px; border-radius:4px; font-size:0.8rem;">
            <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#f43f5e; padding:5px;"><span class="material-icons-round" style="font-size:1.2rem;">delete</span></button>
        `;
        container.appendChild(div);
    },

    saveDirectory: () => {
        const rows = document.querySelectorAll('.dir-row');
        const list = [];
        rows.forEach(r => {
            const name = r.querySelector('.dir-name').value;
            const cargo = r.querySelector('.dir-cargo').value;
            const telf = r.querySelector('.dir-telf').value;
            if (name || cargo || telf) list.push({ nombre: name, cargo: cargo, telf: telf });
        });

        // Usar GET para enviar el JSON como parámetro (más confiable para GAS)
        const query = `?action=save_dir&data=${encodeURIComponent(JSON.stringify(list))}`;

        fetch(Admin.apiUrl + query)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast("Directorio guardado");
                    Admin.loadDirectory(); // Recargar para confirmar
                } else {
                    alert("Error: " + data.message);
                }
            });
    },

    toggleMaint: () => {
        const status = document.getElementById('maint-switch').checked;
        fetch(Admin.apiUrl + '?action=toggle_maint&status=' + status)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(status ? "MODO MANTENIMIENTO ACTIVADO (Bloqueo App)" : "MODO NORMAL ACTIVADO");
                } else {
                    alert("Error: " + data.message);
                }
            })
            .catch(e => alert("Error de conexión con servidor"));
    },

    syncMaintSwitch: () => {
        fetch(Admin.apiUrl + '?action=get_maint')
            .then(r => r.json())
            .then(data => {
                const sw = document.getElementById('maint-switch');
                if (sw) sw.checked = data.isMaint;
            })
            .catch(e => console.error("Error sincronizando switch:", e));
    },

    loadUsers: () => {
        const tbodyPending = document.getElementById('pending-users-list');
        const tbodyActive = document.getElementById('active-users-list');

        if (tbodyPending) tbodyPending.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando solicitudes...</td></tr>';
        if (tbodyActive) tbodyActive.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando padrón...</td></tr>';

        const timestamp = new Date().getTime();
        fetch(Admin.apiUrl + '?action=get_users&t=' + timestamp)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    // SEPARAR PENDIENTES Y ACTIVOS (o Bloqueados)
                    const pending = data.data.filter(u => u.status === 'PENDIENTE');
                    const active = data.data.filter(u => u.status === 'ACTIVO' || u.status === 'PRESIDENTE' || u.status === 'ADMIN');
                    // Nota: Si el rol es Admin/Presidente, el status suele ser ACTIVO. Ajustar según backend.
                    // Asumiremos que status es lo que manda.

                    // 1. LLENAR PENDIENTES
                    Admin.populateUserTable(tbodyPending, pending, true);

                    // 2. LLENAR ACTIVOS
                    // Filtraremos para NO mostrar bloqueados aquí, o sí? Mejor solo Activos para bloquearlos.
                    const cleanActive = data.data.filter(u => {
                        // 1. Debe ser ACTIVO o tener rol de PRESIDENTE (status activo)
                        if (u.status !== 'ACTIVO' && u.status !== 'PRESIDENTE') return false;

                        // 2. Nunca mostrar al ADMIN supremo
                        if (u.rol === 'ADMIN' || u.status === 'ADMIN') return false;

                        // 3. NO mostrarse a sí mismo (Seguridad: el admin no se autogestiona)
                        if (Admin.user && u.email === Admin.user.email) return false;

                        // 4. Si soy PRESIDENTE, no ver a otros PRESIDENTES
                        if (Admin.user && Admin.user.rol === 'PRESIDENTE') {
                            if (u.rol === 'PRESIDENTE' || u.status === 'PRESIDENTE') return false;
                        }

                        return true;
                    });

                    if (tbodyActive) {
                        Admin.allActiveUsers = cleanActive; // Guardar para filtro
                        Admin.populateUserTable(tbodyActive, cleanActive, false);
                    }

                } else {
                    if (tbodyPending) tbodyPending.innerHTML = '<tr><td colspan="4">Error cargando datos</td></tr>';
                }
            });
    },

    populateUserTable: (tbody, users, isPending) => {
        if (!tbody) return;
        tbody.innerHTML = "";
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.5; padding: 20px;">No hay registros</td></tr>';
            return;
        }

        users.forEach(u => {
            const tr = document.createElement('tr');
            let actions = '';

            if (isPending) {
                actions = `
                    <button class="btn-sm green" onclick="Admin.users.resolve('${u.id}', 'ACTIVO')">Aprobar</button>
                    <button class="btn-sm red" onclick="Admin.users.resolve('${u.id}', 'BLOQUEADO')">Rechazar</button>
                `;
            } else {
                // MODIFICACION: Botón Corona SOLO para ADMIN
                let promoteBtn = '';
                if (Admin.user && Admin.user.rol === 'ADMIN') {
                    promoteBtn = `<button class="btn-sm purple" title="Ascender a Presidente" onclick="Admin.users.promote('${u.id}', '${u.nombre}')">👑</button>`;
                }

                actions = `
                    ${promoteBtn}
                    <button class="btn-sm red" onclick="Admin.users.resolve('${u.id}', 'BLOQUEADO')">BLOQUEAR</button>
                `;
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight:600">${u.nombre}</div>
                    <div style="font-size:0.8rem; opacity:0.7">${u.email}</div>
                    ${u.rol === 'PRESIDENTE' ? '<span class="chip" style="background:var(--primary); color:white; font-size:0.6rem;">PRESIDENTE</span>' : ''}
                </td>
                <td>${u.familia}</td>
                <td>Mz ${u.mz} Lt ${u.lote}</td>
                <td>${actions}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    filterActiveUsers: () => {
        const query = document.getElementById('search-active').value.toLowerCase();
        const tbody = document.getElementById('active-users-list');
        if (!Admin.allActiveUsers || !tbody) return;

        const filtered = Admin.allActiveUsers.filter(u =>
            u.nombre.toLowerCase().includes(query) ||
            u.familia.toLowerCase().includes(query) ||
            u.mz.toLowerCase().includes(query)
        );
        Admin.populateUserTable(tbody, filtered, false);
    },


    users: {
        resolve: (id, status) => {
            const actionText = status === 'ACTIVO' ? "APROBAR" : (status === 'BLOQUEADO' ? "BLOQUEAR" : "RECHAZAR");
            if (confirm(`¿Estás seguro de ${actionText} a este usuario?`)) {
                // Llamada API
                fetch(`${Admin.apiUrl}?action=resolve_user&user_id=${id}&status=${status}`)
                    .then(res => res.json())
                    .then(d => {
                        alert(d.message);
                        Admin.loadUsers(); // Recargar lista
                    })
                    .catch(e => alert("Error de conexión"));
            }
        },

        promote: (id, name) => {
            if (confirm(`¿Deseas nombrar PRESIDENTE de la Junta Directiva a ${name}?\n\nEste usuario tendrá acceso al Panel Administrativo.`)) {
                fetch(`${Admin.apiUrl}?action=resolve_user&user_id=${id}&status=ACTIVO&role=PRESIDENTE`)
                    .then(res => res.json())
                    .then(d => {
                        alert("✅ " + name + " ahora es Presidente.");
                        Admin.loadUsers();
                    })
                    .catch(e => alert("Error de conexión"));
            }
        }
    },

    // --- NOTICIAS ---
    // --- HISTORIAL ALERTA SOS ---
    loadSOSHistory: () => {
        const tbody = document.getElementById('sos-history-list');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando historial...</td></tr>';

        fetch(Admin.apiUrl + '?action=get_alerts')
            .then(res => res.json())
            .then(data => {
                tbody.innerHTML = "";
                if (data.status === 'success' && data.data.length > 0) {
                    const alerts = data.data.reverse();

                    alerts.forEach(a => {
                        const tr = document.createElement('tr');
                        // Status Logic
                        const isResolved = (a.status === 'ATENDIDO' || a.status === 'RESOLVED');
                        const statusClass = isResolved ? 'status-resolved' : 'status-active';
                        const displayStatus = isResolved ? 'ATENDIDO' : 'ACTIVA 🚨';

                        // Action: If active, click to resolve
                        const actionAttr = !isResolved ? `onclick="Admin.resolveAlert('${a.id}')" style="cursor:pointer;" title="Tocar para atender"` : '';

                        // Delete Button
                        const deleteBtn = `<button class="btn-icon" onclick="Admin.deleteAlert('${a.id}')" title="Eliminar registro" style="margin-left:auto; color:#94a3b8;"><span class="material-icons-round">delete_outline</span></button>`;

                        tr.innerHTML = `
                            <td>${new Date(a.date).toLocaleString()}</td>
                            <td><strong>${a.user}</strong></td>
                            <td style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    <span class="${statusClass}" ${actionAttr}>
                                        ${displayStatus}
                                    </span>
                                    ${!isResolved ? '<div style="font-size:0.7rem; color:var(--text-sec);">Tocar para atender</div>' : ''}
                                </div>
                                ${deleteBtn}
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No hay alertas registradas recientemente</td></tr>';
                }
            })
            .catch(e => {
                console.error(e);
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Error de conexión</td></tr>';
            });
    },

    resolveAlert: (id) => {
        if (confirm("¿Confirmas que esta alerta ha sido ATENDIDA?")) {
            fetch(`${Admin.apiUrl}?action=resolve_alert&alert_id=${id}`)
                .then(res => res.json())
                .then(d => {
                    alert("Alerta actualizada.");
                    Admin.loadSOSHistory();
                })
                .catch(e => alert("Error de conexión"));
        }
    },

    deleteAlert: (id) => {
        if (confirm("¿Estás seguro de ELIMINAR este registro?\nEsta acción no se puede deshacer.")) {
            fetch(`${Admin.apiUrl}?action=delete_alert&alert_id=${id}`)
                .then(res => res.json())
                .then(d => {
                    alert("Registro eliminado.");
                    Admin.loadSOSHistory();
                })
                .catch(e => alert("Error de conexión"));
        }
    }
};

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.8); color: white; padding: 12px 24px;
        border-radius: 50px; z-index: 99999; font-size: 0.9rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

window.onload = Admin.init;
