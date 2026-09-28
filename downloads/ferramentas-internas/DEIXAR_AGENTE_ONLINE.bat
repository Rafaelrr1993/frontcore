taskkill /f /im novoagente.exe

timeout /t 1

net stop "NovoAgenteAv"
net start "NovoAgenteAv"

TIMEOUT /T 1

wmic process where name="novoagente.exe" call setpriority "256"
