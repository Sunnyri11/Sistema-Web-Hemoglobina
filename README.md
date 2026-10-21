# Backend — Sistema Web de Hemoglobina

## Descripción
Este módulo debe contener la API que utiliza el frontend para autenticación y operaciones del sistema.

## Integración identificada
El frontend realiza una solicitud `POST` a:

`/api/autenticacion/login`

La solicitud de inicio de sesión envía un JSON con los campos `email`, `password` y `rol`. Cuando la autenticación es exitosa, el frontend espera datos como `nombre`, `token`, `rol` e `idEntidad`.

## Tecnologías
Confirma el lenguaje, framework y versión revisando los archivos de solución y proyecto de esta rama. No se deben dar por confirmadas tecnologías que no se hayan verificado.

## Configuración y ejecución
1. Instala el SDK o runtime requerido por el proyecto.
2. Configura la cadena de conexión y las variables de entorno necesarias.
3. Comprueba que el servidor esté escuchando en la dirección y puerto configurados.
4. Ejecuta la aplicación usando las instrucciones específicas del proyecto.
5. Prueba la ruta de autenticación con datos de prueba.

## Seguridad
- No guardes contraseñas en texto plano.
- No subas claves, tokens ni cadenas de conexión privadas.
- Valida entradas y roles en el servidor.
- Usa HTTPS en entornos desplegados.
- Documenta los endpoints, sus métodos HTTP, los parámetros y las respuestas.


