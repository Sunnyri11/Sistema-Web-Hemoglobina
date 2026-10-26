using BibliotecaSistemaHB;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services.Seguridad;

namespace SistemaHBAPI.Services.Autenticacion
{
    public interface IAuthService
    {
        Task<Resultado> LoginAsync(LOGINFORMCLS model);
    }

    public sealed class AuthService : IAuthService
    {
        private readonly SistemaHBContext _context;
        private readonly IPasswordService _passwords;
        private readonly IJwtService _jwt;
        private readonly ILogger<AuthService> _logger;

        public AuthService(SistemaHBContext context, IPasswordService passwords, IJwtService jwt, ILogger<AuthService> logger)
        {
            _context = context;
            _passwords = passwords;
            _jwt = jwt;
            _logger = logger;
        }

        public async Task<Resultado> LoginAsync(LOGINFORMCLS model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password) || string.IsNullOrWhiteSpace(model.Rol))
            {
                return Resultado.BadRequest(new { mensaje = "El correo, la contraseña y el rol son obligatorios." });
            }

            try
            {
                var email = model.Email.Trim();

                var correoReg = await _context.CorreosElectronicos
                    .Include(c => c.Personas).ThenInclude(p => p.Usuarios)
                    .Include(c => c.Personas).ThenInclude(p => p.Medicos)
                    .Include(c => c.Personas).ThenInclude(p => p.Administradors)
                    .FirstOrDefaultAsync(c => c.CorreoElectronico != null && c.CorreoElectronico.ToLower() == email.ToLower());

                if (correoReg == null)
                    return Resultado.NoAutorizado(new { mensaje = "El correo electrónico no se encuentra registrado." });

                var persona = correoReg.Personas.FirstOrDefault();
                if (persona == null)
                    return Resultado.NoAutorizado(new { mensaje = "No existe un perfil de persona asociado a este correo." });

                if (!_passwords.Verificar(model.Password, correoReg.Contraseña))
                    return Resultado.NoAutorizado(new { mensaje = "Contraseña incorrecta." });

                var rol = model.Rol.Trim();
                string? idEntidadRol = rol.ToLowerInvariant() switch
                {
                    "paciente" => persona.Usuarios.FirstOrDefault()?.IdUsuario.ToString(),
                    "medico" => persona.Medicos.FirstOrDefault()?.IdMedico.ToString(),
                    "administrador" => persona.Administradors.FirstOrDefault()?.IdAdministrador.ToString(),
                    _ => null
                };

                if (idEntidadRol == null)
                    return Resultado.NoAutorizado(new { mensaje = $"El usuario no tiene asignado el rol de {model.Rol}." });

                await ActualizarHashSiHaceFaltaAsync(correoReg, model.Password);

                return Resultado.Ok(new
                {
                    token = _jwt.GenerarToken(persona, email, rol, idEntidadRol),
                    nombre = persona.Nombre ?? "Usuario",
                    rol,
                    idEntidad = idEntidadRol
                });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new
                {
                    mensaje = "Error interno del servidor al procesar la autenticación.",
                    detalle = ex.Message
                });
            }
        }

        /// <summary>Si la contraseña seguía en texto plano (o con un hash viejo), se guarda con el hash actual.</summary>
        private async Task ActualizarHashSiHaceFaltaAsync(CorreosElectronico correo, string passwordIngresada)
        {
            if (!_passwords.NecesitaActualizarse(correo.Contraseña)) return;

            try
            {
                correo.Contraseña = _passwords.Hash(passwordIngresada);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // El ingreso es válido; si no se pudo actualizar el hash se reintenta en el próximo login.
                _logger.LogWarning(ex, "No se pudo actualizar el hash de la contraseña del correo {Id}.", correo.IdCorreoElectronico);
            }
        }
    }
}
