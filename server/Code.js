function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    var output = ContentService.createTextOutput();

    // PROTECCIÓN CONTRA EJECUCIÓN MANUAL EN EDITOR (Fix error imagen 4)
    if (!e || !e.parameter) {
        var msg = "⚠️ NO EJECUTAR ESTA FUNCIÓN DIRECTAMENTE. \n" +
            "Para probar Telegram, ejecuta la función 'testTelegram' seleccionándola en el menú superior.";
        console.warn(msg);
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: msg })).setMimeType(ContentService.MimeType.JSON);
    }

    var params = e.parameter || {}; // Start with query params

    // 1. INTENTAR LEER CUERPO JSON (Para app JS moderna)
    if (e.postData && e.postData.contents) {
        try {
            var json = JSON.parse(e.postData.contents);
            // Mezclar JSON con params
            for (var k in json) {
                params[k] = json[k];
            }
        } catch (err) {
            // No es JSON, continuamos
        }
    }

    if (!params.action) {
        output.setContent(JSON.stringify({ status: "error", message: "No action parameter found", received: params }));
        return output.setMimeType(ContentService.MimeType.JSON);
    }

    var action = params.action;
    var result = {};

    try {
        if (action === "register_user") result = registerUser(params);
        else if (action === "send_alert") result = saveAlert(params);
        else if (action === "check_status") result = checkStatus();
        else if (action === "login") result = loginUser(params);
        else if (action === "resolve_user") result = resolveUser(params);
        else if (action === "get_users") result = getUsers();
        else if (action === "get_alerts") result = getAlerts();
        else if (action === "resolve_alert") result = resolveAlert(params);
        else if (action === "delete_alert") result = deleteAlert(params);
        else if (action === "report_incident") result = saveIncident(params);
        else if (action === "save_news") result = saveNews(params);
        else if (action === "get_news") result = getNews();
        else if (action === "toggle_maint") result = toggleMaint(params);
        else if (action === "get_maint") result = getMaintStatus();
        else if (action === "get_config") result = getAppConfig(); // NUEVO
        else if (action === "save_config") result = saveAppConfig(params); // NUEVO
        else if (action === "get_dir") result = getDirectory(); // NUEVO
        else if (action === "save_dir") result = saveDirectory(params); // NUEVO
        else result = { status: "error", message: "Action unknown: " + action };

    } catch (error) {
        return { status: "error", message: error.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// --- FUNCIONES CORE ---

function registerUser(p) {
    // USAMOS EL NOMBRE EXACTO QUE TE DIJE: "Usuarios"
    var sheet = getSheet("Usuarios");

    // Validar duplicados (Columna B = Email)
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][1] == p.email) return { status: "error", message: "Este correo ya está registrado." };
    }

    // Datos a guardar
    // ID, Email, Pass, Nombre, Familia, Urb, Calle, Mz, Lote, Coords, Fecha, Status
    var row = [
        guid(),
        p.email,
        p.pass, // Ojo: en prod encriptar
        p.nombre,
        p.familia,
        "Urb. Melitón Carbajal", // Hardcoded
        p.direccion, // Calle concatenada
        p.mz,
        p.lote,
        p.coords,
        new Date(),
        "",          // INDICE 11: ROL (Vacío al inicio)
        "PENDIENTE"  // INDICE 12: STATUS
    ];

    sheet.appendRow(row);
    return { status: "success", message: "Registro Exitoso" };
}

function getUsers() {
    var sheet = getSheet("Usuarios");
    var data = sheet.getDataRange().getValues();
    var users = [];
    // Data starts row 1
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue; // Skip empty

        // STATUS INTELIGENTE: Leer Col 13 (Index 12) o Col 12 (Index 11) fallback
        var st = row[12];
        if (!st && row[11] === "PENDIENTE") st = "PENDIENTE";
        if (!st && row[11] === "ACTIVO") st = "ACTIVO";
        // Si sigue vacío, usar lo que haya en Col 11 aunque sea rol (mejor que nada)
        if (!st) st = row[11];

        users.push({
            id: row[0],
            email: row[1],
            nombre: row[3],
            familia: row[4],
            direccion: row[6],
            mz: row[7],
            lote: row[8],
            rol: row[11], // NUEVO: Incluir rol
            status: st // Status REAL detectado
        });
    }
    return { status: "success", data: users };
}

