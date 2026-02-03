function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    var output = ContentService.createTextOutput();
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

// --- CONFIGURACIÓN TELEGRAM ---
// El usuario debe obtener estos datos de @BotFather y su grupo
// OJO: REEMPLAZA ESTO EN GOOGLE APPS SCRIPT CON TU TOKEN REAL.
var TELEGRAM_BOT_TOKEN = "SECRETO_EN_GOOGLE_CLOUD";
var TELEGRAM_CHAT_ID = "SECRETO_EN_GOOGLE_CLOUD";

function saveAlert(p) {
    var sheet = getSheet("Alertas");
    var rowData = [
        guid(),
        p.user_id, // Email o ID
        "SOS",
        p.coords,
        new Date(),
        "ACTIVA"
    ];
    sheet.appendRow(rowData);

    // Enviar a Telegram
    var telegramResult = "No intentado";
    try {
        var mapLink = "https://maps.google.com/?q=" + p.coords;
        // MENSAJE PLANO SIN FORMATO MARKDOWN PARA EVITAR ERRORES
        var mensaje = "🚨 ¡ALERTA VECINAL ACTIVADA! 🚨\n\n" +
            "👤 Familia: " + (p.familia || p.user_id) + "\n" +
            "📍 Ubicación: " + (p.direccion || "Ubicación GPS") + "\n" +
            "⏰ Hora: " + new Date().toLocaleTimeString() + "\n\n" +
            "🗺 Ver Mapa: " + mapLink;

        telegramResult = sendTelegramMessage(mensaje);
    } catch (e) {
        console.error("Error Telegram: " + e.toString());
        telegramResult = "Error Catch: " + e.toString();
    }

    return { status: "success", message: "Alerta Guardada", debug: telegramResult };
}

function sendTelegramMessage(text) {
    if (TELEGRAM_BOT_TOKEN === "TU_TOKEN_AQUI") return "Token no configurado";

    var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
    var payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text
        // "parse_mode": "Markdown" <-- DESACTIVADO TEMPORALMENTE
    };

    var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true // Importante para ver si Telegram devuelve error 400
    };

    var response = UrlFetchApp.fetch(url, options);
    return response.getContentText(); // Devolvemos la respuesta para verla en logs
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
    // Ojo: obtener datos masivamente es mejor, pero aquí queremos lo último rápido
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
                from_email: userEmail, // Para filtrar "auto-alerta"
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
