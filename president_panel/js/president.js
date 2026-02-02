const Presi = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxMAbrtMKhcr4lygPSuZr_cRibeaEApERysqFbo-lnl_IC3WHDRHKee1VAH9-g4X9OOaw/exec',

    init: () => {
        // Init logic
        console.log("Panel Presidente Iniciado");
    },

    nav: (tabId) => {
        // Ocultar todas las tabs
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

        // Mostrar target
        document.getElementById(tabId).classList.add('active');
        event.currentTarget.classList.add('active');

        // Actualizar título
        const titles = {
            'tab-news': 'Noticias y Comunicados',
            'tab-polls': 'Gestión de Votaciones',
            'tab-docs': 'Documentos Oficiales',
            'tab-incidents': 'Muro de Reportes'
        };
        document.getElementById('page-title').innerText = titles[tabId];
    }
};

window.onload = Presi.init;
