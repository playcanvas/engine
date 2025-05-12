#!/bin/bash -e

MAIN_BRANCH="main"
RELEASE_PREFIX="release-"
RELEASE_REGEX="^$RELEASE_PREFIX[0-9]+.[0-9]+$"

# Help
HELP=$1
if [[ "$HELP" == "--help" || "$HELP" == "-h" ]]; then
    echo """
Run this script on either '$MAIN_BRANCH' or '${RELEASE_PREFIX}X.X' branch.

    For minor releases:
        On '$MAIN_BRANCH' branch, it will create a new release branch '${RELEASE_PREFIX}X.X' and bump the minor version on '$MAIN_BRANCH'.

    For patch or prereleases:
        On '${RELEASE_PREFIX}X.X' branch, it ask for a type (patch or prerelease) and create a tag.
    """
    exit 0
fi

BRANCH=$(git branch --show-current)
VERSION=$(npm pkg get version | sed 's/"//g')
PARTS=(${VERSION//./ })
MAJOR=${PARTS[0]}
MINOR=${PARTS[1]}
PATCH=${PARTS[2]//-*/}
BUILD=${PARTS[2]//*-/}
if [[ $PATCH == $BUILD ]]; then
    BUILD=""
fi

# Checked out on main branch
if [[ "$BRANCH" == "$MAIN_BRANCH" ]]; then
    echo "Create release [BRANCH=$BRANCH, VERSION=$VERSION]"

    RELEASE_BRANCH="$RELEASE_PREFIX$MAJOR.$MINOR"
    RELEASE_MESSAGE="Branch $MAJOR.$MINOR"

    read -p "About to create minor release branch '$RELEASE_BRANCH' taken from '$BRANCH' branch. Continue? (y/N) " -r
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

# Checked out on release branch
if [[ $BRANCH =~ $RELEASE_REGEX ]]; then
    # Determine which release type
    TYPE=$1
    if [[ ! " patch prerelease " =~ " $TYPE " ]]; then
        echo "Usage: $0 <patch|prerelease>"
        echo "Run '--help' for more information."
        exit 1
    fi

    echo "Finalize release [BRANCH=$BRANCH, VERSION=$VERSION, TYPE=$TYPE]"

    # Fetch all remote tags
    git fetch --tags

    read -p "About to finalize and tag branch '$BRANCH' with version '$MAJOR.$MINOR.$PATCH'. Continue? (y/N) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Bump patch version (with tag)
    npm version $TYPE
    exit 0
fi

echo "Unrecognized branch '$BRANCH'."
echo "Run '--help' for more information."
exit 1