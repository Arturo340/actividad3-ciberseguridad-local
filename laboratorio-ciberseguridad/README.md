# Laboratorio de ciberseguridad

## Descripción

Esta práctica crea un bucket S3 simulado con Terraform y LocalStack. También compara imágenes con Trivy y prueba una API protegida con JWT mediante pruebas automáticas, consultas manuales y OWASP ZAP.

Todo se ejecuta localmente con datos de prueba. No se necesita una cuenta AWS.

## Requisitos

- Windows con Docker Desktop funcionando y contenedores Linux.
- Docker Compose.
- Terraform.
- AWS CLI v2.
- Trivy.
- Git.
- Cuenta personal de LocalStack con plan Hobby gratuito.

## Archivos principales

| Archivo | Función |
|---|---|
| compose-s3.yaml | Iniciar LocalStack |
| compose.yaml | Configurar LocalStack, API y ZAP |
| providers.tf | Conectar Terraform con el entorno local |
| main.tf | Declarar bucket, cifrado y bloqueo público |
| verificar-s3.ps1 | Consultar y probar S3 |
| api/Dockerfile | Construir la API con Node 24 |
| api/server.js | Implementar autenticación JWT y permisos |
| api/server.test.js | Probar autenticación y autorización |
| api/openapi.json | Describir los endpoints para ZAP |

## 1. Preparar la terminal

Abre PowerShell dentro de la carpeta que contiene los archivos Terraform y Compose.

Si clonaste el repositorio y los archivos están en una subcarpeta, entra primero:

```powershell
cd laboratorio-ciberseguridad
```

Comprueba las herramientas:

```powershell
docker --version
docker compose version
terraform version
aws --version
trivy --version
git --version
docker ps
```

## 2. Iniciar LocalStack

Obtén tu token desde el portal de LocalStack. Introdúcelo sin mostrarlo:

```powershell
$tokenLocal = Read-Host 'Token de LocalStack' -AsSecureString
$env:LOCALSTACK_AUTH_TOKEN = [System.Net.NetworkCredential]::new('', $tokenLocal).Password
Remove-Variable tokenLocal
```

Inicia el contenedor:

```powershell
docker compose -f compose-s3.yaml up -d localstack
```

Comprueba su estado:

```powershell
docker compose -f compose-s3.yaml ps
```

Consulta la salud:

```powershell
Invoke-RestMethod http://localhost:4566/_localstack/health | ConvertTo-Json -Depth 10
```

El contenedor debe aparecer saludable y S3 debe estar disponible o en ejecución. El puerto se publica solamente en 127.0.0.1.

## 3. Crear los recursos con Terraform

Ejecuta los comandos por separado:

```powershell
terraform init
terraform fmt
terraform validate
terraform plan "-out=local.tfplan"
```

En una primera ejecución se esperan tres recursos nuevos:

- Bucket actividad3-seguro-local.
- Configuración de cifrado SSE-S3 AES256.
- Configuración con cuatro bloqueos de acceso público.

Revisa y aplica el plan:

```powershell
terraform show "local.tfplan"
terraform apply "local.tfplan"
terraform state list
```

Una ejecución posterior sin modificaciones puede mostrar cero cambios.

## 4. Consultar S3

Configura credenciales ficticias en esta sesión:

```powershell
$env:AWS_ACCESS_KEY_ID = 'test'
$env:AWS_SECRET_ACCESS_KEY = 'test'
$env:AWS_DEFAULT_REGION = 'us-east-1'
$env:AWS_EC2_METADATA_DISABLED = 'true'
$env:AWS_PAGER = ''
Remove-Item Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
```

Consulta el bucket y sus controles:

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 s3api list-buckets
```

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 s3api get-bucket-encryption --bucket actividad3-seguro-local
```

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 s3api get-public-access-block --bucket actividad3-seguro-local
```

Se debe comprobar AES256 y estos cuatro valores en true:

- BlockPublicAcls.
- IgnorePublicAcls.
- BlockPublicPolicy.
- RestrictPublicBuckets.

## 5. Subir un archivo y probar acceso anónimo

Crea un archivo sin información personal:

```powershell
Set-Content -Path prueba.txt -Value 'Archivo de prueba sin datos personales.' -Encoding utf8
```

Súbelo y consulta el listado:

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 s3 cp prueba.txt s3://actividad3-seguro-local/prueba.txt
```

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 s3 ls s3://actividad3-seguro-local/
```

Intenta descargarlo sin firma:

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 --no-sign-request s3api get-object --bucket actividad3-seguro-local --key prueba.txt anonimo.txt
```

Consulta inmediatamente el código de salida:

