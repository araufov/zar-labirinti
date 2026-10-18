#!/usr/bin/env bash
# Zar Labirinti — TURN server (coturn) o'rnatish skripti
# Ubuntu 22.04 / 24.04 uchun. Root sifatida ishga tushiring:
#   curl -fsSL https://raw.githubusercontent.com/araufov/zar-labirinti/main/turn-setup.sh | sudo bash
# (ixtiyoriy) TURN_PASS=... bilan parolni oldindan berish mumkin
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "root kerak: sudo bash turn-setup.sh"; exit 1; fi

echo "== 1/5 Paketlar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq coturn curl ufw iptables-persistent >/dev/null

echo "== 2/5 IP aniqlash"
PUB_IP="$(curl -4 -fsS https://api.ipify.org || curl -4 -fsS https://ifconfig.me)"
LOC_IP="$(hostname -I | awk '{print $1}')"
echo "   public: $PUB_IP   local: $LOC_IP"

echo "== 3/5 Login/parol"
if [ -f /etc/turnserver.conf ] && grep -q '^user=zar:' /etc/turnserver.conf; then
  PASS="$(grep '^user=zar:' /etc/turnserver.conf | cut -d: -f2)"
  echo "   mavjud parol saqlanadi"
elif [ -n "${TURN_PASS:-}" ]; then
  PASS="$TURN_PASS"
else
  PASS="$(openssl rand -hex 16)"
fi

echo "== 4/5 Konfiguratsiya"
EXT=""
if [ "$PUB_IP" != "$LOC_IP" ]; then EXT="external-ip=$PUB_IP/$LOC_IP"; fi
cat > /etc/turnserver.conf <<EOF
# Zar Labirinti TURN
listening-port=3478
listening-ip=0.0.0.0
$EXT
relay-ip=$LOC_IP
min-port=49152
max-port=65535
realm=zar.labirinti
lt-cred-mech
user=zar:$PASS
fingerprint
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1
user-quota=16
total-quota=400
stale-nonce=600
# faqat relay — serverning o'zidagi xizmatlarga ruxsat yo'q
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
log-file=/var/log/turnserver.log
simple-log
EOF
sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn

# 443 va 80 portlarni ham 3478 ga yo'naltirish (qattiq firewall'lar uchun)
for P in 443 80; do
  for PROTO in tcp udp; do
    iptables -t nat -C PREROUTING -p $PROTO --dport $P -j REDIRECT --to-port 3478 2>/dev/null || \
    iptables -t nat -A PREROUTING -p $PROTO --dport $P -j REDIRECT --to-port 3478
  done
done
netfilter-persistent save >/dev/null 2>&1 || true

echo "== 5/5 Firewall va ishga tushirish"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 3478/tcp >/dev/null;  ufw allow 3478/udp >/dev/null
ufw allow 443/tcp  >/dev/null;  ufw allow 443/udp  >/dev/null
ufw allow 80/tcp   >/dev/null;  ufw allow 80/udp   >/dev/null
ufw allow 49152:65535/udp >/dev/null
ufw --force enable >/dev/null

systemctl enable coturn >/dev/null 2>&1
systemctl restart coturn
sleep 2
if systemctl is-active --quiet coturn; then STATUS="ISHLAYAPTI"; else STATUS="XATO — journalctl -u coturn"; fi

cat <<EOF

==================================================
 TURN server: $STATUS
--------------------------------------------------
 Quyidagi 3 qatorni Claude'ga yuboring:

 ip: $PUB_IP
 username: zar
 credential: $PASS
==================================================
 Tekshirish: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
   STUN or TURN URI: turn:$PUB_IP:3478
   username: zar   password: $PASS
   "Gather candidates" → ro'yxatda "relay" qatori chiqsa — ishlayapti.
EOF
