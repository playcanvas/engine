"""\
Build playcanvas sdk using Google Closure compiler
Options:
    -h : Display this help
    -l [1|2|3] : Compilation level.
        1: WHITESPACE_ONLY (default)
        2: SIMPLE_OPTIMIZATIONS
        3: ADVANCED_OPTIMIZATIONS
    -d [dirname] : Set root directory (default '.')
    -o [filepath] : Set output file (default 'output/playcanvas-latest.dev.js')
"""

import sys
import os
import getopt
import subprocess
import shutil
import json

ROOT = "."
OUTPUT = "output/playcanvas-%s.js" % ('latest')
COMPILATION_LEVEL = "WHITESPACE_ONLY"

COMP_LEVELS = [
    "WHITESPACE_ONLY",
    "WHITESPACE_ONLY",
    "SIMPLE_OPTIMIZATIONS",
    "ADVANCED_OPTIMIZATIONS"
]

def get_revision():
    """
    Try and write the mercurial revision out to the file 'revision.py'.
    This will silence errors from mercurial, so beware of weird cases. If
    you want to read stderr eventually, read out[1]
    """
    try:
        process = subprocess.Popen(['hg', 'id', '-in'], shell=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE)
        out = process.communicate()

        if not out[0]:
            print("WARNING: error occured extracting mercurial revision: %s" % out[1].strip())
            return ("-", "-")

        (revision, id) = out[0].split()
        if revision and id:
            return (revision, id)
        else:
            print("WARINING: Something went wrong trying to extract mercurial revision!")
            return ("-", "-")
    except Exception as e:
        print("WARNING: Failed to extract the mercurial revision: (%s)!" % e)
        return ("-", "-")

def get_version():
    try:
        version_file = "../VERSION"
        f = open(version_file, "r")
        version = f.read()
        f.close()
    except Exception, e:
        print(str(e))
        return "__CURRENT_SDK_VERSION__"
    return version

def build(dst):
    dependency_file = os.path.join(ROOT, "dependencies.txt")
    compiler_path = os.path.join(ROOT, "closure/compiler.jar")
    temp_path = os.path.join(ROOT, "out.js")

    dependencies = open(dependency_file, "r")

    # Build and call command
    cmd = [
        "java",
        "-jar", compiler_path,
        "--compilation_level", COMPILATION_LEVEL,
        "--js_output_file=" + temp_path,
        "--manage_closure_dependencies", "true"
    ]

    if COMPILATION_LEVEL == COMP_LEVELS[0]:
        cmd += ["--formatting", 'pretty_print']

    # Use ECMA script 5 which supports getters and setters
    cmd.append("--language_in=ECMASCRIPT5")

    for file in dependencies:
        cmd.append("--js=" + os.path.join(ROOT, file.strip()))

    retcode = subprocess.call(cmd)

    # Copy OUTPUT to build directory
    if not os.path.exists(os.path.dirname(dst)):
        os.mkdir(os.path.dirname(dst))
    shutil.move(temp_path, dst)

    return retcode

def usage():
    print(__doc__)

def setup():
    global ROOT, OUTPUT, COMPILATION_LEVEL
    try:
        opts, args = getopt.getopt(sys.argv[1:], "d:o:hl:")
    except getopt.GetoptError, err:
        print(str(err))
        sys.exit(2)

    for o, a in opts:
        if(o == "-h"):
            usage()
            sys.exit(0)
        if o == "-d":
            ROOT = a
        if o == "-o":
            OUTPUT = a
        if o == '-l':
            try:
                COMPILATION_LEVEL = COMP_LEVELS[int(a)]
            except Exception as e:
                print(e)
                COMPILATION_LEVEL = "WHITESPACE_ONLY"

def insert_versions(path):
    '''.. ::insert_versions(path)
    Insert the version and revision numbers into the path file.
    '''

    # open source, read in data and replace with version and revision numbers
    sf = open(path, 'r')
    text = sf.read()
    text = text.replace("__CURRENT_SDK_VERSION__", get_version())
    text = text.replace("__MERCURIAL_REVISION__", get_revision()[0])

    # Open a temporary destination file
    dst = path + '.tmp'
    df = open(dst, 'w')
    df.write(text)

    # close files
    sf.close()
    df.close()

    # replace path with dst, delete temporary file
    shutil.copy(dst, path)
    os.remove(dst)

def create_package_json():
    '''.. ::create_package_json()
    Create the package.json file needed to create a nodejs package.
    '''
    base = {
        "name": "playcanvas",
        "description": "PlayCanvas Engine",
        "version": get_version().strip(),
        "homepage": "https://playcanvas.com",
        "repository": "https://bitbucket.org/playcanvas/engine",
        "author": "PlayCanvas <support@playcanvas.com>",
        "main": "build/output/playcanvas-latest.js",
        "engines": {
            "node": ">= 0.6.12"
        },
        "files": [
            "build/output/playcanvas-latest.js"
        ]
    }

    with open('../package.json', 'w') as f:
        json.dump(base, f, indent=2, sort_keys=True)


if __name__ == "__main__":
    setup()
    output_path = os.path.join(ROOT, OUTPUT)

    retcode = build(output_path)
    if retcode:
        sys.exit(retcode)

    insert_versions(output_path)
    create_package_json()
