const getBaseTemplate = (title, content) => {
    const logotype = process.env.BRAND_LOGO_URL || '';
    const primaryColor = '#10b981'; // Emerald Green

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, sans-serif; background-color: #f8fafc;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
                    <tr style="background-color: ${primaryColor};">
                        <td style="padding: 40px 30px; text-align: center;">
                            ${logotype ? `<img src="${logotype}" alt="Clinica - SaaS" style="height: 60px; margin-bottom: 20px;" />` : ''}
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${title}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 45px 35px; color: #334155; font-size: 16px; line-height: 1.6;">
                            ${content}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-weight: 600; color: #1e293b; font-size: 14px;">Clinica - SaaS Health System</p>
                            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px;">&copy; ${new Date().getFullYear()} Clinica - SaaS. Todos los derechos reservados / All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
};

exports.getWelcomeEmail = (nombre, email, password, urlLogin) => {
  const content = `
    <h2 style="color: #0f172a; margin-top: 0;">¡Bienvenido / Welcome, ${nombre}!</h2>
    <p>Tu cuenta operativa en <strong>Clinica - SaaS</strong> está lista. / Your account is ready.</p>
    <div style="background-color: #f1f5f9; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 10px 0;"><strong>Usuario / User:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Contraseña / Password:</strong> <span style="font-family: monospace; background: #fff; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px;">${password}</span></p>
    </div>
    <div style="background-color: #fef2f2; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Seguridad / Security:</strong> Deberás cambiar esta contraseña al ingresar. / You must change this password on first login.</p>
    </div>
    <div style="text-align: center; margin-top: 30px;">
        <a href="${urlLogin}" style="background-color: #10b981; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Acceder / Access Panel</a>
    </div>
  `;
  return getBaseTemplate('Bienvenido a Clinica - SaaS', content);
};

exports.getPasswordChangedEmail = (nombre) => {
  const content = `
    <h2 style="color: #0f172a; margin-top: 0;">Seguridad de la Cuenta</h2>
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Te informamos que la contraseña de tu cuenta ha sido actualizada exitosamente.</p>
    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 12px; border: 1px solid #d1fae5; margin: 25px 0; color: #065f46;">
        <p style="margin: 0;"><strong>Confirmación:</strong> Tu nueva contraseña ya está vigente. Si no realizaste este cambio, contacta a soporte de inmediato.</p>
    </div>
  `;
  return getBaseTemplate('Contraseña Actualizada', content);
};

exports.getPasswordResetEmail = (nombre, urlRecuperacion) => {
  const content = `
    <h2 style="color: #0f172a; margin-top: 0;">Recuperación de Acceso</h2>
    <p>Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>
    <div style="text-align: center; margin: 35px 0;">
        <a href="${urlRecuperacion}" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Restablecer Contraseña</a>
    </div>
    <p style="font-size: 13px; color: #94a3b8; text-align: center;">Si no solicitaste esto, puedes ignorar este correo de forma segura.</p>
  `;
  return getBaseTemplate('Restablecer Contraseña', content);
};

exports.getSubscriptionExpiryReminderEmail = ({ nombre, organizationName, daysLeft, expiresAt, subscriptionUrl }) => {
    const content = `
        <h2 style="color: #d97706; margin-top: 0;">Aviso de Suscripción</h2>
        <p>Hola <strong>${nombre}</strong>, la suscripción de <strong>${organizationName}</strong> vence en ${daysLeft} días (el ${expiresAt}).</p>
        <p>Evita interrupciones en el servicio renovando tu plan hoy mismo.</p>
        <div style="text-align: center; margin: 35px 0;">
                <a href="${subscriptionUrl}" style="background-color: #d97706; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Gestionar Renovación</a>
        </div>
    `;
    return getBaseTemplate('Vencimiento Próximo', content);
};

exports.getSubscriptionExpiredEmail = ({ nombre, organizationName, subscriptionUrl }) => {
    const content = `
        <h2 style="color: #dc2626; margin-top: 0;">Suscripción Vencida</h2>
        <p>Hola <strong>${nombre}</strong>, la suscripción de <strong>${organizationName}</strong> ha finalizado. El acceso se encuentra restringido temporalmente.</p>
        <div style="text-align: center; margin: 35px 0;">
                <a href="${subscriptionUrl}" style="background-color: #dc2626; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reactivar Ahora</a>
        </div>
    `;
    return getBaseTemplate('Cuenta Suspendida', content);
};

