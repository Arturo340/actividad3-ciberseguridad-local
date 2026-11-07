$ErrorActionPreference = 'Stop'
$env:AWS_ACCESS_KEY_ID = 'test'
$env:AWS_SECRET_ACCESS_KEY = 'test'
$env:AWS_DEFAULT_REGION = 'us-east-1'
$env:AWS_EC2_METADATA_DISABLED = 'true'
$env:AWS_PAGER = ''
Remove-Item Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
function Local-Aws {
    & aws --endpoint-url http://localhost:4566 --region us-east-1 @args
    if ($LASTEXITCODE -ne 0) { throw 'Falló una consulta local. Revisa el mensaje.' }
}
Local-Aws s3api list-buckets
Local-Aws s3api get-bucket-encryption --bucket actividad3-seguro-local
Local-Aws s3api get-public-access-block --bucket actividad3-seguro-local
Set-Content -Path prueba.txt -Value 'Archivo de prueba sin datos personales.' -Encoding utf8
Local-Aws s3 cp prueba.txt s3://actividad3-seguro-local/prueba.txt
Local-Aws s3 ls s3://actividad3-seguro-local/
Local-Aws s3api head-object --bucket actividad3-seguro-local --key prueba.txt
# Estas dos operaciones pueden fallar: conservar el resultado real.
& aws --endpoint-url http://localhost:4566 --region us-east-1 --no-sign-request s3api get-object --bucket actividad3-seguro-local --key prueba.txt anonimo.txt
$anonExit = $LASTEXITCODE
Write-Output "Código de salida del acceso anónimo: $anonExit"
& aws --endpoint-url http://localhost:4566 --region us-east-1 s3api get-bucket-policy-status --bucket actividad3-seguro-local
Write-Output "Código de salida de consulta de política: $LASTEXITCODE"
