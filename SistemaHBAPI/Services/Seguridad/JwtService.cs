using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SistemaHBAPI.Configuracion;
using SistemaHBAPI.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SistemaHBAPI.Services.Seguridad
{
    public interface IJwtService
    {
        string GenerarToken(Persona persona, string email, string rol, string idEntidadRol);
    }

    public sealed class JwtService : IJwtService
    {
        private readonly JwtOptions _opciones;

        public JwtService(IOptions<JwtOptions> opciones)
        {
            _opciones = opciones.Value;
        }

        public string GenerarToken(Persona persona, string email, string rol, string idEntidadRol)
        {
            var claims = new ClaimsIdentity();
            claims.AddClaim(new Claim(ClaimTypes.NameIdentifier, persona.IdPersona.ToString()));
            claims.AddClaim(new Claim(ClaimTypes.Email, email));
            claims.AddClaim(new Claim(ClaimTypes.Role, rol));
            claims.AddClaim(new Claim("IdEntidadRol", idEntidadRol));

            var descriptor = new SecurityTokenDescriptor
            {
                Subject = claims,
                Expires = DateTime.UtcNow.AddHours(_opciones.HorasExpiracion),
                Issuer = _opciones.Issuer,
                Audience = _opciones.Audience,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opciones.Key)),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var handler = new JwtSecurityTokenHandler();
            return handler.WriteToken(handler.CreateToken(descriptor));
        }
    }
}