function getAlerts() {
    var sheet = getSheet("Alertas");
    var data = sheet.getDataRange().getValues();
    var alerts = [];
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue;
        alerts.push({
            id: row[0],
            user: row[1],
            type: row[2],
            coords: row[3],
            date: row[4],
            status: row[5]
        });
    }
    return { status: "success", data: alerts };
}

function saveIncident(p) {
    var sheet = getSheet("Reportes");

    // Guardar en Sheet REPORTES (Privado Admin)
    var rowData = [
        guid(),
        new Date(),
        p.user_id,
        p.familia,
        p.tipo,
        p.descripcion,
        p.coords,
        p.imagen ? "IMAGEN (VER CELDA)" : "SIN FOTO"
    ];

    // Guardar imagen si existe
    if (p.imagen) {
        rowData[7] = p.imagen;
    }
    sheet.appendRow(rowData);

    // NUEVO: PUBLICAR AUTOMÁTICAMENTE EN NOTICIAS (CON FOTO)
    try {
        var newsSheet = getSheet("Noticias");

        // Determinar tipo de Alerta para el chip
        var tipoNoticia = (p.tipo === "ROBO" || p.tipo === "SOSPECHOSO") ? "ALERTA" : "INFO";
        if (p.tipo === "RUIDO" || p.tipo === "BASURA") tipoNoticia = "COMUNIDAD";

        // AQUI ESTÁ EL CAMBIO CLAVE: p.imagen SE PASA A LA NOTICIA
        newsSheet.appendRow([
            guid(),
            "⚠️ VECINO REPORTA: " + p.tipo,
            p.descripcion + "\n\n(Reportado por: " + p.familia + ")",
            new Date(),
            p.imagen || "", // <--- AHORA PASAMOS LA IMAGEN REAL A LA NOTICIA
            p.familia
        ]);

    } catch (e) {
        console.error("Error publicando noticia auto: " + e);
    }

    // NOTIFICAR TELEGRAM (Admin)
    try {
        var icon = "📝";
        if (p.tipo === "ROBO" || p.tipo === "SOSPECHOSO") icon = "🚨";

        var mapLink = "https://maps.google.com/?q=" + p.coords;
        var mensaje = icon + " REPORTE VECINAL (" + p.tipo + ")\n\n" +
            "👤 " + p.familia + "\n" +
            "📄 " + p.descripcion + "\n" +
            "📍 Ubicación: " + mapLink + "\n" +
            "⏰ " + new Date().toLocaleTimeString();

        // Info adicional si hay foto
        if (p.imagen) mensaje += "\n📸 (Foto adjunta en la App)";

        sendTelegramMessage(mensaje);
    } catch (e) {
        console.error("Error Telegram Reporte: " + e.toString());
    }

    return { status: "success", message: "Reporte registrado y publicado" };
}

// --- CONFIGURACION TELEGRAM (VERSION SEGURA GITHUB) ---
// En Apps Script: Configura Archivo > Propiedades del proyecto > Propiedades del script
var PROP_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
var PROP_CHAT = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');

// =========================================================
// CAMBIAR AQUI TU TOKEN Y CHAT ID SI NO USAS PROPERTIES
// =========================================================
var TELEGRAM_BOT_TOKEN = PROP_TOKEN || "PON_AQUI_TU_TOKEN";
var TELEGRAM_CHAT_ID = PROP_CHAT || "PON_AQUI_TU_CHAT_ID";
// =========================================================

