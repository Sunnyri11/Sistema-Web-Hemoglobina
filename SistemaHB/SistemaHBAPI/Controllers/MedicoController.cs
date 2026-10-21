using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SistemaHBAPI.Models;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Text.Json;
using BibliotecaSistemaHB;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Medico")]
    public class MedicoController : ControllerBase
    {

        private readonly SistemaHBContext _context;

        public MedicoController(SistemaHBContext context)
        {
            _context = context;
        }

        [HttpGet("MisDatos/{idmedico}")]
        public async Task<IActionResult> MisDatos([FromRoute] int idmedico)
        {
            try
            {
                var medico = await _context.Medicos.FirstOrDefaultAsync(e => e.IdMedico == idmedico);

                if (medico == null)
                {
                    // Evitamos que el código se rompa si la persona no es un médico
                    return BadRequest(new { mensaje = "La persona existe, pero no está configurada como médico." });
                }

                var usu = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == medico.IdPersona);
                if (usu == null)
                {
                    return NotFound(new { mensaje = "Usuario no encontrado." });
                }


                var fecha = await _context.FechaNacimientos.FirstOrDefaultAsync(e => e.IdFechaNacimiento == usu.IdFechaNacimiento);
                var correo = await _context.CorreosElectronicos.FirstOrDefaultAsync(e => e.IdCorreoElectronico == usu.IdCorreoElectronico);

                var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e => e.IdCiudad == usu.IdCiudad);

                var departamento = await _context.Departamentos.FirstOrDefaultAsync(e => e.IdDepartamento == ciudad.IdDepartamento);
                var medicoesp = await _context.MedicoEspecialidads
                    .Where(e => e.IdMedico == medico.IdMedico)
                    .ToListAsync();

                var veripaciente = await _context.Personas.FirstOrDefaultAsync(e=>e.IdPersona==usu.IdPersona) ;
                bool verificacion = false;
                if (veripaciente!=null)
                {
                    verificacion=true;
                }
                var resultado = new
                {
                    Persona = usu,
                    Medico = medico,
                    Especialidades = medicoesp,
                    FechaNacimiento = fecha,
                    Correo = correo,
                    Ciudad = ciudad,
                    Departamento = departamento,
                    veripaciente = verificacion
                };
                // 5. Devolver directamente el objeto sin serializar a mano
                return Ok(resultado);
            }
            catch (Exception ex)
            {
                // Esto te ayudará a ver en la pestaña 'Response' del navegador qué falló exactamente
                return BadRequest(new { error = "Error interno en el servidor", detalle = ex.Message });
            }
        }

        
        [HttpGet("mis-pacientes/{idmedico}")]
        public async Task<IActionResult> ObtenerMisPacientes(int idmedico)
        {

            try
            {
                var pacientesAsignados = await _context.PacienteMedicos
                 .Where(pm => pm.IdMedico == idmedico)
                 .Select(pm => new
                 {

                     idUsuario = pm.IdUsuario,
                     idPersona = pm.IdUsuarioNavigation.IdPersona,
                     nombre = pm.IdUsuarioNavigation.IdPersonaNavigation.Nombre,
                     paterno = pm.IdUsuarioNavigation.IdPersonaNavigation.Paterno,
                     materno = pm.IdUsuarioNavigation.IdPersonaNavigation.Materno,
                     tipoSangre = pm.IdUsuarioNavigation.IdTipoSangreNavigation.TipoDeSangre ?? "No especificado",
                     email = pm.IdUsuarioNavigation.IdPersonaNavigation.IdCorreoElectronicoNavigation.CorreoElectronico,
                     ciudad = pm.IdUsuarioNavigation.IdPersonaNavigation.IdCiudadNavigation,
                     departamento = pm.IdUsuarioNavigation.IdPersonaNavigation.IdCiudadNavigation.IdDepartamentoNavigation,


                     HistorialHemoglobinas = _context.NivelHemoglobinas
                         .Where(hist => hist.IdUsuario == pm.IdUsuario)
                         .Select(hist => new
                         {
                             // Datos del registro de hemoglobina
                             idNivelHemoglobina = hist.IdNivel,
                             valor = hist.ValorHemoglobina,
                             fecha = hist.FechaAnalisis,

                             // Datos del Rango asociados a este registro de hemoglobina
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

                if (!pacientesAsignados.Any())
                {
                    return Ok(new List<object>());
                }

                return Ok(pacientesAsignados);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al procesar la solicitud.", detalle = ex.Message });
            }
        }

        // 2. AÑADIR UN PACIENTE EXISTENTE A SU RELACIÓN
        // POST: api/Medico/añadir-paciente/{idUsuario}
        [HttpPost("añadir-paciente/{idUsuario}")]
        public async Task<IActionResult> AñadirPacienteRelacion(int idUsuario)
        {
            var idMedico = ObtenerIdMedicoAutenticado();
            if (idMedico == 0) return Unauthorized(new { mensaje = "No se pudo identificar al médico desde la sesión actual." });

            try
            {
                // Verificar si el usuario (paciente) realmente existe en la BD
                var existePaciente = await _context.Usuarios.AnyAsync(u => u.IdUsuario == idUsuario);
                if (!existePaciente)
                {
                    return NotFound(new { mensaje = "El paciente con el ID proporcionado no existe en el sistema." });
                }

                // Verificar si ya existe la relación previa para evitar duplicados
                var yaAsociado = await _context.PacienteMedicos
                    .AnyAsync(pm => pm.IdMedico == idMedico && pm.IdUsuario == idUsuario);

                if (yaAsociado)
                {
                    return BadRequest(new { mensaje = "Este paciente ya se encuentra asignado a tu lista." });
                }

                // Crear el nuevo registro en la tabla intermedia
                var nuevaRelacion = new PacienteMedico
                {
                    IdMedico = idMedico,
                    IdUsuario = idUsuario
                };

                _context.PacienteMedicos.Add(nuevaRelacion);
                await _context.SaveChangesAsync();

                return Ok(new { mensaje = "Paciente añadido exitosamente a tu relación médica." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al intentar asociar el paciente.", detalle = ex.Message });
            }
        }

        // 3. BORRAR UN PACIENTE DE SU RELACIÓN
        // DELETE: api/Medico/borrar-paciente/{idUsuario}
        [HttpDelete("borrar-paciente/{idUsuario}")]
        public async Task<IActionResult> BorrarPacienteRelacion(int idUsuario)
        {
            var idMedico = ObtenerIdMedicoAutenticado();
            if (idMedico == 0) return Unauthorized(new { mensaje = "No se pudo identificar al médico desde la sesión actual." });

            try
            {
                // Buscar la relación exacta en la tabla intermedia
                var relacion = await _context.PacienteMedicos
                    .FirstOrDefaultAsync(pm => pm.IdMedico == idMedico && pm.IdUsuario == idUsuario);

                if (relacion == null)
                {
                    return NotFound(new { mensaje = "No existe una relación registrada entre tú y este paciente." });
                }

                // Remover únicamente el vínculo sin borrar al usuario de la BD
                _context.PacienteMedicos.Remove(relacion);
                await _context.SaveChangesAsync();

                return Ok(new { mensaje = "Paciente eliminado correctamente de tu relación médica." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error al intentar eliminar la relación.", detalle = ex.Message });
            }
        }
        //4. Pacientes
        [HttpGet("pacientes/{idusuario}")]
        public async Task<IActionResult> Pacientes(int idusuario)
        {
            // Combinamos ambas tablas directamente en la base de datos
            var pacientes = await (from u in _context.Usuarios
                                   join p in _context.Personas on u.IdPersona equals p.IdPersona
                                   join t in _context.TipoSangres on u.IdTipoSangre equals t.IdTipoSangre
                                   join c in _context.Ciudads on p.IdCiudad equals c.IdCiudad
                                   join x in _context.Departamentos on c.IdDepartamento equals x.IdDepartamento

                                   where !_context.PacienteMedicos.Any(pm => pm.IdUsuario == u.IdUsuario && pm.IdMedico == idusuario)
                                   select new
                                   {
                                       IdPaciente = u.IdUsuario,
                                       idUsuario = p.IdPersona,
                                       Nombre = p.Nombre,
                                       Paterno = p.Paterno,
                                       Materno=p.Materno,
                                       idTipoSangre=t.IdTipoSangre,
                                       TipoSangre = t.TipoDeSangre,
                                       Ciudad = c, 
                                       Departamento = x,
                                   })
                                   .ToListAsync();
            return Ok(pacientes);
        }

        [HttpPut("editarmedico/{id}")]
        public async Task<IActionResult> EditarPerfil(int id, [FromBody] EditPerfilDto model)
        {
            // 1. Buscamos el médico por su IdMedico (el '5' de la URL)
            var perfilmedico = await _context.Medicos.FirstOrDefaultAsync(e => e.IdMedico == id);
            if (perfilmedico == null)
            {
                return NotFound(new { mensaje = "Médico no encontrado." });
            }

            // 2. Buscamos los datos de la Persona usando el IdPersona del médico (el '6')
            var persona = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == perfilmedico.IdPersona);
            var ciudad = await _context.Ciudads.FirstOrDefaultAsync(e => e.IdCiudad == model.IdCiudad);
            if (persona == null)
            {
                return NotFound(new { mensaje = "Datos de persona no encontrados." });
            }

            try
            {
                // 3. Actualizar datos básicos de la Persona
                persona.Nombre = model.Nombre;
                persona.Paterno = model.ApellidoPaterno;
                persona.Materno = model.ApellidoMaterno;
                persona.IdGenero = model.Genero; // El número 1 o 2 que viene del Radio Button
                persona.IdCiudad = ciudad.IdCiudad;
                // 4. Gestión de la Fecha de Nacimiento (Tabla: FechaNacimientos)
                var fecharegistro = await _context.FechaNacimientos
                    .FirstOrDefaultAsync(e => e.FechaDeNacimiento == model.FechaNacimiento);

                if (fecharegistro == null)
                {
                    var nuevafecha = new FechaNacimiento
                    {
                        FechaDeNacimiento = model.FechaNacimiento
                    };
                    _context.FechaNacimientos.Add(nuevafecha);
                    await _context.SaveChangesAsync(); // Guardamos para generar el Id
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

                // 6. LÓGICA DEL BOTÓN CELESTE (Si decide ser Paciente además de Médico)
                if (!string.IsNullOrEmpty(model.Tipo_Sangre))
                {
                    // Buscamos el ID del tipo de sangre seleccionado (ej: "O+", "A+")
                    var tipoSangre = await _context.TipoSangres
                        .FirstOrDefaultAsync(e => e.TipoDeSangre == model.Tipo_Sangre);

                    if (tipoSangre != null)
                    {
                        // Verificamos si esta persona ya existe en la tabla de Usuarios/Pacientes para no duplicarla
                        var pacienteExistente = await _context.Usuarios
                            .FirstOrDefaultAsync(u => u.IdPersona == persona.IdPersona);

                        if (pacienteExistente == null)
                        {
                            // Si es un rol nuevo, lo insertamos en la tabla Usuarios
                            var nuevopaciente = new Usuario
                            {
                                IdPersona = persona.IdPersona,
                                IdTipoSangre = tipoSangre.IdTipoSangre
                            };
                            _context.Usuarios.Add(nuevopaciente);
                        }
                        else
                        {
                            // Si ya tenía el rol de paciente, solo le actualizamos su tipo de sangre
                            pacienteExistente.IdTipoSangre = tipoSangre.IdTipoSangre;
                            _context.Entry(pacienteExistente).State = EntityState.Modified;
                        }
                    }
                }

                // 7. Guardamos la entidad principal Persona modificada
                _context.Entry(persona).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Ok(new { mensaje = "Tu perfil ha sido actualizado con éxito." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error interno al guardar los cambios.", detalle = ex.Message });
            }
        }

        private int ObtenerIdMedicoAutenticado()
        {
            var claim = User.Claims.FirstOrDefault(c => c.Type == "IdEntidadRol");

            if (claim == null || string.IsNullOrEmpty(claim.Value) || !int.TryParse(claim.Value, out int idMedico))
            {
                return 0;
            }
            return idMedico;
        }
    }

}
