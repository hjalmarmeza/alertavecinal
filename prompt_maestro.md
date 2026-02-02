# 🛡️ PROYECTO MAESTRO: SISTEMA INTEGRAL DE ALERTA VECINAL

## 1. OBJETIVO DEL PROYECTO
Desarrollar un sistema de seguridad y gestión comunitaria profesional para una urbanización de 90 casas. El sistema debe ser robusto, visualmente impactante ("Premium Dark Mode") y funcionar sin costos de servidor (Serverless), utilizando el ecosistema de Google como backend.

---

## 2. ARQUITECTURA TÉCNICA
El proyecto se divide físicamente en 3 bases de código separadas para maximizar seguridad y mantenibilidad:

### A. ESTRUCTURA DE CARPETAS
1.  **/app_vecino/** (Frontend PWA Móvil): Código exclusivo para la App de los 90 usuarios.
2.  **/admin_panel/** (Frontend Web Escritorio): Código para el Dashboard de Administración y Presidencia.
3.  **/server/** (Backend): Scripts de Google Apps Script (`Code.gs`) que conectan con Sheets y Drive.

### B. TECNOLOGÍAS
*   **Frontend:** HTML5, CSS3 (Vanilla + Glassmorphism), JavaScript (Vanilla).
*   **Backend:** Google Apps Script (API REST `doGet`/`doPost`).
*   **Base de Datos:** Google Sheets (Tablas masivas).
*   **Almacenamiento:** Google Drive (Fotos y PDFs). **Regla:** Compresión de imágenes a 300px-800px en el cliente antes de subir.

---

## 3. MÓDULO 1: APP DEL VECINO (PWA)
*Diseñada para uso vertical en celular. Enfoque: Velocidad y Memoria Muscular.*

### A. Funcionalidad Crítica: PÁNICO
1.  **Botón SOS:** Gran botón rojo central con efecto neón.
    *   **Gatillo:** Requiere **3 toques rápidos** para activar (evita falsos positivos).
2.  **Acción de Disparo:**
    *   Envía automáticamente un mensaje al **Grupo de WhatsApp** Vecinal.
    *   **Contenido:** "🆘 ALERTA iniciada por [Nombre Familia] desde [Ubicación Mz/Lote]".
    *   **Adjunto:** Mapa/Ubicación nativa de WhatsApp basada en las coordenadas registradas.
    *   **Sin Enlace:** NO incluye link a la app en el mensaje (para forzar al usuario a abrir la app instalada).
    *   **Confirmación:** Al volver a la app, muestra modal: "✅ ALERTA ENVIADA CORRECTAMENTE".
3.  **Botones Secundarios:** Debajo del SOS, 3 botones claros: "POLICÍA", "BOMBEROS", "SERENAZGO" (números configurables por Admin).

### B. Funcionalidad Receptora: ALERTA ROJA
*   Si un vecino abre la app y existe una alerta activa (menos de X minutos):
*   **Pantalla:** Fondo Rojo Intenso Parpadeante.
*   **Sonido:** Sirena de alerta.
*   **Info:** Muestra QUIÉN disparó la alerta y DÓNDE. Botón "VER MAPA".
*   **Acción:** Botón grande "ENTENDIDO / SILENCIAR" (detiene el sonido localmente).

### C. Gestión Comunitaria (Menú Inferior)
1.  **Muro de Incidencias (Transparencia):**
    *   Feed público de reportes (fotos de huecos, luces, etc.).
    *   Información Pura: Foto + Descripción + Fecha. **SIN etiquetas de estado**.
2.  **Noticias:**
    *   Videos o Comunicados del Presidente.
    *   **Badge:** Icono con globito rojo numérico indicando "No leídos".
3.  **Votaciones:**
    *   Tarjetas visualmente destacadas (Fondo Morado/Azul).
    *   Muestra pregunta, barras de progreso y tiempo restante ("Cierra en 2h").
4.  **Directorio:**
    *   Lista de números útiles (Gas, Plomero) con botón de llamada directa.
5.  **Documentos:**
    *   Biblioteca de PDFs oficiales descargables.

### D. Seguridad & Registro
*   **Formulario:** Item, Correo, Password, Teléfono, Familia, Urb, Calle, Mz, Lote, Distrito.
*   **Candado GPS:** Captura automática de coordenadas (lat/long) al registrarse. El usuario debe estar en casa.
*   **Limite:** Máximo 2 usuarios por Mz/Lote. El 3ro es bloqueado automáticamente.
*   **Sesión:** Un solo dispositivo activo por cuenta.

---

## 4. MÓDULO 2: DASHBOARD DE CONTROL (Web Escritorio)
*Diseñado para uso horizontal en PC. Seguridad con Roles.*

### A. Login & Roles
Un solo acceso (`admin.html`) que redirige según el usuario:

### B. ROL: ADMINISTRADOR TÉCNICO (Tú)
1.  **Control de Accesos:**
    *   Tabla de "Pendientes": Aprobar o Rechazar registros nuevos.
    *   Lista de "Activos": Botón para **BLOQUEAR** vecinos.
    *   **Excepción de Cupo:** Botón para permitir hasta 4 usuarios en un lote específico.
2.  **Configuración:**
    *   Editar números de emergencia (Policía, etc.).
    *   **Modo Mantenimiento:** Interruptor global. Al activarlo, la App muestra una ventana bloqueante con Video de aviso.

### C. ROL: PRESIDENTE (Gestión)
1.  **Comunicación:**
    *   Crear Noticia (Subir Video/Texto).
    *   Subir Documentos (PDF a Drive).
2.  **Democracia:**
    *   **Crear Votación:** Definir Pregunta, Opciones y **Tiempo Límite** (ej: 24h).
    *   **Resultados:** Ver gráficos en tiempo real. Botón **"Exportar Imagen de Resultados"** al cerrar.
3.  **Supervisión:**
    *   Ver el feed de incidencias (fotos en grande).

---

## 5. BASE DE DATOS (Google Sheets)
Estructura de Columnas acordada para la hoja de "Avisos/Muro":
`Item` | `Tipo (OFICIAL/VECINAL)` | `Familia` | `Email` | `Mz` | `Lote` | `Fecha` | `Título` | `Mensaje` | `Link Imagen/Video (Drive)`

---

*Este documento representa la especificación final aprobada para la construcción del sistema.*
