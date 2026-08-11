#!/usr/bin/env bash
# ===================================================================
# Mac/Linux setup script - run this in Terminal:
#   bash setup.sh
# It installs Python packages and prepares everything for you.
# ===================================================================

set -e

echo ""
echo "============================================================"
echo "  Coloring Book Generator - Mac/Linux Setup"
echo "============================================================"
echo ""

# Check if python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed."
    echo ""
    echo "Please install Python 3.10 or newer:"
    echo "  Mac:     brew install python3   (https://brew.sh)"
    echo "           OR download from https://www.python.org/downloads/"
    echo "  Linux:   sudo apt install python3 python3-venv python3-pip"
    echo ""
    echo "After installing Python 3, run this setup.sh file again."
    echo ""
    exit 1
fi

echo "[OK] Python found:"
python3 --version
echo ""

# Create virtual environment
echo "[1/4] Creating virtual environment..."
python3 -m venv .venv
echo "[OK] Virtual environment created."
echo ""

# Activate it
echo "[2/4] Activating virtual environment..."
# shellcheck disable=SC1091
source .venv/bin/activate
echo "[OK] Activated."
echo ""

# Install packages
echo "[3/4] Installing packages (this takes 1-2 minutes)..."
pip install --upgrade pip
pip install -r requirements.txt
echo "[OK] Packages installed."
echo ""

# Create .env file
echo "[4/4] Preparing .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[OK] Created .env file from template."
else
    echo "[OK] .env file already exists - keeping your current settings."
fi
echo ""

echo "============================================================"
echo "  SETUP COMPLETE!"
echo "============================================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Open the .env file in any text editor"
echo "2. Replace 'sk-proj-your-key-here' with your actual OpenAI API key"
echo "   Get your key from: https://platform.openai.com/api-keys"
echo "3. Save the .env file"
echo "4. Run:  bash run.sh"
echo ""
echo "(See README.md for full instructions)"
echo ""
