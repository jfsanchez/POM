# Password & OTP Manager (POM)

Carga de copias de seguridad de Proton Pass (**Local Password Manager**) y Proton Authenticator (**Local OTP Manager**) cifradas o descifradas. Hace uso de HTML, JS y CSS no requiriendo librerías por CDN ni ningún backend.

Proton Pass/Authenticator son propiedad de Proton AG con quien no tengo relación.

Experimento hecho con IA, es un simple visualizador útil para ver las claves sin tener que importarlas. LLM usados: Big Pickle gratuito y GLM-5.2 de pago usado mediante OpenCode.

A pesar que debería ser seguro, recomiendo ejecutarlo en local, en tu ordenador y sin conexión a internet puesto que es el fruto de vibe coding. **No ha sido revisado** en busca de errores de seguridad, CDN externos, ataques a la cadena de suministro de las librerías, etc. Úsalo bajo tu propia responsabilidad.

Este programa es software libre: puede redistribuirlo y/o modificarlo bajo los términos de la **GNU General Public License v3**.

Como ejecutarlo en tu equipo:

1. Baja el repo con git clone
2. Ve al directorio y ejecuta: python3 -m http.server 8080
3. Ve a http://localhost:8080

