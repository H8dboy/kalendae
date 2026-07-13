# Build APK Android di release (firmato) — usato anche a mano: .\build-android.ps1
$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "C:\Android\sdk"
$env:NDK_HOME = "C:\Android\sdk\ndk\29.0.14206865"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
Set-Location C:\progetti\agenda-h8
& npm run tauri android build -- --apk --target aarch64 2>&1 |
    ForEach-Object { "$_" } |
    Out-File C:\progetti\agenda-h8\build-android.log -Append -Encoding utf8
"EXITCODE=$LASTEXITCODE" | Out-File C:\progetti\agenda-h8\build-android.log -Append -Encoding utf8
