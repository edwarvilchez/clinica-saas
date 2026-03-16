const getBaseTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f9;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <tr style="background-color: #00233e;">
                        <td style="padding: 30px; text-align: center;">
                            <img src="cid:logo_medicus" alt="Medicus" style="width: 120px; height: auto; border-radius: 50%; border: 2px solid #6ed1b3; margin-bottom: 10px;" />
                            <h1 style="color: #6ed1b3; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">
                                Medicus
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px; color: #333333; line-height: 1.6;">
                            ${content}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px; text-align: center; background-color: #f8f9fa; color: #777777; font-size: 12px;">
                            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Medicus App. Todos los derechos reservados.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

exports.getWelcomeEmail = (nombre, email, password, urlLogin) => {
  const content = `
    <h2 style="color: #0056b3;">¡Hola, ${nombre}!</h2>
    <p style="font-size: 16px;">Gracias por unirte a nuestra plataforma. Estamos comprometidos con brindarte las mejores herramientas para la gestión de salud y soluciones escalables.</p>
    <p style="font-size: 16px;">Tu cuenta ha sido creada exitosamente. Ya puedes acceder a todas nuestras funcionalidades con las siguientes credenciales temporales:</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #e9ecef; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Usuario/Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Contraseña Temporal:</strong> <span style="font-family: monospace; font-size: 16px; background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${password}</span></p>
    </div>

    <p style="font-size: 14px; color: #dc3545;"><strong>Importante:</strong> Por tu seguridad, el sistema te solicitará cambiar esta contraseña en tu primer inicio de sesión.</p>

    <div style="text-align: center; margin-top: 30px;">
        <a href="${urlLogin}" style="background-color: #28a745; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Acceder a mi cuenta</a>
    </div>
  `;
  return getBaseTemplate('Bienvenido a Medicus', content);
};

exports.getPasswordChangedEmail = (nombre) => {
  const content = `
    <h2 style="color: #0056b3;">Actualización de Seguridad</h2>
    <p style="font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
    <p style="font-size: 16px;">Has actualizado tu contraseña de manera exitosa.</p>
    <p style="font-size: 16px; background-color: #e9f7ef; padding: 15px; border-left: 4px solid #28a745;">
        <strong>Nota:</strong> Tu cuenta ahora está más protegida. Recuerda no compartir tus credenciales con terceros.
    </p>
    <p style="font-size: 16px;">Si no realizaste este cambio, por favor contacta a nuestro equipo de soporte técnico de inmediato para asegurar tu cuenta.</p>
  `;
  return getBaseTemplate('Cambio de Contraseña Exitoso', content);
};

exports.getPasswordResetEmail = (nombre, urlRecuperacion) => {
  const content = `
    <h2 style="color: #0056b3;">Recuperar Contraseña</h2>
    <p style="font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
    <p style="font-size: 16px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Medicus</strong>.</p>
    <p style="font-size: 16px;">Haz clic en el botón de abajo para elegir una nueva contraseña. Este enlace es válido por <strong>60 minutos</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
        <a href="${urlRecuperacion}" style="background-color: #0056b3; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Restablecer mi contraseña</a>
    </div>
    <p style="font-size: 13px; color: #999999;">Si no solicitaste este cambio o recordaste tu contraseña, puedes ignorar este correo sin problemas; tu contraseña actual y accesos seguirán funcionando.</p>
  `;
  return getBaseTemplate('Restablecer tu Contraseña', content);
};
