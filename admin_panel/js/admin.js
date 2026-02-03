init: () => {
    // Cargar datos iniciales
    Admin.loadUsers();
    // Cargar historial SOS si estamos en esa tab (o precargar)
    Admin.loadSOSHistory();
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
            // ... (maint logic same)
            const status = document.getElementById('maint-switch').checked;
            alert(status ? "MODO MANTENIMIENTO ACTIVADO (Bloqueo App)" : "MODO NORMAL ACTIVADO");
        },

            // ... (loadUsers and resolve functions same)

            // --- LOAD USERS (Existing logic needs to be preserved or I can just target the News block to replace)
            // I will target the "news" key block to replace it with "sos" logic.

            sos: {
    // ...
}

// Wait, let's just replace the `news` block with `loadSOSHistory`.


toggleMaint: () => {
    const status = document.getElementById('maint-switch').checked;
    console.log("Mantenimiento:", status);
    // Llamar API para guardar estado global
    // fetch(Admin.apiUrl, { method: 'POST', body: JSON.stringify({action: 'set_maint', status: status}) })
    alert(status ? "MODO MANTENIMIENTO ACTIVADO (Bloqueo App)" : "MODO NORMAL ACTIVADO");
},

    loadUsers: () => {
        const tbody = document.getElementById('pending-users-list');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando solicitudes...</td></tr>';

        const timestamp = new Date().getTime();
        fetch(Admin.apiUrl + '?action=get_users&t=' + timestamp)
            .then(res => res.json())
            .then(data => {
                tbody.innerHTML = "";
                if (data.status === 'success') {
                    // Filtrar solo PENDIENTES
                    const pending = data.data.filter(u => u.status === 'PENDIENTE');

                    if (pending.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.5; padding: 20px;">No hay solicitudes pendientes</td></tr>';
                        return;
                    }

                    pending.forEach(u => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>
                                <div style="font-weight:600">${u.nombre}</div>
                                <div style="font-size:0.8rem; opacity:0.7">${u.email}</div>
                            </td>
                            <td>${u.familia}</td>
                            <td>Mz ${u.mz} Lt ${u.lote}</td>
                            <td>
                                <button class="btn-sm green" onclick="Admin.users.resolve('${u.id}', 'ACTIVO')">Aprobar</button>
                                <button class="btn-sm red" onclick="Admin.users.resolve('${u.id}', 'BLOQUEADO')">Rechazar</button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="4">Error cargando datos</td></tr>';
                }
            });
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
