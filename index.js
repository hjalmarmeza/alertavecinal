const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuramos WhatsApp Web con auto-guardado de sesión y menos consumo de recursos (Render)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Cuando se genera un código QR
client.on('qr', async (qr) => {
    console.log('----------------------------------------------------');
    console.log('🚨 NUEVO CÓDIGO QR 🚨');
    console.log('Escanea este código con tu teléfono (NUEVA VINCULACIÓN)');
    const imagePath = __dirname + '/qr_code.png';
    await qrcode.toFile(imagePath, qr);
    console.log('✅ Imagen del QR guardada en: ' + imagePath);
    console.log('----------------------------------------------------');
});

// Cuando la conexión es exitosa
client.on('ready', () => {
    console.log('✅ El Bot de WhatsApp está conectado y listo.');
    console.log('Para ver tus grupos, ve a: http://localhost:3000/grupos');
});

// Responder a un comando simple de prueba dentro de WhatsApp
client.on('message', async msg => {
    if (msg.body === '!ping') {
        msg.reply('¡Pong! El bot está vivo 😉');
    }
});

/**
 * RUTA 1: Obtener la lista de grupos 
 * (Usaremos esto para conseguir el ID secreto de "🚨 Alertas Vecindario")
 */
app.get('/grupos', async (req, res) => {
    try {
        const chats = await client.getChats();

        // Filtramos para obtener solo grupos
        const groups = chats.filter(chat => chat.isGroup);

        // Extraemos nombre y el ID
        const groupInfo = groups.map(group => ({
            name: group.name,
            id: group.id._serialized
        }));

        res.json({ totalGrupos: groups.length, grupos: groupInfo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los grupos' });
    }
});

/**
 * RUTA 2: Enviar alerta a un grupo específico
 * (El Frontend de tu app web llamará a esta ruta al presionar el botón)
 */
app.post('/alerta', async (req, res) => {
    const { groupId, mensaje } = req.body;

    if (!groupId || !mensaje) {
        return res.status(400).json({ error: 'Faltan parámetros: groupId o mensaje' });
    }

    try {
        // Enviar el mensaje
        await client.sendMessage(groupId, mensaje);
        console.log(`🚨 Alerta enviada correctamente al grupo: ${groupId}`);
        res.json({ success: true, mensaje: 'Alerta enviada y entregada a WhatsApp' });
    } catch (error) {
        console.error('Error enviando la alerta:', error);
        res.status(500).json({ error: 'Error enviando la alerta. ¿Revisaste el groupId?' });
    }
});

/**
 * RUTA 3: El "Ping" anti-dormir
 * (Cron-job llamará a esta ruta cada 10 min para mantener a Render despierto)
 */
app.get('/ping', (req, res) => {
    res.send('pong');
});

// Iniciamos todo (Render asignará un PORT dinámicamente)
const PORT = process.env.PORT || 3000;

client.initialize();

app.listen(PORT, () => {
    console.log(`🌐 Servidor de Alertas Vecinales corriendo en http://localhost:${PORT}`);
    console.log(`⌛ Esperando a que inicie WhatsApp...`);
});
