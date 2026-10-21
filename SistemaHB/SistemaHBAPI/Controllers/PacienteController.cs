using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Paciente")]
    public class PacienteController : Controller
    {
        private readonly SistemaHBContext _context;

        public PacienteController(SistemaHBContext context)
        {
            _context = context;
        }
        [HttpGet("MisDatos/{idpaciente}")]
        public async Task<IActionResult> MisDatos([FromRoute] int idpaciente)
        {
            try
            {
                // 1. Buscamos el paciente en la tabla Usuarios
                var paciente = await _context.Usuarios.FirstOrDefaultAsync(e => e.IdUsuario == idpaciente);

                if (paciente == null)
                {
                    return BadRequest(new { mensaje = "La persona existe, pero no está configurada como paciente" });
                }

                // 2. Buscamos sus datos personales en la tabla Personas
                var usu = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == paciente.IdPersona);
                if (usu == null)
                {
                    return NotFound(new { mensaje = "Usuario no encontrado." });
                }

                // 3. Recopilamos de forma limpia los registros de sus tablas hijas normalizadas
                var fecha = await _context.FechaNacimientos.FirstOrDefaultAsync(e => e.IdFechaNacimiento == usu.IdFechaNacimiento);
                var correo = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.IdCorreoElectronico == usu.IdCorreoElectronico);
                var tiposangre = await _context.TipoSangres.FirstOrDefaultAsync(e => e.IdTipoSangre == paciente.IdTipoSangre);

                var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e=>e.IdCiudad==usu.IdCiudad);

                var departamento = await _context.Departamentos.FirstOrDefaultAsync(e => e.IdDepartamento == ciudad.IdDepartamento);
                // CORREGIDO: Eliminamos el bloque if/else espejo redundante y enviamos directo el resultado
                var resultado = new
                {
                    Persona = usu,
                    Usuario = paciente,
                    FechaNacimiento = fecha,
                    Correo = correo,
                    TipoSangre = tiposangre,
                    Ciudad = ciudad,
                    Departamento =departamento
                };

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error interno en el servidor", detalle = ex.Message });
            }
        }

        [HttpGet("mihistorial/{id}")]
        public async Task<IActionResult> MiHistorial([FromRoute] int id)
        {
            try
            {
                var historialCompleto = await _context.NivelHemoglobinas
                    .Where(e => e.IdUsuario == id)
                    .OrderByDescending(e => e.IdNivel) 
                    .ToListAsync();

                if (historialCompleto.Any())
                {
                    var resultado = new
                    {
                        Historial = historialCompleto,
                    };
                    return Ok(resultado);
                }
                else
                {
                    return Ok(new { mensaje = "Sin historial" });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }


        [HttpPut("editarpaciente/{id}")]
        public async Task<IActionResult> EditarPerfil(int id, [FromBody] EditPerfilDto model)
        {
            // 1. Buscamos el médico por su IdMedico (el '5' de la URL)
            var perfilpaciente = await _context.Usuarios.FirstOrDefaultAsync(e => e.IdUsuario == id);
            if (perfilpaciente == null)
            {
                return NotFound(new { mensaje = "Paciente no encontrado." });
            }

            // 2. Buscamos los datos de la Persona usando el IdPersona del médico (el '6')
            var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == perfilpaciente.IdPersona);
            var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e => e.IdCiudad == model.IdCiudad);

            if (persona == null)
            {
                return NotFound(new { mensaje = "Datos de persona no encontrados." });
            }

            try
            {
                persona.Nombre = model.Nombre;
                persona.Paterno = model.ApellidoPaterno;
                persona.Materno = model.ApellidoMaterno;
                persona.IdGenero = model.Genero; 
                persona.IdCiudad = ciudad.IdCiudad;
                var fecharegistro = await _context.FechaNacimientos
                    .FirstOrDefaultAsync(e => e.FechaDeNacimiento == model.FechaNacimiento);

                if (fecharegistro == null)
                {
                    var nuevafecha = new FechaNacimiento
                    {
                        FechaDeNacimiento = model.FechaNacimiento
                    };
                    _context.FechaNacimientos.Add(nuevafecha);
                    await _context.SaveChangesAsync(); 
                    persona.IdFechaNacimiento = nuevafecha.IdFechaNacimiento;
                }
                else
                {
                    persona.IdFechaNacimiento = fecharegistro.IdFechaNacimiento;
                }

                // 5. Gestión del Correo y Contraseña (Tabla: CorreosElectronicos)
                var correoregistro = await _context.CorreosElectronicos
                    .FirstOrDefaultAsync(e => e.CorreoElectronico == model.Correo);

                if (correoregistro != null)
                {
                    // Si el médico escribió una nueva contraseña, la actualizamos
                    if (!string.IsNullOrWhiteSpace(model.Password))
                    {
                        correoregistro.Contraseña = model.Password;
                        _context.Entry(correoregistro).State = EntityState.Modified;
                    }
                    persona.IdCorreoElectronico = correoregistro.IdCorreoElectronico;
                }
                else
                {
                    var nuevoCorreo = new CorreosElectronico
                    {
                        CorreoElectronico = model.Correo,
                        Contraseña = model.Password
                    };
                    _context.CorreosElectronicos.Add(nuevoCorreo);
                    await _context.SaveChangesAsync(); // Guardamos para generar el Id
                    persona.IdCorreoElectronico = nuevoCorreo.IdCorreoElectronico;
                }

                // 7. Tipo de sangre
                var tipo_sangre = await _context.TipoSangres.FirstOrDefaultAsync(e => e.TipoDeSangre == model.Tipo_Sangre);
                if (perfilpaciente != null)
                {
                    perfilpaciente.IdTipoSangre = tipo_sangre.IdTipoSangre;
                    _context.Entry(perfilpaciente).State = EntityState.Modified;
                }
                else
                {
                    perfilpaciente.IdTipoSangre = null;
                    _context.Entry(perfilpaciente).State = EntityState.Modified;
                }
                // 8. Guardamos la entidad principal Persona modificada
                _context.Entry(persona).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Ok(new { mensaje = "Tu perfil ha sido actualizado con éxito." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error interno al guardar los cambios.", detalle = ex.Message });
            }
        }

        [HttpGet("mismedicos/{id}")]
        public async Task<IActionResult>mismedicos([FromRoute] int id)
        {
            try
            {
                var medico = await (from medi in _context.PacienteMedicos
                                    join med in _context.Medicos on medi.IdMedico equals med.IdMedico
                                    join esp in _context.MedicoEspecialidads on med.IdMedico equals esp.IdMedico
                                    join especialidad in _context.Especialidades on esp.IdEspecialidad equals especialidad.IdEspecialidad
                                    join pers in _context.Personas on med.IdPersona equals pers.IdPersona
                                    join correo in _context.CorreosElectronicos on pers.IdCorreoElectronico equals correo.IdCorreoElectronico

                                    where medi.IdUsuario == id
                                    select new
                                    {
                                        idMedico =medi.IdMedico,
                                        Nombre = pers.Nombre,
                                        Paterno = pers.Paterno,
                                        Materno = pers.Materno,
                                        Especialidad = especialidad.Nombre,
                                        Correo=correo
                                    }).ToListAsync();
                return Ok(medico);
            }
            catch
            {
                return BadRequest();
            }
        }
    }
}
