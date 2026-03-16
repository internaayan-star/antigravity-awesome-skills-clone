#!/bin/bash

echo "Optimizing Antigravity skills..."

# --- CONFIGURATION ---
BASE_DIR="$HOME/.gemini/antigravity"
SKILLS_DIR="$BASE_DIR/skills"
LIBRARY_DIR="$BASE_DIR/skills_library"
ARCHIVE_ROOT="$BASE_DIR"

# --- LIBRARY INITIALIZATION ---
if [ ! -d "$LIBRARY_DIR" ]; then
    echo "Initializing skills library..."
    mkdir -p "$LIBRARY_DIR"
    
    # 1. Migrate from current skills folder
    if [ -d "$SKILLS_DIR" ]; then
        echo "  + Moving current skills to library..."
        cp -R "$SKILLS_DIR"/* "$LIBRARY_DIR/" 2>/dev/null
        rm -rf "$SKILLS_DIR"
    fi
    
    # 2. Merge from all archives
    for d in $(ls -dt "$BASE_DIR"/skills_archive* 2>/dev/null); do
        echo "  + Merging skills from $(basename "$d")..."
        cp -R "$d"/* "$LIBRARY_DIR/" 2>/dev/null
    done
fi

# --- PREPARE ACTIVE FOLDER ---
echo "Creating fresh skills folder..."
if [ -d "$SKILLS_DIR" ]; then
    timestamp=$(date +%Y%m%d_%H%M%S)
    mv "$SKILLS_DIR" "$BASE_DIR/skills_archive_$timestamp"
fi
mkdir -p "$SKILLS_DIR"

# --- BUNDLE EXPANSION ---
ESSENTIALS=""
echo "Expanding bundles..."

# Try Python helper
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

if command -v $PYTHON_CMD &> /dev/null; then
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    # Pass arguments directly to avoid shell expansion issues
    if [ -z "$*" ]; then
        ESSENTIALS=$($PYTHON_CMD "$SCRIPT_DIR/../tools/scripts/get-bundle-skills.py" "Essentials" 2>/dev/null)
    else
        ESSENTIALS=$($PYTHON_CMD "$SCRIPT_DIR/../tools/scripts/get-bundle-skills.py" "$@" 2>/dev/null)
    fi
fi

# Fallback
if [ -z "$ESSENTIALS" ]; then
    if [ -z "$*" ]; then
        echo "Using default essentials list..."
        ESSENTIALS="api-security-best-practices auth-implementation-patterns backend-security-coder frontend-security-coder cc-skill-security-review pci-compliance frontend-design react-best-practices react-patterns nextjs-best-practices tailwind-patterns form-cro seo-audit ui-ux-pro-max 3d-web-experience canvas-design mobile-design scroll-experience senior-fullstack frontend-developer backend-dev-guidelines api-patterns database-design stripe-integration agent-evaluation langgraph mcp-builder prompt-engineering ai-agents-architect rag-engineer llm-app-patterns rag-implementation prompt-caching context-window-management langfuse"
    else
        ESSENTIALS="$*"
    fi
fi

# --- RESTORATION ---
echo "Restoring selected skills..."
for skill in $ESSENTIALS; do
    if [ -d "$LIBRARY_DIR/$skill" ]; then
        echo "  + $skill"
        cp -R "$LIBRARY_DIR/$skill" "$SKILLS_DIR/"
    else
        echo "  - $skill (not found in library)"
    fi
done

echo ""
echo "Done! Antigravity is now optimized."
