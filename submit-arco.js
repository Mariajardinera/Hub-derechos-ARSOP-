// ============================================================
// BACKEND PARA VERCEL (ARCO HUB QTMD)
// Autor: María Isabel Egaña Bacarreza - RUT: 11.347.767-9
// ============================================================

const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

// Configuración del correo (usamos Ethereal para pruebas)
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
        user: 'prueba@ethereal.email',
        pass: 'prueba123'
    }
});

// Función para generar el PDF
function generarPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            doc.fontSize(18).text('ARCO HUB QTMD', { align: 'center' });
            doc.fontSize(12).text('Solicitud de Derechos ARCO', { align: 'center' });
            doc.moveDown();
            doc.text(`RUT del Titular: ${data.rut || 'No especificado'}`);
            doc.text(`Institución: ${data.institution?.name || 'No especificada'}`);
            doc.text(`Tipo de Solicitud: ${data.type || 'No especificado'}`);
            doc.text(`Método de Verificación: ${data.verificationMethod || 'N/A'}`);
            doc.moveDown();
            doc.text('Justificación:');
            doc.text(data.justification || 'No se proporcionó justificación.');
            doc.moveDown();
            doc.fontSize(10).text('Este documento fue generado automáticamente por ARCO HUB QTMD.');
            doc.text('Los datos biométricos fueron destruidos tras la verificación (GDPR).');
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

// Función principal que Vercel ejecutará
module.exports = async (req, res) => {
    // Solo aceptamos POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const data = req.body;

    // Validaciones básicas
    if (!data.rut || !data.institution || !data.type) {
        return res.status(400).json({
            success: false,
            message: 'Faltan datos obligatorios (RUT, Institución o Tipo).'
        });
    }

    try {
        // Generar el PDF
        const pdfBuffer = await generarPDF(data);

        // Configurar el correo
        const mailOptions = {
            from: '"ARCO HUB QTMD" <prueba@ethereal.email>',
            to: data.institution.email,
            subject: `Solicitud ARCO - ${data.type.toUpperCase()} - RUT: ${data.rut}`,
            html: `
                <h2>Solicitud de Derechos ARCO</h2>
                <p><strong>RUT:</strong> ${data.rut}</p>
                <p><strong>Institución:</strong> ${data.institution.name}</p>
                <p><strong>Tipo:</strong> ${data.type}</p>
                <p><strong>Justificación:</strong> ${data.justification || 'Sin justificación.'}</p>
            `,
            attachments: [
                {
                    filename: `Solicitud_ARCO_${data.rut}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                }
            ]
        };

        // Enviar el correo
        const info = await transporter.sendMail(mailOptions);

        // Responder al frontend
        res.status(200).json({
            success: true,
            message: 'Solicitud enviada exitosamente.',
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info)
        });

    } catch (error) {
        console.error('Error en el servidor:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
            error: error.message
        });
    }
};