#!/bin/bash
set -e
mkdir -p certs
cd certs

openssl req -x509 -newkey rsa:4096 -days 3650 -nodes -keyout ca.key -out ca.pem -subj "/O=EasyMonitor/CN=EasyMonitor-Root-CA"
openssl req -newkey rsa:4096 -nodes -keyout server.key -out server.csr -subj "/O=EasyMonitor/CN=localhost"
echo "subjectAltName=DNS:localhost,IP:127.0.0.1" > ext.cnf
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out server.pem -days 3650 -extfile ext.cnf
openssl req -newkey rsa:4096 -nodes -keyout client.key -out client.csr -subj "/O=EasyMonitor/CN=NodeAgent1"
openssl x509 -req -in client.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out client.pem -days 3650

rm -f ext.cnf server.csr client.csr
echo "Certs generated successfully."
