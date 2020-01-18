#!/bin/bash

CYAN='\033[0;36m'
RED='\033[1;31m'
GREEN='\033[0;32m'
NORMAL='\033[0m'

echo -e ${CYAN}Building Typescript bindings and documentation...${NORMAL}
rm -rf docs/*.html && \
npm run lint && \
npm run docs && \
npm run tsd

if [ $? -ne 0 ]
then
    exit 1
fi

echo -e ${GREEN}
echo Documents have been written to: ./docs
echo Playcanvas bindings have been written to: ./build/output/playcanvas.d.ts
echo You should copy bindings to your project, e.g. 'cp ./build/output/playcanvas.d.ts ~/dev/mygame/src/shims'
echo -e ${NORMAL}