function saveAlert(p) {
    var sheet = getSheet("Alertas");

    // 1. Intentar Enviar a Telegram PRIMERO
    var telegramResult = "Pendiente";
    var mapLink = "https://maps.google.com/?q=" + p.coords;
    var mensaje = "🚨 ¡ALERTA VECINAL ACTIVADA! 🚨\n\n" +
        "👤 Familia: " + (p.familia || p.user_id) + "\n" +
        "📍 Ubicación: " + (p.direccion || "Ubicación GPS") + "\n" +
        "⏰ Hora: " + new Date().toLocaleTimeString() + "\n\n" +
        "🗺 Ver Mapa: " + mapLink;

    try {
        console.log("Intentando enviar Telegram a: " + TELEGRAM_CHAT_ID);
        var resp = sendTelegramMessage(mensaje);
        telegramResult = "ENVIO OK: " + resp;
    } catch (e) {
        console.error("Error Telegram: " + e.toString());
        telegramResult = "ERROR: " + e.toString();
    }

    // 2. Guardar en Sheet (SIN columnas extra, respetando esquema original)
    // ID, Usuario, Tipo, GPS, Fecha, Estado
    var rowData = [
        guid(),
        p.user_id, // Email o ID
        "SOS",
        p.coords,
        new Date(),
        "ACTIVA"
    ];
    sheet.appendRow(rowData);

    return { status: "success", message: "Alerta Guardada", debug: telegramResult };
}

function sendTelegramMessage(text) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.indexOf("PON_AQUI") !== -1) {
        return "Error: Token no configurado";
    }

    var chatId = String(TELEGRAM_CHAT_ID).trim();

    // INTENTO 1: JSON Payload (Estándar Moderno)
    try {
        var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
        var payload = {
            "chat_id": chatId,
            "text": text,
            "parse_mode": "HTML"
        };

        var options = {
            "method": "post",
            "contentType": "application/json",
            "payload": JSON.stringify(payload),
            "muteHttpExceptions": true
        };

        var response = UrlFetchApp.fetch(url, options);
        var code = response.getResponseCode();
        var content = response.getContentText();

        if (code === 200) {
            console.log("Telegram sent OK (JSON)");
            return content;
        } else {
            console.warn("Telegram JSON failed (" + code + "): " + content);
            // Si falla, pasamos al Intento 2
        }
    } catch (e) {
        console.error("Telegram Error Link 1: " + e);
    }

    // INTENTO 2: Query Parameters (Método "Nuclear" compatible con todo)
    try {
        console.log("Intentando método alternativo por URL...");
        var encodedText = encodeURIComponent(text);
        var fallbackUrl = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage?chat_id=" + chatId + "&text=" + encodedText;

        var options2 = {
            "method": "post",
            "muteHttpExceptions": true
        };

        var response2 = UrlFetchApp.fetch(fallbackUrl, options2);
        console.log("Telegram Fallback Code: " + response2.getResponseCode());
        return response2.getContentText();

    } catch (e) {
        console.error("Telegram CRITICAL FAILURE: " + e);
        throw new Error("Telegram falló completamente: " + e);
    }
}

function loginUser(p) {
    var sheet = getSheet("Usuarios");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        var row = data[i];

        // Hacemos la comparación en MINÚSCULAS para que sea insensible a mayúsculas
        // row[1] = Email, row[2] = Pass
        var dbEmail = String(row[1]).toLowerCase().trim();
        var dbPass = String(row[2]).toLowerCase().trim();
        var inputEmail = String(p.email).toLowerCase().trim();
        var inputPass = String(p.pass).toLowerCase().trim();

        if (dbEmail == inputEmail && dbPass == inputPass) {

            // Validar Estado
            // NUEVA ESTRUCTURA: [0]ID, [1]EMAIL..., [11]ROL, [12]ESTADO
            var rol = row[11];

            // SUPERADMIN HARDCODED (Seguridad)
            if (dbEmail === "hjalmar.meza@gmail.com") {
                rol = "ADMIN";
            }

            var status = row[12]; // Col 13
            // SMART CHECK: Si Col 13 falla, mira Col 12 (Index 11) o el Rol
            var statusClean = String(status || "").trim().toUpperCase();

            if (statusClean === "" && row[11] && String(row[11]).trim().toUpperCase() === "ACTIVO") {
                statusClean = "ACTIVO";
            }
            if (statusClean === "" && rol === "ACTIVO") statusClean = "ACTIVO";

            // Normalizar final
            statusClean = String(statusClean).trim().toUpperCase();

            // VALIDACIONES DE ACCESO
            if (statusClean === "BLOQUEADO") {
                return { status: "error", message: "Usuario BLOQUEADO por Administración." };
            }
            if (statusClean === "PENDIENTE") {
                return { status: "error", message: "Tu cuenta está PENDIENTE de aprobación." };
            }
            // Validación estricta
            if (statusClean !== "ACTIVO" && rol !== "ADMIN") {
                return { status: "error", message: "Cuenta no activa (" + statusClean + "). Contacta al Admin." };
            }

            return {
                status: "success",
                message: "Bienvenido",
                user: {
                    email: row[1],
                    nombre: row[3],
                    familia: row[4],
                    mz: row[7],
                    lote: row[8],
                    coords: row[9],
                    rol: rol, // Devolver rol
                    status: status
                }
            };
        }
    }
    return { status: "error", message: "Correo o contraseña incorrectos." };
}

