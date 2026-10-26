using BibliotecaSistemaHB;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services.Seguridad;

namespace SistemaHBAPI.Services.Usuarios
{
    public interface IRegistroService
    {
        Task<Resultado> RegistrarAsync(REGISTROFORMCLS model);
    }

    public sealed class RegistroService : IRegistroService
    {
        private readonly SistemaHBContext _context;
        private readonly IPasswordService _passwords;

        public RegistroService(SistemaHBContext context, IPasswordService passwords)
        {
            _context = context;
            _passwords = passwords;
        }

        public async Task<Resultado> RegistrarAsync(REGISTROFORMCLS model)
        {
            if (model == null)
                return Resultado.BadRequest(new { mensaje = "Los datos del formulario están vacíos." });

            var correoExiste = await _context.CorreosElectronicos
                .AnyAsync(c => c.CorreoElectronico!.ToLower() == model.Correo!.ToLower());
            if (correoExiste)
                return Resultado.BadRequest(new { mensaje = "El correo electrónico ya se encuentra registrado por otro usuario." });

            var rol = model.Rol?.Trim() ?? "";
            bool esPaciente = rol.Equals("Paciente", StringComparison.OrdinalIgnoreCase);
            bool esMedico = rol.Equals("Medico", StringComparison.OrdinalIgnoreCase);

            if (!esPaciente && !esMedico)
                return Resultado.BadRequest(new { mensaje = "El rol especificado debe ser 'Paciente' o 'Medico'." });

            var idsEspecialidades = new List<int>();
            if (esMedico)
            {
                // Acepta varias especialidades; si solo llega idEspecialidad se usa esa.
                idsEspecialidades = (model.idEspecialidades is { Count: > 0 }
                        ? model.idEspecialidades
                        : new List<int> { model.idEspecialidad })
                    .Distinct().ToList();

                var existentes = await _context.Especialidades
                    .Where(e => idsEspecialidades.Contains(e.IdEspecialidad))
                    .Select(e => e.IdEspecialidad)
                    .ToListAsync();

                var inexistente = idsEspecialidades.FirstOrDefault(id => !existentes.Contains(id), -1);
                if (inexistente != -1)
                    return Resultado.BadRequest(new { mensaje = $"La especialidad con ID {inexistente} no existe en el sistema." });
            }

            var strategy = _context.Database.CreateExecutionStrategy();

            try
            {
                return await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        var persona = await CrearPersonaAsync(model);

                        if (esPaciente)
                            await CrearPacienteAsync(persona, model.Tipo_Sangre);
                        else
                            await CrearMedicoAsync(persona, idsEspecialidades);

                        await RegistrarCiudadSiNoExisteAsync(model);

                        await transaction.CommitAsync();
                        return Resultado.Ok(new { mensaje = "¡Registro completado exitosamente en el sistema!" });
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new
                {
                    mensaje = "Error interno al procesar el registro.",
                    error = ex.Message,
                    detalle = ex.InnerException != null ? ex.InnerException.Message : "Ninguno"
                });
            }
        }

        /// <summary>Fecha de nacimiento + correo (con la contraseña ya convertida en hash) + persona.</summary>
        private async Task<Persona> CrearPersonaAsync(REGISTROFORMCLS model)
        {
            var fecha = await _context.FechaNacimientos.FirstOrDefaultAsync(f => f.FechaDeNacimiento == model.FechaNacimiento);
            if (fecha == null)
            {
                fecha = new FechaNacimiento { FechaDeNacimiento = model.FechaNacimiento };
                _context.FechaNacimientos.Add(fecha);
                await _context.SaveChangesAsync();
            }

            var correo = new CorreosElectronico
            {
                CorreoElectronico = model.Correo,
                Contraseña = _passwords.Hash(model.Password!)
            };
            _context.CorreosElectronicos.Add(correo);
            await _context.SaveChangesAsync();

            int idGenero = 1;
            if (!string.IsNullOrEmpty(model.Genero))
            {
                var genero = await _context.Generos.FirstOrDefaultAsync(g => g.Nombre.ToLower() == model.Genero.ToLower());
                if (genero != null) idGenero = genero.IdGenero;
            }

            var persona = new Persona
            {
                Nombre = model.Nombre?.Trim() ?? "S/N",
                Paterno = model.ApellidoPaterno ?? "S/N",
                Materno = model.ApellidoMaterno ?? "S/N",
                IdFechaNacimiento = fecha.IdFechaNacimiento,
                IdCorreoElectronico = correo.IdCorreoElectronico,
                IdGenero = idGenero,
                IdCiudad = await ResolverIdCiudadAsync(model)
            };
            _context.Personas.Add(persona);
            await _context.SaveChangesAsync();
            return persona;
        }

        /// <summary>
        /// Ciudad que se guarda en el perfil: la enviada por el formulario (idCiudad); si no viene, la que
        /// coincide con el nombre de la provincia; y solo como último recurso el valor antiguo (idDepartamento).
        /// </summary>
        private async Task<int> ResolverIdCiudadAsync(REGISTROFORMCLS model)
        {
            if (model.idCiudad > 0 && await _context.Ciudads.AnyAsync(c => c.IdCiudad == model.idCiudad))
                return model.idCiudad;

            if (!string.IsNullOrWhiteSpace(model.Provincia))
            {
                var porNombre = await _context.Ciudads
                    .Where(c => c.Nombre.ToLower() == model.Provincia.Trim().ToLower())
                    .Select(c => (int?)c.IdCiudad)
                    .FirstOrDefaultAsync();
                if (porNombre != null) return porNombre.Value;
            }

            return model.idDepartamento;
        }

        private async Task CrearPacienteAsync(Persona persona, string? tipoSangre)
        {
            int? idTipoSangre = null;
            if (!string.IsNullOrEmpty(tipoSangre))
            {
                var tipo = await _context.TipoSangres.FirstOrDefaultAsync(c => c.TipoDeSangre!.ToLower() == tipoSangre.ToLower());
                idTipoSangre = tipo?.IdTipoSangre;
            }

            _context.Usuarios.Add(new Usuario { IdPersona = persona.IdPersona, IdTipoSangre = idTipoSangre });
            await _context.SaveChangesAsync();
        }

        private async Task CrearMedicoAsync(Persona persona, List<int> idsEspecialidades)
        {
            var medico = new Medico { IdPersona = persona.IdPersona };
            _context.Medicos.Add(medico);
            await _context.SaveChangesAsync();

            _context.MedicoEspecialidads.AddRange(idsEspecialidades.Select(id => new MedicoEspecialidad
            {
                IdMedico = medico.IdMedico,
                IdEspecialidad = id
            }));
            await _context.SaveChangesAsync();
        }

        /// <summary>Si la provincia escrita no existe en el catálogo, se agrega con su altitud.</summary>
        private async Task RegistrarCiudadSiNoExisteAsync(REGISTROFORMCLS model)
        {
            if (string.IsNullOrEmpty(model.Provincia)) return;

            var existe = await _context.Ciudads.AnyAsync(c => c.Nombre.ToLower() == model.Provincia.ToLower());
            if (existe) return;

            int idDepto = model.idDepartamento > 0 ? model.idDepartamento : 1;
            bool deptoExiste = await _context.Departamentos.AnyAsync(d => d.IdDepartamento == idDepto);

            _context.Ciudads.Add(new Ciudad
            {
                Nombre = model.Provincia.Trim(),
                Altitud = model.Altitud,
                IdDepartamento = deptoExiste ? idDepto : 1
            });
            await _context.SaveChangesAsync();
        }
    }
}
