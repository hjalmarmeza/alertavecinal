const Admin = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxMAbrtMKhcr4lygPSuZr_cRibeaEApERysqFbo-lnl_IC3WHDRHKee1VAH9-g4X9OOaw/exec',

    user: null, // Usuario logueado

    init: () => {
        // Verificar Roles y Permisos
        Admin.checkAuth();

        // Cargar datos iniciales
        Admin.loadUsers();
        Admin.loadSOSHistory();
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
            // Ocultar Switch Mantenimiento
            const maintDiv = document.querySelector('.maint-toggle');
            if (maintDiv) maintDiv.style.display = 'none'; // Desaparece para el presidente

            // Ocultar Tab Configuración
            const configBtn = document.querySelector('button[onclick="Admin.nav(\'tab-config\')"]');
            if (configBtn) configBtn.style.display = 'none';
        }
    },

    nav: (tabId) => {
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        // Marcar menu activo (simple logic)
        event.currentTarget.classList.add('active');

        // Recargar datos si es necesario
        if (tabId === 'tab-users') Admin.loadUsers();
        if (tabId === 'tab-sos') Admin.loadSOSHistory();
    },

    toggleMaint: () => {
        const status = document.getElementById('maint-switch').checked;
        console.log("Mantenimiento:", status);
        alert(status ? "MODO MANTENIMIENTO ACTIVADO (Bloqueo App)" : "MODO NORMAL ACTIVADO");
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
                    const cleanActive = data.data.filter(u => u.status === 'ACTIVO' && u.rol !== 'ADMIN');
                    // Excluímos al ADMIN supremo para que no se auto-bloquee por error, 
                    // aunque el backend debería protegerlo.

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
                // MODIFICACION: Botón Bloquear solo para ACTIVOS
                // Si el usuario logueado es PRESIDENTE, podrías ocultar esto si quisieras.
                // Pero acordamos que ambos pueden.
                actions = `
                    <button class="btn-sm red" onclick="Admin.users.resolve('${u.id}', 'BLOQUEADO')">BLOQUEAR</button>
                `;
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight:600">${u.nombre}</div>
                    <div style="font-size:0.8rem; opacity:0.7">${u.email}</div>
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
            const actionText = status === 'ACTIVO' ? "APROBAR" : "RECHAZAR";
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
                    // Ordenar por fecha (más reciente primero) si no viene ordenado
                    // data.data.sort... (asumimos que sheet ya viene en orden append, invertiremos)
                    const alerts = data.data.reverse();

                    alerts.forEach(a => {
                        const tr = document.createElement('tr');
                        const statusClass = a.status === 'ATENDIDO' ? 'color:#10b981' : 'color:#f43f5e';
                        tr.innerHTML = `
                            <td>${new Date(a.date).toLocaleString()}</td>
                            <td><strong>${a.user}</strong></td>
                            <td><span class="chip red">SOS</span></td>
                            <td style="${statusClass}; font-weight:bold;">${a.status}</td>
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
    }
};

window.onload = Admin.init;
