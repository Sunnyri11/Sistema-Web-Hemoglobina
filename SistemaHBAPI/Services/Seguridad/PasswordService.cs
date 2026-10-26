using System.Security.Cryptography;
using System.Text;

namespace SistemaHBAPI.Services.Seguridad
{
    public interface IPasswordService
    {
        /// <summary>Convierte una contraseña en hash con sal (nunca se guarda el texto plano).</summary>
        string Hash(string password);

        /// <summary>
        /// Comprueba una contraseña contra lo guardado en la BD. Acepta hashes y, mientras dure la
        /// migración, contraseñas antiguas en texto plano.
        /// </summary>
        bool Verificar(string password, string? almacenada);

        /// <summary>True si el valor guardado es un hash de este servicio.</summary>
        bool EsHash(string? valor);

        /// <summary>True si lo guardado es texto plano o un hash con menos iteraciones que las actuales.</summary>
        bool NecesitaActualizarse(string? almacenada);
    }

    /// <summary>
    /// PBKDF2-HMAC-SHA256 con sal aleatoria de 16 bytes. Formato guardado:
    /// PBKDF2$iteraciones$salBase64$hashBase64 (la columna "contraseña" es TEXT, sobra espacio).
    /// Las iteraciones viajan dentro del hash, así que se pueden subir más adelante sin romper los antiguos.
    /// </summary>
    public sealed class PasswordService : IPasswordService
    {
        private const string Prefijo = "PBKDF2";
        private const int Iteraciones = 210_000;
        private const int BytesSal = 16;
        private const int BytesHash = 32;

        public string Hash(string password)
        {
            var sal = RandomNumberGenerator.GetBytes(BytesSal);
            var hash = Rfc2898DeriveBytes.Pbkdf2(password, sal, Iteraciones, HashAlgorithmName.SHA256, BytesHash);
            return $"{Prefijo}${Iteraciones}${Convert.ToBase64String(sal)}${Convert.ToBase64String(hash)}";
        }

        public bool Verificar(string password, string? almacenada)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(almacenada)) return false;

            if (!TryLeer(almacenada, out var iteraciones, out var sal, out var hashEsperado))
            {
                // Contraseña antigua en texto plano (aún no migrada).
                return IgualesEnTiempoConstante(Encoding.UTF8.GetBytes(password), Encoding.UTF8.GetBytes(almacenada));
            }

            var calculado = Rfc2898DeriveBytes.Pbkdf2(password, sal, iteraciones, HashAlgorithmName.SHA256, hashEsperado.Length);
            return CryptographicOperations.FixedTimeEquals(calculado, hashEsperado);
        }

        public bool EsHash(string? valor) => TryLeer(valor, out _, out _, out _);

        public bool NecesitaActualizarse(string? almacenada) =>
            !TryLeer(almacenada, out var iteraciones, out _, out _) || iteraciones < Iteraciones;

        private static bool IgualesEnTiempoConstante(byte[] a, byte[] b) =>
            a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);

        private static bool TryLeer(string? valor, out int iteraciones, out byte[] sal, out byte[] hash)
        {
            iteraciones = 0;
            sal = Array.Empty<byte>();
            hash = Array.Empty<byte>();

            if (string.IsNullOrEmpty(valor) || !valor.StartsWith(Prefijo + "$", StringComparison.Ordinal)) return false;

            var partes = valor.Split('$');
            if (partes.Length != 4 || !int.TryParse(partes[1], out iteraciones) || iteraciones <= 0) return false;

            try
            {
                sal = Convert.FromBase64String(partes[2]);
                hash = Convert.FromBase64String(partes[3]);
            }
            catch (FormatException)
            {
                return false;
            }
            return sal.Length > 0 && hash.Length > 0;
        }
    }
}
