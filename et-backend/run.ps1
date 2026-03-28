# Always run from this folder so Python can import package "app".
Set-Location $PSScriptRoot
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000
