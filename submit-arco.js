const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

// Función que genera el PDF
function generarPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.fontSize(18).text('ARCO HUB QTMD', { align: 'center' });
            doc.fontSize(12).text('Solicitud de Derechos ARCO', { align: 'center' });
            doc.moveDown();
            doc.text(`RUT: ${data.rut || 'No especificado'}`);
            doc.text(`Institucion: ${data.institution?.name || 'No especificada'}`);
            doc.text(`Tipo: ${data.type || 'No especificado'}`);
            doc.text(`Verificacion: ${data.verificationMethod || 'N/A'}`);
            doc.moveDown();
            doc.text('Justificacion:');
            doc.text(data.justification || 'No se proporciono justificacion.');
            doc.moveDown();
            doc.fontSize(10).text('Documento generado automaticamente por ARCO HUB QTMD.');
            doc.text('(c) 2026 Maria Isabel Egana Bacarreza - Obra Protegida por Propiedad Intelectual.');
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Handler de Vercel
module.exports = async (req, res) => {
    // Siempre responder JSON
    res.setHeader('Content-Type', 'application/json');

    try {
        // Solo POST
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, message: 'Metodo no permitido' });
        }

        const data = req.body || {};

        // Validar datos minimos
        if (!data.rut || !data.institution || !data.type) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos obligatorios (RUT, Institucion o Tipo).'
            });
        }

        // 1. Crear cuenta Ethereal DINAMICAMENTE
        let testAccount;
        try {
            testAccount = await nodemailer.createTestAccount();
        } catch (e) {
            console.error('Error creando cuenta Ethereal:', e);
            return res.status(500).json({
                success: false,
                message: 'Error al conectar con el servicio de correo.',
                error: e.message
            });
        }

        // 2. Configurar transporter con las credenciales reales
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        // 3. Generar el PDF
        const pdfBuffer = await generarPDF(data);

        // 4. Preparar el correo
        const mailOptions = {
            from: `"ARCO HUB QTMD" <${testAccount.user}>`,
            to: data.institution.email,
            subject: `Solicitud ARCO - ${data.type.toUpperCase()} - RUT: ${data.rut}`,
            html: `
                <h2>Solicitud de Derechos ARCO</h2>
                <p><strong>RUT:</strong> ${data.rut}</p>
                <p><strong>Institucion:</strong> ${data.institution.name}</p>
                <p><strong>Tipo:</strong> ${data.type}</p>
                <p><strong>Verificacion:</strong> ${data.verificationMethod}</p>
                <hr>
                <p><strong>Justificacion:</strong></p>
                <p>${data.justification || 'Sin justificacion.'}</p>
                <hr>
                <p style="font-size:11px;color:#666;">Generado por ARCO HUB QTMD &copy; 2026 Maria Isabel Egana Bacarreza</p>
            `,
            attachments: [
                {
                    filename: `Solicitud_ARCO_${data.rut}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // 5. Adjuntar archivos del usuario (si los hay)
        if (Array.isArray(data.files) && data.files.length > 0) {
            data.files.forEach(file => {
                if (file && file.data) {
                    try {
                        const base64 = file.data.split(',')[1] || file.data;
                        mailOptions.attachments.push({
                            filename: file.name || 'adjunto',
                            content: Buffer.from(base64, 'base64'),
                            contentType: file.type || 'application/octet-stream'
                        });
                    } catch (e) {
                        console.warn('Error adjuntando archivo:', e.message);
                    }
                }
            });
        }

        // 6. Enviar correo
        const info = await transporter.sendMail(mailOptions);

        // 7. Responder exito
        return res.status(200).json({
            success: true,
            message: 'Solicitud enviada exitosamente.',
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info) || null
        });

    } catch (error) {
        console.error('Error general en el handler:', error);
        // SIEMPRE devolver JSON aunque falle
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
            error: error.message || String(error)
        });
    }
};



