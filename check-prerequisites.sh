#!/bin/bash

# Script de verification des prerequis pour Quoridor
# Verifie que tout est pret pour lancer l'application

echo "=== Verification des prerequis pour Quoridor ==="
echo

ERRORS=0

# Verification de Node.js
echo "1. Verification de Node.js..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "   Node.js trouve: $NODE_VERSION"
    
    # Extraction du numero de version majeure
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "   ERREUR: Node.js version 18+ requise"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "   ERREUR: Node.js non trouve"
    echo "   Installer Node.js depuis https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# Verification de npm
echo "2. Verification de npm..."
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo "   npm trouve: v$NPM_VERSION"
else
    echo "   ERREUR: npm non trouve"
    ERRORS=$((ERRORS + 1))
fi

# Verification des ports
echo "3. Verification des ports..."
if lsof -i :3000 >/dev/null 2>&1; then
    echo "   ATTENTION: Port 3000 deja utilise"
    echo "   Processus utilisant le port 3000:"
    lsof -i :3000 | grep LISTEN
    ERRORS=$((ERRORS + 1))
else
    echo "   Port 3000 libre"
fi

if lsof -i :3001 >/dev/null 2>&1; then
    echo "   ATTENTION: Port 3001 deja utilise"
    echo "   Processus utilisant le port 3001:"
    lsof -i :3001 | grep LISTEN
    ERRORS=$((ERRORS + 1))
else
    echo "   Port 3001 libre"
fi

# Verification de la structure du projet
echo "4. Verification de la structure du projet..."
if [ ! -d "frontend" ]; then
    echo "   ERREUR: Dossier 'frontend' manquant"
    ERRORS=$((ERRORS + 1))
else
    echo "   Dossier frontend trouve"
fi

if [ ! -d "backend" ]; then
    echo "   ERREUR: Dossier 'backend' manquant"
    ERRORS=$((ERRORS + 1))
else
    echo "   Dossier backend trouve"
fi

if [ ! -f "shared/types.ts" ]; then
    echo "   ERREUR: Fichier 'shared/types.ts' manquant"
    ERRORS=$((ERRORS + 1))
else
    echo "   Fichier shared/types.ts trouve"
fi

# Verification des package.json
echo "5. Verification des fichiers de configuration..."
if [ ! -f "frontend/package.json" ]; then
    echo "   ERREUR: frontend/package.json manquant"
    ERRORS=$((ERRORS + 1))
else
    echo "   frontend/package.json trouve"
fi

if [ ! -f "backend/package.json" ]; then
    echo "   ERREUR: backend/package.json manquant"
    ERRORS=$((ERRORS + 1))
else
    echo "   backend/package.json trouve"
fi

# Verification des node_modules
echo "6. Verification des dependances..."
if [ ! -d "frontend/node_modules" ]; then
    echo "   ATTENTION: Dependances frontend non installees"
    echo "   Executer: cd frontend && npm install"
    ERRORS=$((ERRORS + 1))
else
    echo "   Dependances frontend installees"
fi

if [ ! -d "backend/node_modules" ]; then
    echo "   ATTENTION: Dependances backend non installees"
    echo "   Executer: cd backend && npm install"
    ERRORS=$((ERRORS + 1))
else
    echo "   Dependances backend installees"
fi

# Verification de la base de donnees
echo "7. Verification de la base de donnees..."
if [ -f "backend/quoridor.db" ]; then
    echo "   Base de donnees existante trouvee"
    
    # Verification du schema (colonnes critiques)
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 backend/quoridor.db ".schema users" | grep -q "ai_difficulty"; then
            echo "   Schema de la base de donnees a jour"
        else
            echo "   ATTENTION: Schema de la base de donnees obsolete"
            echo "   Supprimer backend/quoridor.db et relancer pour reconstruire"
            ERRORS=$((ERRORS + 1))
        fi
    fi
else
    echo "   Base de donnees non initialisee (sera creee au premier lancement)"
fi

# Resultat final
echo
echo "=== Resultat ==="
if [ $ERRORS -eq 0 ]; then
    echo "Tous les prerequis sont satisfaits!"
    echo "Vous pouvez lancer l'application avec: ./run-app.sh"
    exit 0
else
    echo "Nombre d'erreurs detectees: $ERRORS"
    echo "Corriger les erreurs avant de lancer l'application"
    exit 1
fi 