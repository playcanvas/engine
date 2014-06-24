import sys
import os
import getopt
import subprocess
import shutil

root = "."
output = "output/playcanvas-%s.js" % ('latest')
compilation_level = "WHITESPACE_ONLY"
COMP_LEVELS = ["WHITESPACE_ONLY", "WHITESPACE_ONLY", "SIMPLE_OPTIMIZATIONS", "ADVANCED_OPTIMIZATIONS"];

def get_revision():
    # Try and write the mercurial revision out to the file 'revision.py'
    try:
        import subprocess
        process = subprocess.Popen(['git', 'rev-parse', '--short', 'HEAD'], shell=False, stdout=subprocess.PIPE)
        output = process.communicate()

        revision = output[0]
        if revision:
            return revision
        else:
            raise Exception("No revision number found")
    except Exception, e:
        return ""

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
    global compilation_level
    formatting = None
    # Set options
    if compilation_level == COMP_LEVELS[0]:
        formatting = "pretty_print"

    dependency_file = os.path.join(root, "dependencies.txt")
    compiler_path = os.path.join(root, "closure/compiler.jar")
    temp_path = os.path.join(root, "out.js")

    dependencies = open(dependency_file, "r");

    # Build and call command
    cmd = ["java", "-jar", compiler_path, "--compilation_level", compilation_level, "--js_output_file=" + temp_path, "--manage_closure_dependencies", "true"]
    if formatting:
        cmd.append("--formatting")
        cmd.append(formatting)

    # Use ECMA script 5 which supports getters and setters
    cmd.append("--language_in=ECMASCRIPT5")

    for file in dependencies:
        cmd.append( "--js=" + os.path.join(root, file.strip()))

    retcode = subprocess.call(cmd)

    # Copy output to build directory
    if not os.path.exists(os.path.dirname(dst)):
       os.mkdir(os.path.dirname(dst))
    shutil.move(temp_path, dst)

    return retcode

def usage():
    print("""
    Build playcanvas sdk using Google Closure compiler
    Options:
    \t-h : Display this help
    \t-l [1|2|3] : Compilation level. 1: WHITESPACE_ONLY, 2: SIMPLE_OPTIMIZATIONS, 3: ADVANCED_OPTIMIZATIONS (default 1)
    \t-d [dirname] : Set root directory (default '.')
    \t-o [filepath] : Set output file (default 'output/playcanvas-latest.dev.js')
    """)

def setup():
    try:
        opts, args = getopt.getopt(sys.argv[1:], "d:o:hl:")
    except getopt.GetoptError, err:
        print(str(err))
        sys.exit(2)

    global root
    global output
    global compilation_level
    for o,a in opts:
        if(o == "-h"):
            usage()
            sys.exit(0)
        if o == "-d":
            root = a
        if o == "-o":
            output = a
        if o == '-l':
            try:
                compilation_level = COMP_LEVELS[int(a)]
            except Exception, e:
                print(e)
                compilation_level = "WHITESPACE_ONLY"

def insert_versions(path):
    '''.. ::insert_versions(path)
    Insert the version and revision numbers into the path file.
    '''

    # open source, read in data and replace with version and revision numbers
    sf = open(path, 'r')
    text = sf.read()
    text = text.replace("__CURRENT_SDK_VERSION__", get_version())
    text = text.replace("__REVISION__", get_revision())

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
    base = '''{
      "name": "playcanvas",
      "description": "PlayCanvas Engine",
      "version": "__VERSION__",
      "homepage": "https://playcanvas.com",
      "repository": "https://github.com/playcanvas/engine",
      "author": "PlayCanvas <support@playcanvas.com>",
      "main": "build/output/playcanvas-latest.js",
      "engines": {
        "node": ">= 0.6.12"
      },
      "files": [
        "build/output/playcanvas-latest.js"
      ]
    }'''

    with open('../package.json', 'w') as f:
        f.write(base.replace('__VERSION__', get_version().strip()))


if __name__ == "__main__":
    setup()
    output_path =  os.path.join(root, output)

    retcode = build(output_path)
    if retcode:
        sys.exit(retcode)

    insert_versions(output_path)
    create_package_json()
