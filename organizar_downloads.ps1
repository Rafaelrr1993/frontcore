# Organiza FrontCore\downloads\ em subpastas por categoria.
# Mantém TODOS os instaladores de software (são as versões testadas/
# validadas pro cliente - não vamos trocar por "baixe a mais recente").
# Só tira o que é risco de segurança (senha salva) ou claramente pessoal
# (Discord, WhatsApp, Raycast, Claude, Telegram) - nada disso é "versão
# de cliente".
#
# Rode este script de dentro da pasta FrontCore (ou ajuste $Base abaixo).

$Base = "$env:USERPROFILE\Desktop\Projetos_AVANÇO\FrontCore\downloads"
cd $Base

# --- 1. Cria as pastas por categoria ---
$categorias = "balanca","impressoras","pinpad","servicos-postgres","ferramentas-internas","linux-frente-loja","requisitos-gsurf","software-cliente"
foreach ($c in $categorias) { New-Item -ItemType Directory -Force -Path (Join-Path $Base $c) | Out-Null }

# --- 2. Move os arquivos certos pra cada categoria ---
Move-Item "Avanco Teste Balanca.exe" "balanca\" -Force
Move-Item "BalancaTeste.exe" "balanca\" -Force

Move-Item "TMUSB_DeviceDriver_v8.00b.exe" "impressoras\" -Force
Move-Item "OK_impressorasat.ini" "impressoras\" -Force

Move-Item "Gertec-Full-Installer_2.1.0.9.exe" "pinpad\" -Force

Move-Item "servicosPostgres\Cliente-Servico.jar" "servicos-postgres\" -Force
Move-Item "servicosPostgres\Servico.jar" "servicos-postgres\" -Force
Move-Item "servicosPostgres\old-Servico.jar" "servicos-postgres\" -Force
Move-Item "servicosPostgres\teste-Servico.jar" "servicos-postgres\" -Force
Move-Item "servicosPostgres\Modulo 4.pptm" "servicos-postgres\" -Force

Move-Item "IntegPaf.jar" "ferramentas-internas\" -Force
Move-Item "Busca_Preço__Gerenciador_de_Terminal_ServUni_Windows.exe" "ferramentas-internas\" -Force
Move-Item "DBFPlus.exe" "ferramentas-internas\" -Force
Move-Item "renomear-tudo.exe" "ferramentas-internas\" -Force
Move-Item "DRCOM232.exe" "ferramentas-internas\" -Force
Move-Item "CesarFTP.exe" "ferramentas-internas\" -Force
Move-Item "DEIXAR_AGENTE_ONLINE.bat" "ferramentas-internas\" -Force
Move-Item "HttpRequest.dll" "ferramentas-internas\" -Force -ErrorAction SilentlyContinue

Move-Item "xorg.conf-vesa" "linux-frente-loja\" -Force
Move-Item "inst_java.sh" "linux-frente-loja\" -Force

Move-Item "requisitos\Requisitos GSurf\RequisitosGSurf.exe" "requisitos-gsurf\" -Force
Move-Item "requisitos\Requisitos GSurf\msvcr120.dll" "requisitos-gsurf\" -Force
Move-Item "requisitos\Requisitos GSurf\msvcp120.dll" "requisitos-gsurf\" -Force

# Software de terceiros - versões pinadas/testadas, mantidas como estão
$software = @(
    "Git-2.49.0-64-bit.exe", "node-v22.14.0-x64.msi", "npp.8.6.9.Installer.x64.exe",
    "Postman-win64-Setup.exe", "VirtualBox-7.0.20-163906-Win.exe", "VirtualBox-7.2.6-172322-Win.exe",
    "VSCodeUserSetup-x64-1.99.2.exe", "Thunderbird Setup 140.0.exe", "anydesk-6-1-4.exe",
    "rustdesk-1.4.3-x86_64.exe", "FortiClientVPNInstaller.exe", "UltraVNC_32bit_v1.3.2.exe",
    "VNC-Viewer-6.21.406-Windows.exe", "VNC-Viewer-6.21.406-Windows.zip", "vncviewer.exe",
    "putty-64bit-0.81-installer.msi", "putty.exe", "pgadmin3.msi", "pgadmin4-5.6-x64.exe",
    "sqlite3.exe", "sqlitestudio-2.1.5.exe", "mdb-viewer-plus-2.63-installer.exe", "rufus.exe",
    "WinSCP.exe", "jre-8u301-windows-x64 (1).exe"
)
foreach ($f in $software) {
    if (Test-Path $f) { Move-Item $f "software-cliente\" -Force }
}

# --- 3. .xinitrc: copia sanitizado (sem a senha em texto puro) ---
$xinitrcOrig = "xinitric\.xinitrc"
if (Test-Path $xinitrcOrig) {
    (Get-Content $xinitrcOrig -Raw) -replace '-passwd "pdvlinux"', '-passwd "TROQUE_ESTA_SENHA"' |
        Set-Content "linux-frente-loja\.xinitrc" -NoNewline
    Write-Host "Copiado e senha do VNC substituída por placeholder em linux-frente-loja\.xinitrc"
}

# --- 4. Tira do repositório os arquivos grandes demais pro git (>100MB) ---
# (eu subo esses via GitHub Release separadamente, não entram no commit)
$grandes = "$env:USERPROFILE\Desktop\arquivos_grandes_frontcore"
New-Item -ItemType Directory -Force -Path $grandes | Out-Null
$paraRelease = @(
    "driver-epson-tm-t20-tm-t20x.zip",
    "software-cliente\Postman-win64-Setup.exe",
    "software-cliente\VirtualBox-7.0.20-163906-Win.exe",
    "software-cliente\VirtualBox-7.2.6-172322-Win.exe",
    "software-cliente\VSCodeUserSetup-x64-1.99.2.exe",
    "software-cliente\pgadmin4-5.6-x64.exe"
)
foreach ($f in $paraRelease) {
    if (Test-Path $f) { Move-Item $f $grandes -Force }
}

# --- 5. Apaga só o que é risco de segurança ou claramente pessoal (não é "versão de cliente") ---
$apagar = @(
    "Claude Setup.exe", "DiscordSetup.exe", "Raycast Installer.exe", "WhatsApp Installer.exe",
    "tsetup-x64.5.2.3.exe",
    "WinSCP.ini", "WinSCP - Copia.ini", "WinSCP.pt",
    "options.vnc", "dbfplus.ini"
)
foreach ($f in $apagar) {
    if (Test-Path $f) { Remove-Item $f -Force }
}

# --- 6. Limpa pastas antigas/temporárias que sobraram vazias ---
Remove-Item "servicosPostgres" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "requisitos" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "xinitric" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Pronto! Confira o resultado com:"
Write-Host "  Get-ChildItem -Recurse '$Base' | Select-Object FullName"
Write-Host ""
Write-Host "Arquivos grandes demais pro git (subo via GitHub Release) foram pra: $grandes"
Write-Host "  - driver-epson-tm-t20-tm-t20x.zip (173MB)"
Write-Host "  - Postman-win64-Setup.exe (130MB)"
Write-Host "  - VirtualBox-7.0.20-163906-Win.exe (106MB)"
Write-Host "  - VirtualBox-7.2.6-172322-Win.exe (116MB)"
Write-Host "  - VSCodeUserSetup-x64-1.99.2.exe (103MB)"
Write-Host "  - pgadmin4-5.6-x64.exe (141MB)"
Write-Host "Me avisa quando terminar que eu sigo com a página e o commit."