// --- UTILS ---

function resolveUser(p) {
    var sheet = getSheet("Usuarios");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        // Col 0 es ID. Forzamos String y Trim para evitar fallos de coincidencia
        if (String(data[i][0]).trim() == String(p.user_id).trim()) {

            // ACTUALIZAR ROL SI SE ESPECIFICA
            if (p.role) {
                // Columna 12 (L) -> ROL (Indice 11)
                sheet.getRange(i + 1, 12).setValue(p.role);
            } else if (p.status === 'ACTIVO') {
                // Default: si aprobamos y no tiene rol, poner VECINO
                // Pero solo si estaba vacío. Si ya era P, lo dejamos.
                var currentRole = data[i][11];
                if (!currentRole || currentRole === "") {
                    sheet.getRange(i + 1, 12).setValue("VECINO");
                }
            }

            // ACTUALIZAR ESTADO
            // Columna 13 (M) -> ESTADO (Indice 12)
            sheet.getRange(i + 1, 13).setValue(p.status);

            // FORCE SAVE (Vital para ver cambios inmediatos)
            SpreadsheetApp.flush();

            return { status: "success", message: "Usuario actualizado a " + p.status + (p.role ? " con rol " + p.role : "") };
        }
    }
    return { status: "error", message: "ID no encontrado" };
}

function resolveAlert(p) {
    var sheet = getSheet("Alertas");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        // Col 0 es ID
        if (String(data[i][0]).trim() == String(p.alert_id).trim()) {
            // Columna 6 (F) -> ESTADO (Index 5)
            sheet.getRange(i + 1, 6).setValue("ATENDIDO");
            SpreadsheetApp.flush();
            return { status: "success", message: "Alerta marcada como ATENDIDO" };
        }
    }
    return { status: "error", message: "Alerta ID no encontrada" };
}

function deleteAlert(p) {
    var sheet = getSheet("Alertas");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() == String(p.alert_id).trim()) {
            sheet.deleteRow(i + 1);
            return { status: "success", message: "Alerta eliminada" };
        }
    }
    return { status: "error", message: "ID no encontrado" };
}


// --- UTILS ---
function getSheet(name) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        // Si no existe, la crea auto
        sheet = ss.insertSheet(name);
        if (name === "Usuarios") sheet.appendRow(["ID", "Email", "Password", "Nombre", "Familia", "Urbanización", "Dirección", "Mz", "Lote", "GPS", "Fecha Registro", "Estado"]);
        if (name === "Alertas") sheet.appendRow(["ID", "Usuario", "Tipo", "GPS", "Fecha", "Estado"]);
        if (name === "Reportes") sheet.appendRow(["ID", "Fecha", "Usuario", "Familia", "Tipo", "Descripción", "GPS", "Imagen"]);
        if (name === "Directorio") sheet.appendRow(["Nombre", "Cargo", "Telefono"]);
        if (name === "Configuracion") sheet.appendRow(["Clave", "Valor"]);
    }
    return sheet;
}

