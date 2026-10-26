using BibliotecaSistemaHB;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Usuarios
{
    public interface IMedicoService
    {
        Task<Resultado> MisDatosAsync(int idMedico);
        Task<Resultado> MisPacientesAsync(int idMedico);
        Task<Resultado> PacientesDisponiblesAsync(int idMedico);
        Task<Resultado> AnadirPacienteAsync(int idMedico, int idUsuario);
        Task<Resultado> BorrarPacienteAsync(int idMedico, int idUsuario);
        Task<Resultado> EditarPerfilAsync(int idMedico, EditPerfilDto model);
    }

    public sealed class MedicoService : IMedicoService
    {
        private readonly SistemaHBContext _context;
        private readonly IPerfilService _perfil;

        public MedicoService(SistemaHBContext context, IPerfilService perfil)
        {
            _context = context;
            _perfil = perfil;
        }

        public async Task<Resultado> MisDatosAsync(int idMedico)
        {
            try
            {
                var medico = await _context.Medicos.FirstOrDefaultAsync(e => e.IdMedico == idMedico);
                if (medico == null)
                    return Resultado.BadRequest(new { mensaje = "La persona existe, pero no está configurada como médico." });

                var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == medico.IdPersona);
                if (persona == null)
                    return Resultado.NoEncontrado(new { mensaje = "Usuario no encontrado." });

                var fecha = await _context.FechaNacimientos.FirstOrDefaultAsync(e => e.IdFechaNacimiento == persona.IdFechaNacimiento);
                var correo = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.IdCorreoElectronico == persona.IdCorreoElectronico);
                var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e => e.IdCiudad == persona.IdCiudad);
                var departamento = await _context.Departamentos.FirstOrDefaultAsync(e => e.IdDepartamento == ciudad!.IdDepartamento);
                var especialidades = await _context.MedicoEspecialidads.Where(e => e.IdMedico == medico.IdMedico).ToListAsync();

                // ¿El médico también está registrado como paciente? Si sí, se devuelve su tipo de sangre.
                var comoPaciente = await _context.Usuarios
                    .Include(u => u.IdTipoSangreNavigation)
                    .FirstOrDefaultAsync(u => u.IdPersona == persona.IdPersona);

                return Resultado.Ok(new
                {
                    Persona = persona,
                    Medico = medico,
                    Especialidades = especialidades,
                    FechaNacimiento = fecha,
                    Correo = _perfil.CorreoPublico(correo),
                    Ciudad = ciudad,
                    Departamento = departamento,
                    veripaciente = comoPaciente != null,
                    TipoSangre = comoPaciente?.IdTipoSangreNavigation?.TipoDeSangre
                });
            }
            catch (Exception ex)
            {
                return Resultado.BadRequest(new { error = "Error interno en el servidor", detalle = ex.Message });
            }
        }

        public async Task<Resultado> MisPacientesAsync(int idMedico)
        {
            try
            {
                var pacientes = await _context.PacienteMedicos
                    .Where(pm => pm.IdMedico == idMedico)
                    .Select(pm => new
                    {
                        idUsuario = pm.IdUsuario,
                        idPersona = pm.IdUsuarioNavigation!.IdPersona,
                        nombre = pm.IdUsuarioNavigation.IdPersonaNavigation!.Nombre,
                        paterno = pm.IdUsuarioNavigation.IdPersonaNavigation.Paterno,
                        materno = pm.IdUsuarioNavigation.IdPersonaNavigation.Materno,
                        tipoSangre = pm.IdUsuarioNavigation.IdTipoSangreNavigation!.TipoDeSangre ?? "No especificado",
                        email = pm.IdUsuarioNavigation.IdPersonaNavigation.IdCorreoElectronicoNavigation!.CorreoElectronico,
                        ciudad = pm.IdUsuarioNavigation.IdPersonaNavigation.IdCiudadNavigation,
                        departamento = pm.IdUsuarioNavigation.IdPersonaNavigation.IdCiudadNavigation.IdDepartamentoNavigation,

                        HistorialHemoglobinas = _context.NivelHemoglobinas
                            .Where(hist => hist.IdUsuario == pm.IdUsuario)
                            .Select(hist => new
                            {
                                idNivelHemoglobina = hist.IdNivel,
                                valor = hist.ValorHemoglobina,
                                fecha = hist.FechaAnalisis,
                                Rango = _context.RangoHemoglobinas
                                    .Where(rango => rango.IdRango == hist.IdRangoHemoglobina)
                                    .Select(rango => new
                                    {
                                        idRango = rango.IdRango,
                                        minimo = rango.ValorMin,
                                        maximo = rango.ValorMax,
                                    })
                                    .FirstOrDefault()
                            })
                            .ToList()
                    })
                    .ToListAsync();

                return Resultado.Ok(pacientes);
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { mensaje = "Error al procesar la solicitud.", detalle = ex.Message });
            }
        }

        /// <summary>Pacientes del sistema que este médico todavía no tiene asignados.</summary>
        public async Task<Resultado> PacientesDisponiblesAsync(int idMedico)
        {
            var pacientes = await (from u in _context.Usuarios
                                   join p in _context.Personas on u.IdPersona equals p.IdPersona
                                   join t in _context.TipoSangres on u.IdTipoSangre equals t.IdTipoSangre
                                   join c in _context.Ciudads on p.IdCiudad equals c.IdCiudad
                                   join x in _context.Departamentos on c.IdDepartamento equals x.IdDepartamento
                                   where !_context.PacienteMedicos.Any(pm => pm.IdUsuario == u.IdUsuario && pm.IdMedico == idMedico)
                                   select new
                                   {
                                       IdPaciente = u.IdUsuario,
                                       idUsuario = p.IdPersona,
                                       Nombre = p.Nombre,
                                       Paterno = p.Paterno,
                                       Materno = p.Materno,
                                       idTipoSangre = t.IdTipoSangre,
                                       TipoSangre = t.TipoDeSangre,
                                       Ciudad = c,
                                       Departamento = x,
                                   })
                                  .ToListAsync();

            return Resultado.Ok(pacientes);
        }

        public async Task<Resultado> AnadirPacienteAsync(int idMedico, int idUsuario)
        {
            try
            {
                if (!await _context.Usuarios.AnyAsync(u => u.IdUsuario == idUsuario))
                    return Resultado.NoEncontrado(new { mensaje = "El paciente con el ID proporcionado no existe en el sistema." });

                if (await _context.PacienteMedicos.AnyAsync(pm => pm.IdMedico == idMedico && pm.IdUsuario == idUsuario))
                    return Resultado.BadRequest(new { mensaje = "Este paciente ya se encuentra asignado a tu lista." });

                _context.PacienteMedicos.Add(new PacienteMedico { IdMedico = idMedico, IdUsuario = idUsuario });
                await _context.SaveChangesAsync();

                return Resultado.Ok(new { mensaje = "Paciente añadido exitosamente a tu relación médica." });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { mensaje = "Error al intentar asociar el paciente.", detalle = ex.Message });
            }
        }

        public async Task<Resultado> BorrarPacienteAsync(int idMedico, int idUsuario)
        {
            try
            {
                var relacion = await _context.PacienteMedicos
                    .FirstOrDefaultAsync(pm => pm.IdMedico == idMedico && pm.IdUsuario == idUsuario);

                if (relacion == null)
                    return Resultado.NoEncontrado(new { mensaje = "No existe una relación registrada entre tú y este paciente." });

                // Solo se quita el vínculo, no al paciente.
                _context.PacienteMedicos.Remove(relacion);
                await _context.SaveChangesAsync();

                return Resultado.Ok(new { mensaje = "Paciente eliminado correctamente de tu relación médica." });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { mensaje = "Error al intentar eliminar la relación.", detalle = ex.Message });
            }
        }

        public async Task<Resultado> EditarPerfilAsync(int idMedico, EditPerfilDto model)
        {
            var medico = await _context.Medicos.FirstOrDefaultAsync(e => e.IdMedico == idMedico);
            if (medico == null)
                return Resultado.NoEncontrado(new { mensaje = "Médico no encontrado." });

            var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == medico.IdPersona);
            if (persona == null)
                return Resultado.NoEncontrado(new { mensaje = "Datos de persona no encontrados." });

            try
            {
                // Primero lo que puede fallar por datos inválidos, antes de guardar nada.
                var errorEspecialidades = await SincronizarEspecialidadesAsync(medico, model.IdEspecialidades);
                if (errorEspecialidades != null) return errorEspecialidades;

                var error = await _perfil.ActualizarDatosPersonalesAsync(persona, model);
                if (error != null) return error;

                await RegistrarComoPacienteSiCorrespondeAsync(persona, model.Tipo_Sangre);

                _context.Entry(persona).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Resultado.Ok(new { mensaje = "Tu perfil ha sido actualizado con éxito." });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { mensaje = "Error interno al guardar los cambios.", detalle = ex.Message });
            }
        }

        /// <summary>
        /// Deja las especialidades del médico exactamente como llegaron: agrega las nuevas y quita las que
        /// ya no están, sin duplicar ni tocar las que se mantienen. Null = no cambiar nada.
        /// </summary>
        private async Task<Resultado?> SincronizarEspecialidadesAsync(Medico medico, List<int>? solicitadas)
        {
            if (solicitadas == null) return null;

            var ids = solicitadas.Where(id => id > 0).Distinct().ToList();
            if (ids.Count == 0)
                return Resultado.BadRequest(new { mensaje = "Debes seleccionar al menos una especialidad." });

            var validas = await _context.Especialidades
                .Where(e => ids.Contains(e.IdEspecialidad))
                .Select(e => e.IdEspecialidad)
                .ToListAsync();

            var invalida = ids.FirstOrDefault(id => !validas.Contains(id), -1);
            if (invalida != -1)
                return Resultado.BadRequest(new { mensaje = $"La especialidad con ID {invalida} no existe en el sistema." });

            var actuales = await _context.MedicoEspecialidads.Where(me => me.IdMedico == medico.IdMedico).ToListAsync();

            // Se quitan las que sobran (y los duplicados que hubiera quedado de antes).
            var vistos = new HashSet<int>();
            foreach (var fila in actuales)
            {
                if (fila.IdEspecialidad is int id && ids.Contains(id) && vistos.Add(id)) continue;
                _context.MedicoEspecialidads.Remove(fila);
            }

            foreach (var id in ids.Where(id => !vistos.Contains(id)))
            {
                _context.MedicoEspecialidads.Add(new MedicoEspecialidad { IdMedico = medico.IdMedico, IdEspecialidad = id });
            }

            return null;
        }

        /// <summary>Botón celeste: el médico también pasa a ser paciente (o actualiza su tipo de sangre).</summary>
        private async Task RegistrarComoPacienteSiCorrespondeAsync(Persona persona, string? tipoSangre)
        {
            if (string.IsNullOrEmpty(tipoSangre)) return;

            var tipo = await _context.TipoSangres.FirstOrDefaultAsync(e => e.TipoDeSangre == tipoSangre);
            if (tipo == null) return;

            var paciente = await _context.Usuarios.FirstOrDefaultAsync(u => u.IdPersona == persona.IdPersona);
            if (paciente == null)
            {
                _context.Usuarios.Add(new Usuario { IdPersona = persona.IdPersona, IdTipoSangre = tipo.IdTipoSangre });
            }
            else
            {
                paciente.IdTipoSangre = tipo.IdTipoSangre;
                _context.Entry(paciente).State = EntityState.Modified;
            }
        }
    }
}
