#!/bin/bash -e

MAIN_BRANCH="version"
RELEASE_PREFIX="release-"

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

if [ "$BRANCH" == "$MAIN_BRANCH" ]; then
    RELEASE_BRANCH="$RELEASE_PREFIX$MAJOR.$MINOR"
    RELEASE_MESSAGE="Branch $MAJOR.$MINOR"

    read -p "About to create minor release branch '$RELEASE_BRANCH' taken from '$MAIN_BRANCH' branch. Continue? (Y/n) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    git branch $RELEASE_BRANCH $MAIN_BRANCH

    npm version preminor --preid=dev --no-git-tag-version
    git commit -m "$RELEASE_MESSAGE" -- package.json package-lock.json
    git checkout $RELEASE_BRANCH

    npm version prerelease --preid=preview --no-git-tag-version
    git commit -m "$RELEASE_MESSAGE" -- package.json package-lock.json
    exit 0
fi

if [[ $BRANCH == $RELEASE_PREFIX* ]]; then

fi