#!/bin/bash -e

MAIN_BRANCH="main"

PRE_ID_DEV="dev"
PRE_ID_PREVIEW="preview"

RELEASE_PREFIX="release-"
RELEASE_REGEX="^$RELEASE_PREFIX[0-9]+.[0-9]+$"

# Help
HELP=$1
if [[ "$HELP" == "--help" || "$HELP" == "-h" ]]; then
    echo """
Run this script on either '$MAIN_BRANCH' or '${RELEASE_PREFIX}X.X' branch.

    For creating a new release:
        On '$MAIN_BRANCH' branch, it will create a new release branch '${RELEASE_PREFIX}X.X' and bump the minor version on '$MAIN_BRANCH'.

    For finalizing a minor or patch releases or prereleases:
        On '${RELEASE_PREFIX}X.X' branch, it asks for a type (minor/patch/prerelease) and creates a tag.
    """
    exit 0
fi

# Check for any uncommitted changes (unstaged or staged)
if [[ $(git status --porcelain) ]]; then
    echo "There are uncommitted changes. Please commit or stash them before running this script."
    exit 1
fi

BRANCH=$(git branch --show-current)
VERSION=$(npm pkg get version | sed 's/"//g')

PARTS=(${VERSION//./ })
MAJOR=${PARTS[0]}
MINOR=${PARTS[1]}
PATCH=${PARTS[2]//-*/}
BUILD=${PARTS[3]}

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
    git branch "$RELEASE_BRANCH" "$BRANCH"

    # Bump minor prerelease version on main 
    npm version preminor --preid=$PRE_ID_DEV --no-git-tag-version
    git commit -m "$RELEASE_MESSAGE" -- package.json package-lock.json

    # Switch to release branch
    git checkout $RELEASE_BRANCH

    # Change prerelease version to preview
    npm version prerelease --preid=$PRE_ID_PREVIEW --no-git-tag-version
    git commit -m "$RELEASE_MESSAGE" -- package.json package-lock.json
    exit 0
fi

# Checked out on release branch
if [[ $BRANCH =~ $RELEASE_REGEX ]]; then
    # Determine which release type
    TYPE=$1
    if [[ ! " minor patch prerelease " =~ " $TYPE " ]]; then
        echo "Usage: $0 <minor|patch|prerelease>"
        echo "Run '--help' for more information."
        exit 1
    fi

    # Check if minor release then check if patch version is 0 and is preview
    if [[ "$TYPE" == "minor" ]]; then
        if [[ "$PATCH" != "0" || "$VERSION" != *"$PRE_ID_PREVIEW"* ]]; then
            echo "Minor release is only allowed if the current version is 'X.X.0-$PRE_ID_PREVIEW.X'."
            exit 1
        fi
    fi

    echo "Finalize release [BRANCH=$BRANCH, VERSION=$VERSION, TYPE=$TYPE]"

    # Fetch all remote tags
    git fetch --tags

    # Calculate the next version
    npm version $TYPE --preid=$PRE_ID_PREVIEW --no-git-tag-version >> /dev/null
    NEXT_VERSION=$(npm pkg get version | sed 's/"//g')
    git reset --hard >> /dev/null

    read -p "About to finalize and tag branch '$BRANCH' for 'v$NEXT_VERSION'. Continue? (y/N) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Bump patch version (with tag)
    npm version $TYPE --preid=$PRE_ID_PREVIEW
    exit 0
fi

echo "Unrecognized branch '$BRANCH'."
echo "Run '--help' for more information."
exit 1