function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function checkStatus() {
    var sheet = getSheet("Alertas");
    var lastRow = sheet.getLastRow();

    // Si solo hay headers, nada
    if (lastRow < 2) return { status: "success", alert: null };

    // Obtener última alerta: [ID, Usuario, Tipo, GPS, Fecha, Estado]
    var range = sheet.getRange(lastRow, 1, 1, 6);
    var row = range.getValues()[0];

    var fechaAlerta = new Date(row[4]);
    var estado = row[5];
    var ahora = new Date();

    // Calcular diferencia en milisegundos y minutos
    var diffMs = ahora.getTime() - fechaAlerta.getTime();
    var diffMinutes = diffMs / 1000 / 60;

    // Lógica Robustecida para evitar problemas de Zona Horaria (-300 a +30 minutos)
    var esReciente = (diffMinutes < 30 && diffMinutes > -300);

    if (estado === "ACTIVA" && esReciente) {
        var userEmail = row[1];
        var userInfo = findUserByEmail(userEmail);

        return {
            status: "success",
            alert: {
                id: row[0],
                user: userInfo ? userInfo.familia : userEmail,
                from_email: userEmail,
                address: userInfo ? "Mz " + userInfo.mz + " Lt " + userInfo.lote : "Ubicación GPS",
                coords: row[3],
                time: row[4]
            }
        };
    }

    return { status: "success", alert: null };
}

function findUserByEmail(email) {
    var sheet = getSheet("Usuarios");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][1] == email) {
            return {
                familia: data[i][4],
                mz: data[i][7],
                lote: data[i][8]
            };
        }
    }
    return null;
}


// --- NOTICIAS ---
function saveNews(p) {
    var sheet = getSheet("Noticias"); // Se crea auto si no existe gracias a getSheet
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Titulo", "Cuerpo", "Fecha", "Imagen", "Autor"]);
    }

    var id = guid();
    var fecha = new Date();

    sheet.appendRow([
        id,
        p.titulo,
        p.cuerpo,
        fecha,
        p.imagen || "",
        "ADMIN"
    ]);

    return { status: "success", message: "Noticia publicada" };
}

function getNews() {
    var sheet = getSheet("Noticias");
    if (sheet.getLastRow() < 2) return { status: "success", data: [] };

    var data = sheet.getDataRange().getValues();
    var news = [];

    // Inverso (Noticias nuevas primero)
    for (var i = data.length - 1; i >= 1; i--) {
        var row = data[i];
        if (!row[0]) continue;

        news.push({
            id: row[0],
            titulo: row[1],
            cuerpo: row[2],
            fecha: row[3],
            imagen: row[4]
        });

        if (news.length >= 20) break;
    }

    return { status: "success", data: news };
}

// --- HERRAMIENTAS DE DIAGNÓSTICO ---
function testTelegram() {
    console.log("-----------------------------------------");
    console.log("🧪 INICIANDO PRUEBA DE TELEGRAM MANUAL");
    console.log("Token usado: " + (TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.substring(0, 10) + "..." : "VACIO"));
    console.log("Chat ID: " + TELEGRAM_CHAT_ID);

    var msj = "🔔 HOLA MUNDO: Esta es una prueba de conexión desde el Editor de Google Apps Script.";
    var respuesta = sendTelegramMessage(msj);

    console.log("Resultado del envío: " + respuesta);
    console.log("-----------------------------------------");

    if (respuesta.indexOf('"ok":true') > -1) {
        console.log("✅ ÉXITO: El mensaje debió llegar al grupo.");
    } else {
        console.error("❌ ERROR: Revisa el Chat ID o los permisos del Bot.");
    }
}

// --- TAREA PROGRAMADA: LIMPIEZA SEMANAL ---
// Configurar un Trigger (Activador) de tiempo: "Por día" -> "Medianoche"
function cleanupOldData() {
    // Dias a conservar
    var DAYS_TO_KEEP = 7;
    var cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);

    console.log("🧹 Iniciando Limpieza. Borrando anteriores a: " + cutoffDate.toDateString());

    cleanSheet("Alertas", 4, cutoffDate);  // Index 4 = Columna E (Fecha)
    cleanSheet("Reportes", 1, cutoffDate); // Index 1 = Columna B (Fecha)
    cleanSheet("Noticias", 3, cutoffDate); // Index 3 = Columna D (Fecha)
}

