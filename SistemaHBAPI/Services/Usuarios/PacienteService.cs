using BibliotecaSistemaHB;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Usuarios
{
    public interface IPacienteService
    {
        Task<Resultado> MisDatosAsync(int idPaciente);
        Task<Resultado> MiHistorialAsync(int idUsuario);
        Task<Resultado> EditarPerfilAsync(int idUsuario, EditPerfilDto model);
        Task<Resultado> MisMedicosAsync(int idUsuario);
    }

    public sealed class PacienteService : IPacienteService
    {
        private readonly SistemaHBContext _context;
        private readonly IPerfilService _perfil;

        public PacienteService(SistemaHBContext context, IPerfilService perfil)
        {
            _context = context;
            _perfil = perfil;
        }

        public async Task<Resultado> MisDatosAsync(int idPaciente)
        {
            try
            {
                var paciente = await _context.Usuarios.FirstOrDefaultAsync(e => e.IdUsuario == idPaciente);
                if (paciente == null)
                    return Resultado.BadRequest(new { mensaje = "La persona existe, pero no está configurada como paciente" });

                var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == paciente.IdPersona);
                if (persona == null)
                    return Resultado.NoEncontrado(new { mensaje = "Usuario no encontrado." });

                var fecha = await _context.FechaNacimientos.FirstOrDefaultAsync(e => e.IdFechaNacimiento == persona.IdFechaNacimiento);
                var correo = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.IdCorreoElectronico == persona.IdCorreoElectronico);
                var tipoSangre = await _context.TipoSangres.FirstOrDefaultAsync(e => e.IdTipoSangre == paciente.IdTipoSangre);
                var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e => e.IdCiudad == persona.IdCiudad);
                var departamento = await _context.Departamentos.FirstOrDefaultAsync(e => e.IdDepartamento == ciudad!.IdDepartamento);

                return Resultado.Ok(new
                {
                    Persona = persona,
                    Usuario = paciente,
                    FechaNacimiento = fecha,
                    Correo = _perfil.CorreoPublico(correo),
                    TipoSangre = tipoSangre,
                    Ciudad = ciudad,
                    Departamento = departamento
                });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { error = "Error interno en el servidor", detalle = ex.Message });
            }
        }

        public async Task<Resultado> MiHistorialAsync(int idUsuario)
        {
            try
            {
                var historial = await _context.NivelHemoglobinas
                    .Where(e => e.IdUsuario == idUsuario)
                    .OrderByDescending(e => e.IdNivel)
                    .ToListAsync();

                return historial.Any()
                    ? Resultado.Ok(new { Historial = historial })
                    : Resultado.Ok(new { mensaje = "Sin historial" });
            }
            catch (Exception ex)
            {
                return Resultado.BadRequest(new { error = ex.Message });
            }
        }

        public async Task<Resultado> EditarPerfilAsync(int idUsuario, EditPerfilDto model)
        {
            var paciente = await _context.Usuarios.FirstOrDefaultAsync(e => e.IdUsuario == idUsuario);
            if (paciente == null)
                return Resultado.NoEncontrado(new { mensaje = "Paciente no encontrado." });

            var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == paciente.IdPersona);
            if (persona == null)
                return Resultado.NoEncontrado(new { mensaje = "Datos de persona no encontrados." });

            try
            {
                var error = await _perfil.ActualizarDatosPersonalesAsync(persona, model);
                if (error != null) return error;

                // Tipo de sangre: solo se cambia si llegó uno válido.
                if (!string.IsNullOrEmpty(model.Tipo_Sangre))
                {
                    var tipo = await _context.TipoSangres.FirstOrDefaultAsync(e => e.TipoDeSangre == model.Tipo_Sangre);
                    if (tipo != null)
                    {
                        paciente.IdTipoSangre = tipo.IdTipoSangre;
                        _context.Entry(paciente).State = EntityState.Modified;
                    }
                }

                _context.Entry(persona).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Resultado.Ok(new { mensaje = "Tu perfil ha sido actualizado con éxito." });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { mensaje = "Error interno al guardar los cambios.", detalle = ex.Message });
            }
        }

        public async Task<Resultado> MisMedicosAsync(int idUsuario)
        {
            try
            {
                var medicos = await (from rel in _context.PacienteMedicos
                                     join med in _context.Medicos on rel.IdMedico equals med.IdMedico
                                     join esp in _context.MedicoEspecialidads on med.IdMedico equals esp.IdMedico
                                     join especialidad in _context.Especialidades on esp.IdEspecialidad equals especialidad.IdEspecialidad
                                     join pers in _context.Personas on med.IdPersona equals pers.IdPersona
                                     join correo in _context.CorreosElectronicos on pers.IdCorreoElectronico equals correo.IdCorreoElectronico
                                     where rel.IdUsuario == idUsuario
                                     select new
                                     {
                                         idMedico = rel.IdMedico,
                                         Nombre = pers.Nombre,
                                         Paterno = pers.Paterno,
                                         Materno = pers.Materno,
                                         Especialidad = especialidad.Nombre,
                                         // Solo id y correo: antes se enviaba el registro completo con la contraseña del médico.
                                         Correo = new
                                         {
                                             correo.IdCorreoElectronico,
                                             correo.CorreoElectronico,
                                             Contraseña = (string?)null
                                         }
                                     }).ToListAsync();

                return Resultado.Ok(medicos);
            }
            catch
            {
                return Resultado.BadRequest();
            }
        }
    }
}
