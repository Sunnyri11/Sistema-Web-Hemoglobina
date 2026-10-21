using BibliotecaSistemaHB; // ¡CORREGIDO!: Se cambió por el nombre real de tu biblioteca de clases
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SistemaHBAPI;
using SistemaHBAPI.Models;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AutenticacionController : ControllerBase
    {
        private readonly SistemaHBContext _context;

        public AutenticacionController(SistemaHBContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LOGINFORMCLS model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            // Validación preventiva del objeto recibido
            if (model == null || string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password) || string.IsNullOrWhiteSpace(model.Rol))
            {
                return BadRequest(new { mensaje = "El correo, la contraseña y el rol son obligatorios." });
            }

            try
            {
                // 1. Buscar el correo en la base de datos de manera segura controlando valores nulos en las columnas
                var correoReg = await _context.CorreosElectronicos
                    .Include(c => c.Personas)
                        .ThenInclude(p => p.Usuarios)
                    .Include(c => c.Personas)
                        .ThenInclude(p => p.Medicos)
                    .Include(c => c.Personas)
                        .ThenInclude(p => p.Administradors)
                    .FirstOrDefaultAsync(c => c.CorreoElectronico != null && c.CorreoElectronico.ToLower() == model.Email.Trim().ToLower());

                if (correoReg == null)
                {
                    return Unauthorized(new { mensaje = "El correo electrónico no se encuentra registrado." });
                }

                // 2. Extraer la persona vinculada al correo
                var persona = correoReg.Personas.FirstOrDefault();
                if (persona == null)
                {
                    return Unauthorized(new { mensaje = "No existe un perfil de persona asociado a este correo." });
                }

                // 3. VALIDACIÓN DE CONTRASEÑA E IDENTIDAD DE ROL
                if (correoReg.Contraseña != model.Password)
                {
                    return Unauthorized(new { mensaje = "Contraseña incorrecta." });
                }

                bool tieneRolValido = false;
                string idEntidadRol = "0";
                string rolNormalizado = model.Rol.Trim().ToLower();

                switch (rolNormalizado)
                {
                    case "paciente":
                        var usuario = persona.Usuarios.FirstOrDefault();
                        if (usuario != null)
                        {
                            tieneRolValido = true;
                            idEntidadRol = usuario.IdUsuario.ToString();
                        }
                        break;
                    case "medico":
                        var medico = persona.Medicos.FirstOrDefault();
                        if (medico != null)
                        {
                            tieneRolValido = true;
                            idEntidadRol = medico.IdMedico.ToString();
                        }
                        break;
                    case "administrador":
                        var admin = persona.Administradors.FirstOrDefault();
                        if (admin != null)
                        {
                            tieneRolValido = true;
                            idEntidadRol = admin.IdAdministrador.ToString();
                        }
                        break;
                }

                if (!tieneRolValido)
                {
                    return Unauthorized(new { mensaje = $"El usuario no tiene asignado el rol de {model.Rol}." });
                }

                var secretKey = "TuClaveSecretaSuperSeguraDeAlMenos32Bytes!"; 
                var keyBytes = Encoding.UTF8.GetBytes(secretKey);

                var claims = new ClaimsIdentity();
                claims.AddClaim(new Claim(ClaimTypes.NameIdentifier, persona.IdPersona.ToString()));
                claims.AddClaim(new Claim(ClaimTypes.Email, model.Email.Trim()));
                claims.AddClaim(new Claim(ClaimTypes.Role, model.Rol.Trim()));
                claims.AddClaim(new Claim("IdEntidadRol", idEntidadRol)); 

                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = claims,
                    Expires = DateTime.UtcNow.AddHours(4), 
                    Issuer = "https://onrender.com",       
                    Audience = "SistemaHBAutenticacionApi",
                    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256Signature)
                };

                var tokenHandler = new JwtSecurityTokenHandler();
                var tokenConfig = tokenHandler.CreateToken(tokenDescriptor);
                var tokenCreado = tokenHandler.WriteToken(tokenConfig);

                // 5. Devolver respuesta exitosa estructurada en camelCase para consistencia frontend
                return Ok(new
                {
                    token = tokenCreado,
                    nombre = persona.Nombre ?? "Usuario",
                    rol = model.Rol.Trim(),
                    idEntidad = idEntidadRol
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    mensaje = "Error interno del servidor al procesar la autenticación.",
                    detalle = ex.Message
                });
            }
        }
    }
}
