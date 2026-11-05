#!/usr/bin/env bash
# Локальный HTTPS для проверки на iPhone по Wi-Fi (Safari даёт WebCrypto и Service Worker только на https или localhost).
# Свой маленький центр сертификации (создаётся один раз) + сертификат сервера для IP компьютера.
# Запуск из Git Bash:  bash tools/make-cert.sh 192.168.0.187
# Ключи лежат только в ..\справки\https\ (в git не попадают). На iPhone ставится ТОЛЬКО ca.crt (публичный).
set -euo pipefail
IP="${1:?укажи IP компьютера в домашней сети, например 192.168.0.187}"
DIR="$(cd "$(dirname "$0")/../../справки" && pwd)/https"
mkdir -p "$DIR"; cd "$DIR"
if [ ! -f ca.key ]; then
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:3072 -sha256 -days 1095 -nodes -keyout ca.key -out ca.crt \
    -subj "/CN=EGE kurs 2027 local CA/O=Makar" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
fi
cat > server.ext <<EOF
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost
EOF
MSYS_NO_PATHCONV=1 openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=${IP}"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 397 -sha256 -extfile server.ext
rm -f server.csr server.ext
openssl x509 -in server.crt -noout -subject -ext subjectAltName -enddate
echo "Готово: $DIR (ca.crt — на iPhone; server.* — для tools/dev-server.mjs --https)"
