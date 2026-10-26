using BibliotecaSistemaHB;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services.Seguridad;

namespace SistemaHBAPI.Services.Usuarios
{
    public interface IPerfilService
    {
        /// <summary>
        /// Aplica a la persona la parte común de la edición de perfil (nombre, género, ciudad,
        /// fecha de nacimiento, correo y contraseña). Devuelve null si todo salió bien o el
        /// Resultado de error que debe responderse.
        /// </summary>
        Task<Resultado?> ActualizarDatosPersonalesAsync(Persona persona, EditPerfilDto model);

        /// <summary>Correo sin la contraseña: nunca se expone el hash (ni texto plano) hacia el frontend.</summary>
        object? CorreoPublico(CorreosElectronico? correo);
    }

    public sealed class PerfilService : IPerfilService
    {
        private readonly SistemaHBContext _context;
        private readonly IPasswordService _passwords;

        public PerfilService(SistemaHBContext context, IPasswordService passwords)
        {
            _context = context;
            _passwords = passwords;
        }

        public object? CorreoPublico(CorreosElectronico? correo) =>
            correo == null ? null : new
            {
                correo.IdCorreoElectronico,
                correo.CorreoElectronico,
                Contraseña = (string?)null
            };

        public async Task<Resultado?> ActualizarDatosPersonalesAsync(Persona persona, EditPerfilDto model)
        {
            // Los campos que lleguen vacíos o nulos conservan el valor actual.
            if (!string.IsNullOrWhiteSpace(model.Nombre)) persona.Nombre = model.Nombre.Trim();
            if (!string.IsNullOrWhiteSpace(model.ApellidoPaterno)) persona.Paterno = model.ApellidoPaterno.Trim();
            if (model.ApellidoMaterno != null) persona.Materno = model.ApellidoMaterno.Trim();
            if (model.Genero is > 0) persona.IdGenero = model.Genero.Value;

            if (model.IdCiudad is > 0)
            {
                var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e => e.IdCiudad == model.IdCiudad);
                if (ciudad == null)
                    return Resultado.NoEncontrado(new { mensaje = "La ciudad seleccionada no existe." });
                persona.IdCiudad = ciudad.IdCiudad;
            }

            if (model.FechaNacimiento.HasValue)
                persona.IdFechaNacimiento = await ObtenerIdFechaAsync(model.FechaNacimiento);

            return string.IsNullOrWhiteSpace(model.Correo)
                ? await ActualizarSoloPasswordAsync(persona, model)
                : await ActualizarCorreoAsync(persona, model);
        }

        /// <summary>No llegó un correo: solo se cambia la contraseña (si hay una nueva) del correo actual.</summary>
        private async Task<Resultado?> ActualizarSoloPasswordAsync(Persona persona, EditPerfilDto model)
        {
            if (string.IsNullOrWhiteSpace(model.Password) || _passwords.EsHash(model.Password)) return null;

            var actual = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.IdCorreoElectronico == persona.IdCorreoElectronico);
            if (actual == null) return null;

            actual.Contraseña = _passwords.Hash(model.Password);
            _context.Entry(actual).State = EntityState.Modified;
            return null;
        }

        private async Task<int?> ObtenerIdFechaAsync(DateOnly? fecha)
        {
            var existente = await _context.FechaNacimientos.FirstOrDefaultAsync(e => e.FechaDeNacimiento == fecha);
            if (existente != null) return existente.IdFechaNacimiento;

            var nueva = new FechaNacimiento { FechaDeNacimiento = fecha };
            _context.FechaNacimientos.Add(nueva);
            await _context.SaveChangesAsync(); // genera el Id
            return nueva.IdFechaNacimiento;
        }

        private async Task<Resultado?> ActualizarCorreoAsync(Persona persona, EditPerfilDto model)
        {
            // Si el frontend devuelve tal cual el valor que recibió, no es una contraseña nueva.
            bool hayPasswordNueva = !string.IsNullOrWhiteSpace(model.Password) && !_passwords.EsHash(model.Password);

            var correo = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.CorreoElectronico == model.Correo);

            if (correo != null)
            {
                // Un correo que ya pertenece a otra cuenta no se puede tomar (ni cambiarle la contraseña).
                if (persona.IdCorreoElectronico != correo.IdCorreoElectronico)
                    return Resultado.BadRequest(new { mensaje = "El correo electrónico ya está en uso por otra cuenta." });

                if (hayPasswordNueva)
                {
                    correo.Contraseña = _passwords.Hash(model.Password!);
                    _context.Entry(correo).State = EntityState.Modified;
                }
                return null;
            }

            // Correo nuevo: si no escribió contraseña, conserva la que ya tenía.
            string? passwordFinal;
            if (hayPasswordNueva)
            {
                passwordFinal = _passwords.Hash(model.Password!);
            }
            else
            {
                var actual = await _context.CorreosElectronicos
                    .AsNoTracking()
                    .FirstOrDefaultAsync(e => e.IdCorreoElectronico == persona.IdCorreoElectronico);
                passwordFinal = actual?.Contraseña;
            }

            var nuevo = new CorreosElectronico { CorreoElectronico = model.Correo, Contraseña = passwordFinal };
            _context.CorreosElectronicos.Add(nuevo);
            await _context.SaveChangesAsync(); // genera el Id
            persona.IdCorreoElectronico = nuevo.IdCorreoElectronico;
            return null;
        }
    }
}
