$ErrorActionPreference = 'Stop'
# Ejecutar desde la carpeta principal del laboratorio existente.
if (!(Test-Path ./api/Dockerfile)) { throw 'Entra en la carpeta que contiene api/Dockerfile.' }
New-Item -ItemType Directory -Force ./evidencias | Out-Null
& docker build --pull --no-cache -t actividad3-api:actualizada ./api
if ($LASTEXITCODE -ne 0) { throw 'La construccion fallo. No hay un escaneo nuevo valido.' }
& docker image inspect actividad3-api:actualizada --format '{{.Id}}' | Set-Content ./evidencias/imagen-actualizada-id.txt
& trivy version | Set-Content ./evidencias/trivy-version-actualizada.txt
Get-Date -Format o | Set-Content ./evidencias/fecha-escaneo-actualizado.txt
# No se ocultan severidades, no se ignoran CVE y no se usa ignore-unfixed.
& trivy image --format json --output ./evidencias/trivy-api-actualizada.json actividad3-api:actualizada
if ($LASTEXITCODE -ne 0) { throw 'Trivy fallo. No interpretes el resultado como cero criticos.' }
$reporteActualizado = Get-Content ./evidencias/trivy-api-actualizada.json -Raw | ConvertFrom-Json
if (!($reporteActualizado.PSObject.Properties.Name -contains 'Results')) {
    throw 'El reporte no contiene Results; revisa el escaneo.'
}
if (@($reporteActualizado.Results).Count -eq 0) { throw 'No se analizaron resultados; revisa el escaneo.' }
$hallazgos = @($reporteActualizado.Results | ForEach-Object { $_.Vulnerabilities } | Where-Object { $null -ne $_ })
$criticos = @($hallazgos | Where-Object Severity -eq 'CRITICAL')
$hallazgos | Group-Object Severity | Select-Object Name, Count | Format-Table -AutoSize
Write-Output ('Hallazgos criticos: ' + $criticos.Count)
if ($criticos.Count -gt 0) {
    'PENDIENTE: el reporte contiene criticos.' | Set-Content ./evidencias/estado-sin-criticos.txt
    $criticos | Select-Object VulnerabilityID, PkgName, InstalledVersion, FixedVersion | Format-Table -AutoSize
    throw 'No cumple sin criticos. Conserva el reporte y revisa los hallazgos.'
}
'SIN CRITICOS en este escaneo; revisar otras severidades y cobertura.' | Set-Content ./evidencias/estado-sin-criticos.txt
Write-Output 'CUMPLE cero hallazgos CRITICAL en este reporte. No significa ausencia de riesgos.'
