#!/bin/bash -e

RELEASE_PREFIX="release-"
RELEASE_REGEX="^$RELEASE_PREFIX[0-9]+.[0-9]+$"

BRANCH=$(git branch --show-current)
VERSION=$(npm pkg get version | sed 's/"//g')

echo "Release [BRANCH=$BRANCH, VERSION=$VERSION]"

PARTS=(${VERSION//./ })
MAJOR=${PARTS[0]}
MINOR=${PARTS[1]}
PATCH=${PARTS[2]//-*/}
BUILD=${PARTS[2]//*-/}
if [[ $PATCH == $BUILD ]]; then
    BUILD=""
fi

echo "Version [MAJOR=$MAJOR, MINOR=$MINOR, PATCH=$PATCH, BUILD=$BUILD]"

if [ "$BRANCH" == "version" ]; then
    echo "Creating release branch from $BRANCH"

    RELEASE_BRANCH="$RELEASE_PREFIX$MAJOR.$MINOR"
    RELEASE_MESSAGE="Branch $MAJOR.$MINOR"

    read -p "About to create minor release branch '$RELEASE_BRANCH' taken from '$BRANCH' branch. Continue? (Y/n) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Create release branch from main branch
    git branch $RELEASE_BRANCH $BRANCH

    # Bump minor prelease version on main 
    npm version preminor --preid=dev --no-git-tag-version
    git commit -m "$RELEASE_MESSAGE" -- package.json package-lock.json

    # Switch to release branch
    git checkout $RELEASE_BRANCH

    # Change prerelease version to preview
    npm version prerelease --preid=preview --no-git-tag-version
    git commit -m "$RELEASE_MESSAGE" -- package.json package-lock.json
    exit 0
fi

if [[ $BRANCH =~ $RELEASE_REGEX ]]; then
    echo "Finalizing release branch $BRANCH"

    FINALIZED_VERSION="$MAJOR.$MINOR.$PATCH"

    # Check if tag already exists
    git fetch --tags
    if git tag | grep -q "$FINALIZED_VERSION"; then
        echo "$FINALIZED_VERSION tag already exists. Aborting."
        exit 1
    fi

    read -p "About to finalize and tag branch '$BRANCH' with version '$FINALIZED_VERSION'. Continue? (Y/n) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Bump patch version (with tag)
    npm version patch
    exit 0
fi

echo "Unrecognized branch '$BRANCH'."
exit 1