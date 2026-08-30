#!/bin/bash

# Exit on any error
set -e

# Default release type is 'patch' if none provided
TYPE=${1:-patch}

# Ensure working directory is clean
if [[ -n $(git status -s) ]]; then
  echo "Error: Working directory is not clean. Please commit or stash your changes first."
  exit 1
fi

echo "====================================="
echo "Bumping version ($TYPE)..."
echo "====================================="

# 1. Bump version in package.json (without creating a git commit/tag yet)
npm version "$TYPE" --no-git-tag-version

# 2. Extract the new version from package.json
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version is: $NEW_VERSION"

# 3. Increment versionCode and update versionName in android/app/build.gradle
GRADLE_FILE="android/app/build.gradle"

# Find current versionCode
CURRENT_VERSION_CODE=$(grep 'versionCode' "$GRADLE_FILE" | awk '{print $2}')
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

echo "Updating Android versionCode from $CURRENT_VERSION_CODE to $NEW_VERSION_CODE"
echo "Updating Android versionName to $NEW_VERSION"

# Use sed to replace both
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS needs empty string after -i
  sed -i '' "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" "$GRADLE_FILE"
  sed -i '' "s/versionName '.*'/versionName '$NEW_VERSION'/" "$GRADLE_FILE"
else
  # Linux
  sed -i "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" "$GRADLE_FILE"
  sed -i "s/versionName '.*'/versionName '$NEW_VERSION'/" "$GRADLE_FILE"
fi

# 4. Stage the changed files
git add package.json package-lock.json "$GRADLE_FILE"

# 5. Commit with standard release message
COMMIT_MSG="chore(release): v$NEW_VERSION"
git commit -m "$COMMIT_MSG"

# 6. Create Git Tag
TAG_NAME="v$NEW_VERSION"
git tag "$TAG_NAME"

echo "====================================="
echo "Version bumped successfully to $TAG_NAME"
echo "====================================="
echo "Would you like to push the changes and the tag to trigger the release workflow? (y/n)"
read -r PUSH_CONFIRM

if [[ "$PUSH_CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Pushing commit to origin..."
  git push origin HEAD
  echo "Pushing tag to origin..."
  git push origin "$TAG_NAME"
  echo "Done! The GitHub Action should now start building the APK."
else
  echo "Push skipped. You can manually push using:"
  echo "  git push origin HEAD && git push origin $TAG_NAME"
fi
