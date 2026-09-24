#!/bin/bash
set -e
export EXPO_TOKEN="BjwsNKyJKH8yPzVs3XjI2bYK-WHI6G0i40wfHVu-"
cd /app/frontend
echo EAS_BUILD_START > /app/eas_build_log.txt
date >> /app/eas_build_log.txt
if ! command -v convert >/dev/null 2>&1; then apt-get update -y >> /app/eas_build_log.txt 2>&1; DEBIAN_FRONTEND=noninteractive apt-get install -y imagemagick >> /app/eas_build_log.txt 2>&1 || true; fi
if command -v convert >/dev/null 2>&1; then convert -size 1200x400 xc:none -gravity center -pointsize 130 -fill "#2ecc71" -annotate +0+0 "ZATRIZ" -trim +repage -bordercolor none -border 40 assets/images/splash-image.png >> /app/eas_build_log.txt 2>&1; echo SPLASH_EXIT_$? >> /app/eas_build_log.txt; else echo SPLASH_SKIPPED_NO_IMAGEMAGICK >> /app/eas_build_log.txt; fi
python3 -c "
import json
with open('app.json') as f: d = json.load(f)
d['expo']['name'] = 'Zatriz'
d['expo']['slug'] = 'jesse'
for p in d['expo'].get('plugins', []):
    if isinstance(p, list) and p[0] == 'expo-splash-screen':
            p[1]['imageWidth'] = 420
                    p[1]['backgroundColor'] = '#000000'
                    with open('app.json','w') as f: json.dump(d, f, indent=2)
                    " >> /app/eas_build_log.txt 2>&1
                    printf '%s\n' '{' '  "cli": { "version": ">= 10.0.0" },' '  "build": {' '    "preview": {' '      "android": { "buildType": "apk" },' '      "env": { "EXPO_PUBLIC_BACKEND_URL": "https://vendor-rack-plan.preview.emergentagent.com" }' '    },' '    "production": {}' '  }' '}' > eas.json
                    echo --WHOAMI-- >> /app/eas_build_log.txt
                    npx --yes eas-cli@latest whoami >> /app/eas_build_log.txt 2>&1
                    echo --BUILD-- >> /app/eas_build_log.txt
                    npx --yes eas-cli@latest build -p android --profile preview --non-interactive --no-wait >> /app/eas_build_log.txt 2>&1
                    echo EAS_BUILD_EXIT_$? >> /app/eas_build_log.txt
                    