function cleanSheet(sheetName, dateColIndex, cutoffDate) {
    var sheet = getSheet(sheetName);
    var data = sheet.getDataRange().getValues();

    // Recorremos de ABAJO hacia ARRIBA para poder borrar sin alterar índices
    // Saltamos header (fila 0)
    var deletedCount = 0;

    for (var i = data.length - 1; i >= 1; i--) {
        var row = data[i];
        var dateCell = row[dateColIndex]; // La fecha

        // Intentar parsear fecha
        if (dateCell) {
            var rowDate = new Date(dateCell);
            // Si es válida y es mas antigua que cutoff
            if (!isNaN(rowDate.getTime()) && rowDate < cutoffDate) {
                sheet.deleteRow(i + 1); // +1 porque sheet es 1-based
                deletedCount++;
            }
        }
    }

    if (deletedCount > 0) {
        console.log("✅ " + sheetName + ": Se borraron " + deletedCount + " registros antiguos.");
    } else {
        console.log("ℹ️ " + sheetName + ": Todo limpio.");
    }
}

// --- MANTENIMIENTO ---
function toggleMaint(p) {
    try {
        var status = p.status === "true";
        PropertiesService.getScriptProperties().setProperty('MAINTENANCE_MODE', status);

        var msg = status ?
            "🔧 MODO MANTENIMIENTO ACTIVADO: La App Vecino estará bloqueada temporalmente para actualizaciones." :
            "✅ MODO NORMAL ACTIVADO: La App Vecino vuelve a estar disponible.";

        try {
            sendTelegramMessage(msg);
        } catch (err) {
            console.warn("Telegram failed but maintenance proceeding: " + err);
        }

        return { status: "success", isMaint: status };
    } catch (e) {
        return { status: "error", message: e.toString() };
    }
}

function getMaintStatus() {
    var status = PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE') === 'true';
    return { status: "success", isMaint: status };
}

// --- CONFIG APP (TELÉFONOS EN SHEET) ---
function getAppConfig() {
    var sheet = getSheet("Configuracion");
    var data = sheet.getDataRange().getValues();
    var config = {};
    for (var i = 1; i < data.length; i++) {
        config[data[i][0]] = data[i][1];
    }

    return {
        status: "success",
        phones: {
            police: config['PHONE_POLICE'] || "105",
            fire: config['PHONE_FIRE'] || "116",
            serenazgo: config['PHONE_SERENAZGO'] || "01 234 5678"
        }
    };
}

function saveAppConfig(p) {
    var sheet = getSheet("Configuracion");
    var data = sheet.getDataRange().getValues();

    function setVal(key, val) {
        if (!val) return;
        var found = false;
        for (var i = 1; i < data.length; i++) {
            if (data[i][0] == key) {
                sheet.getRange(i + 1, 2).setValue(val);
                found = true;
                break;
            }
        }
        if (!found) sheet.appendRow([key, val]);
    }

    setVal('PHONE_POLICE', p.police);
    setVal('PHONE_FIRE', p.fire);
    setVal('PHONE_SERENAZGO', p.serenazgo);

    SpreadsheetApp.flush(); // FORZAR GUARDADO INMEDIATO
    return { status: "success", message: "Números actualizados en Sheet" };
}

// --- DIRECTORIO ---
function getDirectory() {
    var sheet = getSheet("Directorio");
    var data = sheet.getDataRange().getValues();
    var dir = [];
    for (var i = 1; i < data.length; i++) {
        dir.push({ nombre: data[i][0], cargo: data[i][1], telf: data[i][2] });
    }
    return { status: "success", data: dir };
}

function saveDirectory(p) {
    var sheet = getSheet("Directorio");
    sheet.clear(); // Limpiar TODO (formatos y contenido) para empezar de cero
    sheet.appendRow(["Nombre", "Cargo", "Telefono"]);

    var data = JSON.parse(p.data);
    if (data && data.length > 0) {
        data.forEach(item => {
            sheet.appendRow([item.nombre, item.cargo, item.telf]);
        });
    }
    SpreadsheetApp.flush(); // FORZAR GUARDADO INMEDIATO
    return { status: "success", message: "Directorio actualizado" };
}
