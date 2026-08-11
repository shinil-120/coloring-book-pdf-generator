#!/usr/bin/env bash
# ===================================================================
# Mac/Linux run script - run this in Terminal:
#   bash run.sh
# It activates the virtual environment and shows a menu.
# ===================================================================

# Activate the virtual environment
# shellcheck disable=SC1091
source .venv/bin/activate

while true; do
    clear
    echo ""
    echo "============================================================"
    echo "  Coloring Book Generator"
    echo "============================================================"
    echo ""
    echo "  What would you like to do?"
    echo ""
    echo "  1. List all available books (FREE - no cost)"
    echo "  2. Test with 3 images (~\$0.13 at medium quality)"
    echo "  3. Generate a full 30-page book (~\$1.26 at medium quality)"
    echo "  4. Generate using LOW quality (cheapest - ~\$0.33 per book)"
    echo "  5. Generate using HIGH quality (best - ~\$5.00 per book)"
    echo "  6. Estimate cost without spending anything (DRY RUN)"
    echo "  7. Rebuild PDF from existing images (FREE - no API calls)"
    echo "  8. Exit"
    echo ""
    read -p "Enter your choice (1-8): " choice

    case "$choice" in
        1)
            echo ""
            python main.py --list
            echo ""
            read -p "Press Enter to continue..."
            ;;
        2)
            echo ""
            read -p "Enter book slug (e.g. Dinosaurs, Pets, Dragons): " bookslug
            python main.py --book "$bookslug" --limit 3
            echo ""
            read -p "Press Enter to continue..."
            ;;
        3)
            echo ""
            read -p "Enter book slug (e.g. Dinosaurs, Pets, Dragons): " bookslug
            python main.py --book "$bookslug"
            echo ""
            read -p "Press Enter to continue..."
            ;;
        4)
            echo ""
            read -p "Enter book slug (e.g. Dinosaurs, Pets, Dragons): " bookslug
            python main.py --book "$bookslug" --quality low
            echo ""
            read -p "Press Enter to continue..."
            ;;
        5)
            echo ""
            read -p "Enter book slug (e.g. Dinosaurs, Pets, Dragons): " bookslug
            python main.py --book "$bookslug" --quality high
            echo ""
            read -p "Press Enter to continue..."
            ;;
        6)
            echo ""
            read -p "Enter book slug (e.g. Dinosaurs, Pets, Dragons): " bookslug
            read -p "How many images? (e.g. 5, 10, 30): " itemlimit
            python main.py --book "$bookslug" --limit "$itemlimit" --dry-run
            echo ""
            read -p "Press Enter to continue..."
            ;;
        7)
            echo ""
            read -p "Enter book slug (e.g. Dinosaurs): " bookslug
            python main.py --book "$bookslug" --no-generate
            echo ""
            read -p "Press Enter to continue..."
            ;;
        8)
            exit 0
            ;;
        *)
            echo "Invalid choice."
            read -p "Press Enter to continue..."
            ;;
    esac
done
