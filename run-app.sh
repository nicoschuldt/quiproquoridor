#!/bin/bash

# Script de lancement de l'application Quoridor
# Lance le backend et le frontend sans Docker

set -e

echo "=== Lancement de l'application Quoridor ==="
echo

# Fonction pour nettoyer les processus en cas d'arret
cleanup() {
    echo
    echo "Arret de l'application..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

# Capture les signaux d'arret
trap cleanup SIGINT SIGTERM

# Verification rapide des prerequis
if ! command -v node >/dev/null 2>&1; then
    echo "ERREUR: Node.js non trouve"
    echo "Executer d'abord: ./check-prerequisites.sh"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "ERREUR: npm non trouve"
    exit 1
fi

# Verification des ports
if lsof -i :3000 >/dev/null 2>&1; then
    echo "ERREUR: Port 3000 deja utilise"
    echo "Arreter le processus utilisant ce port ou utiliser Docker"
    exit 1
fi

if lsof -i :3001 >/dev/null 2>&1; then
    echo "ERREUR: Port 3001 deja utilise"
    echo "Arreter le processus utilisant ce port ou utiliser Docker"
    exit 1
fi

# Installation des dependances si necessaire
echo "1. Verification des dependances..."

if [ ! -d "backend/node_modules" ]; then
    echo "   Installation des dependances backend..."
    cd backend
    npm install
    cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "   Installation des dependances frontend..."
    cd frontend
    npm install
    cd ..
fi

echo "   Dependances pretes"

# Lancement du backend
echo "2. Lancement du backend..."
cd backend

# Migration de la base de donnees
echo "   Initialisation de la base de donnees..."
# S'assurer que les migrations sont a jour avec le schema
npm run db:generate >/dev/null 2>&1 || true
npm run db:migrate

# Demarrage du serveur backend
echo "   Demarrage du serveur backend sur le port 3001..."
npm start &
BACKEND_PID=$!

cd ..

# Attendre que le backend soit pret
echo "   Attente du demarrage du backend..."
sleep 3

# Verification que le backend est lance
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERREUR: Le backend a echoue au demarrage"
    exit 1
fi

# Test de connexion au backend
for i in {1..10}; do
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        echo "   Backend pret"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "ERREUR: Le backend ne repond pas"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Lancement du frontend
echo "3. Lancement du frontend..."
cd frontend

echo "   Demarrage du serveur frontend sur le port 3000..."
npm run dev -- --port 3000 &
FRONTEND_PID=$!

cd ..

# Attendre que le frontend soit pret
echo "   Attente du demarrage du frontend..."
sleep 5

# Verification que le frontend est lance
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "ERREUR: Le frontend a echoue au demarrage"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Tout est pret
echo
echo "=== Application lancee avec succes ==="
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
echo
echo "Appuyer sur Ctrl+C pour arreter l'application"
echo

# Attendre indefiniment
while true; do
    # Verifier que les processus sont toujours actifs
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERREUR: Le backend s'est arrete de maniere inattendue"
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "ERREUR: Le frontend s'est arrete de maniere inattendue"
        break
    fi
    sleep 5
done

cleanup 