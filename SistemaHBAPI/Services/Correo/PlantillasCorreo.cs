namespace SistemaHBAPI.Services.Correo
{
    /// <summary>HTML de los correos. Se mantiene aparte para no ensuciar la lógica de los servicios.</summary>
    internal static class PlantillasCorreo
    {
        public static string Reporte(string nombrePaciente, int totalRegistros, string ultimoEstado, string colorEstado) => $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;'>
    <div style='background-color: #0f172a; padding: 20px; text-align: center; color: white;'>
        <h2 style='margin: 0;'>SISTEMA HB</h2>
    </div>
    <div style='padding: 25px; background-color: #ffffff; color: #334155;'>
        <p>Estimado(a) <strong>{nombrePaciente}</strong>,</p>
        <p>Adjunto encontrará su reporte clínico de niveles de hemoglobina generado en formato PDF.</p>
        <div style='background-color: #f8fafc; border-left: 4px solid #2980b9; padding: 15px; margin: 20px 0;'>
            <p style='margin: 4px 0;'><strong>Total de registros:</strong> {totalRegistros}</p>
            <p style='margin: 4px 0;'><strong>Último diagnóstico:</strong> <span style='color: {colorEstado}; font-weight: bold;'>{ultimoEstado}</span></p>
        </div>
    </div>
</div>";

        public static string RecuperarPassword(string urlRestablecer) => $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
    <div style='background-color: #0f172a; padding: 20px; text-align: center; color: white;'>
        <h2 style='margin: 0; font-size: 22px; letter-spacing: 1px;'>SISTEMA HB</h2>
        <p style='margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;'>Recuperación de Cuenta</p>
    </div>
    <div style='padding: 25px; background-color: #ffffff; color: #334155; line-height: 1.6;'>
        <p style='font-size: 16px; margin-top: 0;'>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta de acceso en el <strong>Sistema HB</strong>.</p>
        <p>Para proceder con el cambio de tu credencial de seguridad, haz clic en el siguiente botón interactivo:</p>

        <div style='text-align: center; margin: 30px 0;'>
            <a href='{urlRestablecer}'
               target='_blank'
               style='background-color: #c0392b; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 5px; display: inline-block; box-shadow: 0 2px 4px rgba(192,57,43,0.3);'>
               Restablecer Contraseña
            </a>
        </div>

        <p style='font-size: 13px; color: #64748b;'>Si el botón no funciona, puedes copiar y pegar la siguiente dirección directamente en tu navegador web:</p>
        <p style='font-size: 12px; color: #2980b9; word-break: break-all;'>{urlRestablecer}</p>

        <hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;' />
        <p style='font-size: 12px; color: #94a3b8; margin-bottom: 0;'>Si tú no solicitaste este cambio, puedes ignorar este mensaje de forma segura.</p>
    </div>
    <div style='background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;'>
        © {DateTime.Now.Year} Sistema HB - Control de Hemoglobina.
    </div>
</div>";
    }
}
