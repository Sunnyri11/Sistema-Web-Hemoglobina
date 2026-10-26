using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SistemaHBAPI.Configuracion;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services.Seguridad;

namespace SistemaHBAPI.Services.Correo
{
    public interface IRecuperacionService
    {
        /// <summary>Envía por Brevo el enlace para restablecer la contraseña.</summary>
        Task<Resultado> SolicitarAsync(string correo);

        /// <summary>Guarda la nueva contraseña (como hash) del correo contenido en el código cifrado.</summary>
        Task<Resultado> RestablecerAsync(string correoCifrado, string nuevaPassword);
    }

    public sealed class RecuperacionService : IRecuperacionService
    {
        private readonly SistemaHBContext _context;
        private readonly IEmailService _email;
        private readonly IPasswordService _passwords;
        private readonly CryptoService _crypto;
        private readonly FrontendOptions _frontend;

        public RecuperacionService(
            SistemaHBContext context, IEmailService email, IPasswordService passwords,
            CryptoService crypto, IOptions<FrontendOptions> frontend)
        {
            _context = context;
            _email = email;
            _passwords = passwords;
            _crypto = crypto;
            _frontend = frontend.Value;
        }

        public async Task<Resultado> SolicitarAsync(string correo)
        {
            if (string.IsNullOrEmpty(correo))
                return Resultado.BadRequest(new { mensaje = "El correo electrónico es obligatorio." });

            try
            {
                var existente = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.CorreoElectronico == correo);
                if (existente == null)
                    return Resultado.NoEncontrado(new { mensaje = "El correo electrónico no se encuentra registrado." });

                // rootpassword.html lee el parámetro "correo" y lo devuelve al endpoint de restablecer.
                string url = $"{_frontend.UrlRestablecer}?correo={_crypto.Encrypt(correo)}";

                var envio = await _email.EnviarAsync(
                    correo, "Usuario Sistema HB",
                    "🔑 Restablecer Contraseña - Sistema HB",
                    PlantillasCorreo.RecuperarPassword(url));

                if (envio.Exitoso)
                    return Resultado.Ok(new { mensaje = "Se ha enviado un enlace de recuperación a tu correo electrónico." });

                return Resultado.ConCodigo(envio.Codigo, new { error = "Fallo al enviar correo de recuperación web", detalle = envio.Detalle });
            }
            catch (Exception ex)
            {
                return Resultado.BadRequest(new { error = ex.Message });
            }
        }

        public async Task<Resultado> RestablecerAsync(string correoCifrado, string nuevaPassword)
        {
            try
            {
                string correo = _crypto.Decrypt(correoCifrado);
                if (string.IsNullOrEmpty(correo))
                    return Resultado.BadRequest(new { mensaje = "El código de recuperación no es válido o ha sido alterado." });

                var registro = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.CorreoElectronico == correo);
                if (registro == null)
                    return Resultado.NoEncontrado(new { mensaje = "El usuario asociado a este enlace no está registrado." });

                if (string.IsNullOrWhiteSpace(nuevaPassword))
                    return Resultado.BadRequest(new { mensaje = "La nueva contraseña no puede estar vacía." });

                if (_passwords.Verificar(nuevaPassword, registro.Contraseña))
                    return Resultado.BadRequest(new { mensaje = "La nueva contraseña no puede ser igual a la anterior." });

                registro.Contraseña = _passwords.Hash(nuevaPassword);
                _context.Entry(registro).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Resultado.Ok(new { mensaje = "Contraseña restablecida correctamente." });
            }
            catch (Exception ex)
            {
                return Resultado.BadRequest(new { error = ex.Message });
            }
        }
    }
}
