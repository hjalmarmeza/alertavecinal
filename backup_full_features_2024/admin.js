const Admin = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxMAbrtMKhcr4lygPSuZr_cRibeaEApERysqFbo-lnl_IC3WHDRHKee1VAH9-g4X9OOaw/exec',

    init: () => {
        // Cargar datos iniciales
        Admin.loadUsers();
        if (Admin.news) Admin.news.load();
    },

    nav: (tabId) => {
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        // Marcar menu activo (simple logic)
        event.currentTarget.classList.add('active');
    },

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
    news: {
        publish: (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "ENVIANDO...";
            btn.disabled = true;

            const payload = {
                action: 'save_news',
                titulo: document.getElementById('news-title').value,
                cuerpo: document.getElementById('news-body').value,
                imagen: document.getElementById('news-img').value
            };

            fetch(Admin.apiUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).then(() => {
                alert("Noticia Publicada 📢");
                btn.innerText = "PUBLICADA";
                document.getElementById('form-news').reset();
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.disabled = false;
                    Admin.news.load();
                }, 2000);
            }).catch(err => {
                alert("Error de red");
                btn.disabled = false;
            });
        },

        load: () => {
            const list = document.getElementById('news-history-list');
            if (!list) return;

            fetch(`${Admin.apiUrl}?action=get_news`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        list.innerHTML = "";
                        if (data.data.length === 0) {
                            list.innerHTML = "<li>No hay noticias aún.</li>";
                            return;
                        }
                        data.data.forEach(n => {
                            const li = document.createElement('li');
                            li.style.padding = "10px";
                            li.style.borderBottom = "1px solid #eee";
                            li.innerHTML = `<strong>${n.titulo}</strong> <br> <small>${new Date(n.fecha).toLocaleDateString()}</small>`;
                            list.appendChild(li);
                        });
                    }
                });
        }
    }
};

window.onload = Admin.init;
