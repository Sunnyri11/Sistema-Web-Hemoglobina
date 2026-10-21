using BibliotecaSistemaHB; // Tu biblioteca de clases compartida
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using System;
using SistemaHBAPI;
using System.Threading.Tasks;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RegistroController : ControllerBase
    {
        private readonly SistemaHBContext _context;

        public RegistroController(SistemaHBContext context)
        {
            _context = context;
        }

        [HttpPost("usuario")]
        public async Task<IActionResult> RegistrarPaciente([FromBody] REGISTROFORMCLS model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (model == null)
            {
                return BadRequest(new { mensaje = "Los datos del formulario están vacíos." });
            }

            // 1. Validar si el correo electrónico ya existe en la base de datos de manera segura
            var correoExiste = await _context.CorreosElectronicos
                .AnyAsync(c => c.CorreoElectronico.ToLower() == model.Correo.ToLower());

            if (correoExiste)
            {
                return BadRequest(new { mensaje = "El correo electrónico ya se encuentra registrado por otro usuario." });
            }

            var strategy = _context.Database.CreateExecutionStrategy();

            try
            {
                // ¡CORREGIDO AQUÍ!: Añadido <IActionResult> para que C# entienda el valor de retorno
                return await strategy.ExecuteAsync<IActionResult>(async () =>
                {
                    using var transaction = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        // 2. BUSCAR O INSERTAR LA FECHA DE NACIMIENTO
                        var fechaReg = await _context.FechaNacimientos
                            .FirstOrDefaultAsync(f => f.FechaDeNacimiento == model.FechaNacimiento);

                        if (fechaReg == null)
                        {
                            fechaReg = new FechaNacimiento
                            {
                                // Al ser ambos del tipo 'DateOnly', se asignan directamente de forma limpia
                                FechaDeNacimiento = model.FechaNacimiento
                            };
                            _context.FechaNacimientos.Add(fechaReg);
                            await _context.SaveChangesAsync();
                        }


                        // 3. BUSCAR O INSERTAR EL CORREO ELECTRÓNICO
                        var nuevoCorreo = new CorreosElectronico
                        {
                            CorreoElectronico = model.Correo,
                            Contraseña = model.Password
                        };
                        _context.CorreosElectronicos.Add(nuevoCorreo);
                        await _context.SaveChangesAsync();

                        // 4. VALIDAR EL GÉNERO DE MANERA SEGURA
                        int idGeneroFinal = 1;
                        if (!string.IsNullOrEmpty(model.Genero))
                        {
                            var generoReg = await _context.Generos
                                .FirstOrDefaultAsync(g => g.Nombre.ToLower() == model.Genero.ToLower());
                            if (generoReg != null)
                            {
                                idGeneroFinal = generoReg.IdGenero;
                            }
                        }


                        // 5. REGISTRAR LA PERSONA
                        var nuevaPersona = new Persona
                        {
                            Nombre = model.Nombre?.Trim() ?? "S/N",
                            Paterno=model.ApellidoPaterno?? "S/N",
                            Materno = model.ApellidoMaterno ?? "S/N",
                            IdFechaNacimiento = fechaReg.IdFechaNacimiento,
                            IdCorreoElectronico = nuevoCorreo.IdCorreoElectronico,
                            IdGenero = idGeneroFinal,
                            IdCiudad = model.idDepartamento
                        };
                        _context.Personas.Add(nuevaPersona);
                        await _context.SaveChangesAsync();

                        // 6. REGISTRAR EL ROL
                        string rolNormalizado = model.Rol?.Trim() ?? "";
                        if (rolNormalizado.Equals("Paciente", StringComparison.OrdinalIgnoreCase))
                        {
                            int? idTipoSangreFinal = null;

                            if (!string.IsNullOrEmpty(model.Tipo_Sangre))
                            {

                                var tipo_sangre = await _context.TipoSangres
                                    .FirstOrDefaultAsync(c => c.TipoDeSangre.ToLower() == model.Tipo_Sangre.ToLower());

                                if (tipo_sangre != null)
                                {
                                    idTipoSangreFinal = tipo_sangre.IdTipoSangre;
                                }
                            }

                            var nuevoUsuario = new Usuario
                            {
                                IdPersona = nuevaPersona.IdPersona,
                                IdTipoSangre = idTipoSangreFinal
                            };

                            _context.Usuarios.Add(nuevoUsuario);
                            await _context.SaveChangesAsync();
                        }

                        else if (rolNormalizado.Equals("Medico", StringComparison.OrdinalIgnoreCase))
                        {
                            var especialidadReg = await _context.Especialidades
                                .FirstOrDefaultAsync(c => c.IdEspecialidad == model.idEspecialidad);

                            if (especialidadReg == null)
                            {
                                return BadRequest(new { mensaje = $"La especialidad con ID {model.idEspecialidad} no existe en el sistema." });
                            }

                            var nuevoMedico = new Medico
                            {
                                IdPersona = nuevaPersona.IdPersona
                            };
                            _context.Medicos.Add(nuevoMedico);
                            await _context.SaveChangesAsync();

                            var nuevoMedico_Especialidad = new MedicoEspecialidad
                            {
                                IdMedico = nuevoMedico.IdMedico,
                                IdEspecialidad = especialidadReg.IdEspecialidad
                            };

                            _context.MedicoEspecialidads.Add(nuevoMedico_Especialidad);
                            await _context.SaveChangesAsync();
                        }
                        else
                        {
                            return BadRequest(new { mensaje = "El rol especificado debe ser 'Paciente' o 'Medico'." });
                        }

                        // 7. MANEJO OPCIONAL DE CIUDAD / ALTITUD
                        if (!string.IsNullOrEmpty(model.Provincia))
                        {
                            var ciudadExiste = await _context.Ciudads
                                .FirstOrDefaultAsync(c => c.Nombre.ToLower() == model.Provincia.ToLower());

                            if (ciudadExiste == null)
                            {
                                int deptoId = model.idDepartamento > 0 ? model.idDepartamento : 1;
                                var deptoExiste = await _context.Departamentos.AnyAsync(d => d.IdDepartamento == deptoId);

                                var nuevaCiudad = new Ciudad
                                {
                                    Nombre = model.Provincia.Trim(),
                                    Altitud = model.Altitud,
                                    IdDepartamento = deptoExiste ? deptoId : 1
                                };
                                _context.Ciudads.Add(nuevaCiudad);
                                await _context.SaveChangesAsync();
                            }
                        }


                        await transaction.CommitAsync();
                        return Ok(new { mensaje = "¡Registro completado exitosamente en el sistema!" });
                    }
                    catch (Exception)
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                });
            }
            catch (Exception ex)
            {
                var detalleInterno = ex.InnerException != null ? ex.InnerException.Message : "Ninguno";
                return StatusCode(500, new
                {
                    mensaje = "Error interno al procesar el registro.",
                    error = ex.Message,
                    detalle = detalleInterno
                });
            }
        }
    }
}