```powershell
$LASTEXITCODE
```

Consulta el estado de la política:

```powershell
aws --endpoint-url http://localhost:4566 --region us-east-1 s3api get-bucket-policy-status --bucket actividad3-seguro-local
```

### Resultado observado

En esta práctica, LocalStack permitió descargar el archivo sin firma y devolvió código 0, aunque informó los cuatro bloqueos activados. Se registra como comportamiento del simulador, sin afirmar que AWS real actuaría igual.

La consulta de política devolvió NoSuchBucketPolicy. Esto significa que no existe una política de bucket; por sí solo no confirma exposición pública.

## 6. Revisar el Dashboard

Desde la misma computadora donde corre Docker:

1. Entra en https://app.localstack.cloud.
2. Selecciona la instancia con endpoint http://localhost:4566.
3. Abre Resource Browser.
4. Selecciona us-east-1.
5. Entra en S3 y abre actividad3-seguro-local.
6. Comprueba que aparece prueba.txt.

Si Chrome bloquea la conexión, revisa los permisos de Red local y Aplicaciones en el dispositivo únicamente para el portal de LocalStack.

## 7. Analizar imágenes con Trivy

Descarga las imágenes:

```powershell
docker pull node:14
docker pull node:18
docker pull node:24-bookworm-slim
```

Genera los reportes:

```powershell
trivy image --format json --output ./evidencias/trivy-node14.json node:14
```

```powershell
trivy image --format json --output ./evidencias/trivy-node18.json node:18
```

```powershell
trivy image --format json --output ./evidencias/trivy-node24.json node:24-bookworm-slim
```

### Resultados obtenidos

| Gravedad | Node 14 | Node 18 | Node 24 bookworm-slim |
|---|---:|---:|---:|
| Crítica | 23 | 228 | 1 |
| Alta | 572 | 2294 | 39 |
| Media | 735 | 6792 | 111 |
| Baja | 122 | 2670 | 83 |
| Sin clasificar | 4 | 102 | 0 |
| Total | 1456 | 12086 | 234 |

Estos valores son hallazgos reportados, no necesariamente CVE únicas. Pueden cambiar con la imagen y la base de vulnerabilidades.

Node 18 presentó más hallazgos que Node 14. La imagen Node 24 bookworm-slim mostró menos, pero también contiene un sistema base y paquetes diferentes. No se atribuye la diferencia solamente a la versión de Node.

Node 14 y Node 18 se conservan para la comparación académica. La API utiliza el Dockerfile principal con Node 24. Todavía existen hallazgos pendientes; no se considera una imagen libre de vulnerabilidades.

## 8. Construir y probar la API

Construye la imagen:

```powershell
docker build --pull -t actividad3-api:local ./api
```

Ejecuta las pruebas automáticas:

```powershell
docker run --rm --entrypoint sh -v "${PWD}/api/server.test.js:/app/server.test.js:ro" actividad3-api:local -c 'node --test server.test.js'
```

En la ejecución realizada pasaron ocho pruebas y no hubo fallos.

## 9. Configurar e iniciar la API

Genera el secreto JWT:

```powershell
$bytesJwt = New-Object byte[] 48
$rngJwt = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rngJwt.GetBytes($bytesJwt)
$env:JWT_SECRET = [Convert]::ToBase64String($bytesJwt)
$rngJwt.Dispose()
```

Introduce dos contraseñas de prueba diferentes:

```powershell
$adminLocal = Read-Host 'Contraseña de prueba admin' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminLocal).Password
```

```powershell
$userLocal = Read-Host 'Contraseña de prueba alumno' -AsSecureString
$env:USER_PASSWORD = [System.Net.NetworkCredential]::new('', $userLocal).Password
```

Elimina las variables auxiliares:

```powershell
Remove-Variable bytesJwt,adminLocal,userLocal -ErrorAction SilentlyContinue
```

Mantén el token de LocalStack definido en la misma terminal, porque Compose interpreta también ese servicio.

Valida e inicia:

```powershell
docker compose config --quiet
docker compose up -d --build --no-deps api
```

Comprueba la respuesta:

```powershell
curl.exe -i http://localhost:3000/health
```

Se espera 200 OK y un estado ok.

Las cuentas son simuladas. Este ejemplo no implementa un sistema de usuarios de producción.

## 10. Probar autenticación y permisos

Sin token:

```powershell
curl.exe -i http://localhost:3000/api/admin
```

Con token alterado:

```powershell
curl.exe -i -H "Authorization: Bearer alterado" http://localhost:3000/api/admin
```

Login del alumno:

