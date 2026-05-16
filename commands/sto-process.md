netstat -ano | findstr ":3011 "
taskkill /PID 12360 /F


Get-Process node | Where-Object { (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 3011) } | Stop-Process -Force