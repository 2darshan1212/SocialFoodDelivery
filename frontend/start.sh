#!/bin/bash

# Bash script to start the Social Food Delivery System

echo -e "\e[32mStarting Social Food Delivery System...\e[0m"
echo -e "\e[33mPlease follow these steps to run the application:\e[0m"

echo -e "\n\e[36mOption 1: Run frontend and backend in separate terminals\e[0m"
echo -e "\e[36m1. Terminal 1 (Backend):\e[0m"
echo -e "   cd ../backend"
echo -e "   npm install"
echo -e "   npm run dev"

echo -e "\n\e[36m2. Terminal 2 (Frontend):\e[0m"
echo -e "   npm install"
echo -e "   npm run dev"

echo -e "\n\e[36mOption 2: Use concurrently to run both (from the frontend directory):\e[0m"
echo -e "   npm install"
echo -e "   npm run start"

echo -e "\n\e[32mProject structure information:\e[0m"
echo -e "- All dependencies are now located in their respective directories (frontend/ and backend/)"
echo -e "- Root node_modules folder and package.json have been removed"
echo -e "- See README.md for more detailed instructions"