```powershell
$loginAlumno = @{ username='alumno'; password=$env:USER_PASSWORD } | ConvertTo-Json
```

```powershell
$tokenAlumno = (Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/login -ContentType 'application/json' -Body $loginAlumno).token
```

```powershell
curl.exe -i -H "Authorization: Bearer $tokenAlumno" http://localhost:3000/api/admin
```

Login del administrador:

```powershell
$loginAdmin = @{ username='admin'; password=$env:ADMIN_PASSWORD } | ConvertTo-Json
```

```powershell
$tokenAdmin = (Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/login -ContentType 'application/json' -Body $loginAdmin).token
```

```powershell
curl.exe -i -H "Authorization: Bearer $tokenAdmin" http://localhost:3000/api/admin
```

### Resultados comprobados

| Prueba | Respuesta |
|---|---|
| Sin token | 401 |
| Token alterado | 401 |
| Alumno | 403 |
| Administrador | 200 |

Los tokens duran 15 minutos. Si vencen, repite el login.

## 11. Escanear con OWASP ZAP

Mantén la API encendida. Escanea únicamente este laboratorio.

Obtén la red del contenedor:

```powershell
$redApi = docker inspect --format '{{range $nombre, $config := .NetworkSettings.Networks}}{{$nombre}}{{end}}' laboratorio-ciberseguridad-api-1
```

El nombre del contenedor puede variar según la carpeta del proyecto. Si fuera diferente, identifícalo con docker ps y ajusta el comando.

### Sin token

```powershell
Remove-Item Env:ZAP_AUTH_HEADER,Env:ZAP_AUTH_HEADER_VALUE -ErrorAction SilentlyContinue
```

```powershell
docker run --rm --network "$redApi" -v "${PWD}/evidencias:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://api:3000/openapi.json -f openapi -r zap-sin-token.html
```

### Como alumno

Usa un token recién generado:

```powershell
$env:ZAP_AUTH_HEADER = 'Authorization'
$env:ZAP_AUTH_HEADER_VALUE = "Bearer $tokenAlumno"
```

```powershell
docker run --rm --network "$redApi" -e ZAP_AUTH_HEADER -e ZAP_AUTH_HEADER_VALUE -v "${PWD}/evidencias:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://api:3000/openapi.json -f openapi -r zap-alumno.html
```

### Como administrador

```powershell
$env:ZAP_AUTH_HEADER_VALUE = "Bearer $tokenAdmin"
```

```powershell
docker run --rm --network "$redApi" -e ZAP_AUTH_HEADER -e ZAP_AUTH_HEADER_VALUE -v "${PWD}/evidencias:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://api:3000/openapi.json -f openapi -r zap-admin.html
```

Al terminar:

```powershell
Remove-Item Env:ZAP_AUTH_HEADER,Env:ZAP_AUTH_HEADER_VALUE -ErrorAction SilentlyContinue
```

### Resultados observados

Los resúmenes mostraron 0 reglas en FAIL, 3 advertencias y 118 en PASS.

Las advertencias correspondieron a:

- Tipo de contenido inesperado en respuestas 404.
- Falta de X-Content-Type-Options.
- Falta o configuración inválida de Cross-Origin-Resource-Policy.

En el escaneo de administrador se observó una respuesta 200 en /api/admin.

Los resultados no garantizan ausencia de vulnerabilidades. Las pruebas manuales y automáticas complementan el escaneo de ZAP.

## Seguridad del repositorio

No publicar:

- Tokens de LocalStack.
- Secretos JWT.
- Contraseñas reales.
- Archivos .env.
- Estados y planes de Terraform.
- Reportes autenticados sin revisar.

Las referencias a variables y las credenciales ficticias test no contienen secretos reales.

La carpeta evidencias está excluida de Git. Conserva las capturas y los reportes por separado para la entrega. Los reportes de ZAP pueden contener tokens.

## Conclusión

Terraform expresa la infraestructura deseada. AWS CLI permite consultar lo que informa el servicio. Las pruebas muestran cómo se comporta en casos concretos.

En LocalStack se observaron diferencias entre los controles configurados y la descarga anónima. En la API se comprobó la validez del token y el rol del usuario. Trivy y ZAP permitieron identificar hallazgos que deben revisarse, sin asumir que un resultado favorable garantiza seguridad completa.

## Fuentes oficiales

- https://docs.localstack.cloud/
- https://docs.docker.com/
- https://developer.hashicorp.com/terraform
- https://docs.aws.amazon.com/cli/
- https://trivy.dev/
- https://nodejs.org/
- https://github.com/auth0/node-jsonwebtoken
- https://www.zaproxy.org/docs/docker/api-scan/