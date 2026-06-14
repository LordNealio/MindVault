#!/bin/bash
# MindVault Habit System - Deployment Script
# This script automates deployment to GitHub and Vercel

set -e

echo "================================"
echo "MindVault Habit System Deployment"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check git status
echo -e "${YELLOW}Step 1: Checking git status...${NC}"
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}✓ Working tree clean${NC}"
else
    echo -e "${RED}✗ Uncommitted changes detected${NC}"
    echo "Please commit all changes before deploying"
    exit 1
fi

# Step 2: Check if remote is configured
echo -e "${YELLOW}Step 2: Checking GitHub remote...${NC}"
if git remote | grep -q "origin"; then
    echo -e "${GREEN}✓ GitHub remote configured${NC}"
    REMOTE_URL=$(git config --get remote.origin.url)
    echo "  URL: $REMOTE_URL"
else
    echo -e "${RED}✗ GitHub remote not configured${NC}"
    echo ""
    echo "Please set up GitHub first:"
    echo "  1. Create repo at https://github.com/new"
    echo "  2. Run: git remote add origin https://github.com/[USERNAME]/[REPO].git"
    echo "  3. Run this script again"
    exit 1
fi

# Step 3: Build the project
echo -e "${YELLOW}Step 3: Building project...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Step 4: Push to GitHub
echo -e "${YELLOW}Step 4: Pushing to GitHub...${NC}"
git push -u origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
else
    echo -e "${RED}✗ Push to GitHub failed${NC}"
    exit 1
fi

# Step 5: Suggest Vercel deployment
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ DEPLOYMENT READY${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Go to https://vercel.com/dashboard"
echo "  2. Click 'New Project'"
echo "  3. Select your GitHub repo"
echo "  4. Click 'Deploy'"
echo ""
echo "Or use Vercel CLI:"
echo "  npm install -g vercel"
echo "  vercel --prod"
echo ""
echo -e "${YELLOW}Your app will be live at:${NC}"
echo "  https://mindvault.vercel.app"
echo ""
echo -e "${GREEN}Deployment complete!${NC} 🚀"
