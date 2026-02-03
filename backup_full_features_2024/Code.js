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
        else if (action === "resolve_user") result = resolveUser(params); // Nuevo
        else if (action === "get_users") result = getUsers();
        else if (action === "get_alerts") result = getAlerts();
        else if (action === "report_incident") result = saveIncident(params); // Nuevo Handler Reportes
        else if (action === "save_news") result = saveNews(params); // Rutas Noticias
        else if (action === "get_news") result = getNews();         // Rutas Noticias
        else result = { status: "error", message: "Action unknown: " + action };

    } catch (error) {
        result = { status: "error", message: error.toString(), stack: error.stack };
    }

    output.setContent(JSON.stringify(result));
    return output.setMimeType(ContentService.MimeType.JSON);
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
var TELEGRAM_BOT_TOKEN = PROP_TOKEN || "TU_TOKEN_AQUI";
var TELEGRAM_CHAT_ID = PROP_CHAT || "TU_CHAT_ID_AQUI";
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
    if (TELEGRAM_BOT_TOKEN === "TU_TOKEN_AQUI" || !TELEGRAM_BOT_TOKEN) return "Error: Token no configurado";

    var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
    var payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text
    };

    var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(url, options);
    var content = response.getContentText();
    var code = response.getResponseCode();

    console.log("Telegram Response Code: " + code);
    console.log("Telegram Body: " + content);

    if (code !== 200) {
        throw new Error("Telegram FAILED (" + code + "): " + content);
    }

    return content;
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

// ... UTILS ...

function resolveUser(p) {
    var sheet = getSheet("Usuarios");
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        // Col 0 es ID. Forzamos String y Trim para evitar fallos de coincidencia
        if (String(data[i][0]).trim() == String(p.user_id).trim()) {

            // OBLIGATORIO: Escritura explícita para evitar ambigüedades
            if (p.status === 'ACTIVO') {
                // Columna 12 (L) -> ROL = VECINO
                sheet.getRange(i + 1, 12).setValue("VECINO");
                // Columna 13 (M) -> ESTADO = ACTIVO
                sheet.getRange(i + 1, 13).setValue("ACTIVO");
            } else {
                // Si bloquemos o pendiente, solo actualizamos Estado en Col 13
                sheet.getRange(i + 1, 13).setValue(p.status);
            }

            // FORCE SAVE (Vital para ver cambios inmediatos)
            SpreadsheetApp.flush();

            return { status: "success", message: "Usuario actualizado a " + p.status + " en fila " + (i + 1) };
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
