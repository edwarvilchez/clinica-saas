Correcciones en el Flujo de Recuperación de Contraseña
Este documento detalla los problemas identificados y las soluciones implementadas para hacer funcionar correctamente el ciclo completo de "Olvidé mi contraseña" ("Forgot Password") y el restablecimiento de la misma ("Reset Password").

1. Configuración de Envío de Correos (SMTP)
Problema:

El servidor de correo de Yahoo requiere el puerto 465, lo que implica una conexión segura (SSL), pero el script 
sendEmail.js
 del backend solo marcaba secure: true si la variable de entorno SMTP_SECURE equivalía literalmente a la cadena 'true'. Al tener SMTP_SECURE=SSL en el archivo 
.env
, la configuración fallaba silenciosamente y utilizaba una conexión no segura que agotaba el tiempo de espera.
Las políticas de seguridad de Yahoo exigen que el correo remitente (From) coincida exactamente con la cuenta autenticada. En el 
.env
 estaban configurados como dos cuentas diferentes (acrespo123@yahoo.es y acrespo@medicus-app.com).
El backend no reportaba el fallo del envío. Al fallar el servicio SMTP, silenciosamente pasaba al modo simulación (consola) y respondía al cliente con un éxito 200 OK.
Solución Implementada:

[MODIFY] 
server/src/utils/sendEmail.js
: Se ajustó la configuración del transporter SMTP para que se considere como conexión segura si la bandera es 'true', 'SSL', o si el puerto configurado es 465:
javascript
secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === 'SSL' || parseInt(process.env.SMTP_PORT) === 465
También se eliminó el ocultamiento del error en el bloque catch usando throw error;, para que el controlador sea consciente del fallo.
[MODIFY] 
server/.env
: Se igualó la variable FROM_EMAIL a acrespo123@yahoo.es para cumplir con las políticas anti-spam del servidor saliente (Yahoo SMTP).
2. Errores de Validación Visual y de Petición en el Frontend
Problema:

El formulario de nueva contraseña en el cliente Angular requería un mínimo de 6 caracteres sin restricciones, pero el servidor exigía mínimo 8 caracteres conteniendo mayúsculas, minúsculas y números (Regex en Joi).
El componente 
ResetPassword
 no enviaba el campo confirmPassword en el cuerpo de la petición HTTP, a pesar de que el usuario lo escribía en la pantalla. Esto causaba un error nativo de Joi: "Confirmación de password es requerida".
Los mensajes de error de la API no se estaban leyendo correctamente en el bloque 
error
 de la llamada HTTP, mostrando mensajes desincronizados u omitiendo el detalle exacto.
Solución Implementada:

[MODIFY] 
client/src/app/components/reset-password/reset-password.html
: Se cambió la restricción minlength de 6 a 8 y se incluyeron los mensajes de feedback visual (<small>) específicos para las validaciones required, minlength y pattern.
[MODIFY] 
client/src/app/components/reset-password/reset-password.ts
:
Se aplicaron en el Reactive Formulary de Angular los mismos validadores que en el backend.
Se modificó el mapa de datos a enviar (const data = {...}) incluyendo confirmPassword: this.resetForm.value.confirmPassword.
Se ajustó la captura del mensaje de error para que exponga directamente lo devuelto por el servidor (err.error?.message).
3. Descarte del Parámetro Token por Validación Estricta
Problema:

Una vez solucionado el fallo de envío en el frontend, el servidor lanzaba el error de base de datos WHERE parameter "resetToken" has invalid "undefined" value.
El error era provocado por el validador Joi centralizado de la ruta /api/auth/reset-password (resetPasswordSchema). El esquema de validación no tenía definido de antemano el campo token. En consecuencia, el validate.middleware.js descartaba cualquier campo desconocido para ajustarse estrictamente al esquema y borraba silenciosamente el token del cuerpo de la petición.
Solución Implementada:

[MODIFY] 
server/src/validators/auth.validator.js
: Se incluyó de manera obligatoria el nuevo campo token dentro del esquema resetPasswordSchema:
javascript
const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Token es requerido',
  }),
  // ...
De este modo, el controlador 
auth.controller.js
 ya recibe el valor extraído en req.body tal cual proviene del cliente, permitiéndole consultar con éxito el validador UUID (resetToken).