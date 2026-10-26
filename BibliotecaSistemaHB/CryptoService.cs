using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

public class CryptoService
{
    // Claves fijas internas de forma segura (AES-256)
    private static readonly byte[] Key = Encoding.UTF8.GetBytes("S1st3m4HB_C0ntr0l_H3m0gl0b1n4_26"); // 32 bytes exactos
    private static readonly byte[] Iv = new byte[] { 0x45, 0x01, 0x12, 0x7c, 0x34, 0x09, 0xba, 0x99, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88 };

    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return string.Empty;

        using var aes = Aes.Create();
        aes.Key = Key;
        aes.IV = Iv;

        using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
        using var ms = new MemoryStream();
        using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
        {
            using (var sw = new StreamWriter(cs))
            {
                sw.Write(plainText);
            }
        }

        byte[] encryptedBytes = ms.ToArray();
        // Base64 adaptada para URLs (elimina +, / y =)
        return Convert.ToBase64String(encryptedBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }

    public string Decrypt(string cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return string.Empty;

        // Reconstruye el formato Base64 estándar
        string base64 = cipherText.Replace("-", "+").Replace("_", "/");
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }

        byte[] cipherBytes = Convert.FromBase64String(base64);

        using var aes = Aes.Create();
        aes.Key = Key;
        aes.IV = Iv;

        using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
        using var ms = new MemoryStream(cipherBytes);
        using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
        using var sr = new StreamReader(cs);

        return sr.ReadToEnd();
    }
}
