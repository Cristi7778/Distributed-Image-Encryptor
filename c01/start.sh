#!/bin/sh
export PATH=/opt/software/node-v22.10.0-linux-x64/bin:$PATH
export JAVA_HOME=/opt/software/java/jdks/jdk-17.0.2
export PATH=$JAVA_HOME/bin:$PATH

echo "Starting frontend (npm start)..."
cd ~/../frontend/app
npm install
npm start &

echo "Starting backend (mvn exec)..."
cd ~/../backend
mvn exec:java -Dexec.mainClass="com.example.Main"
