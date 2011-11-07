import sys
import os
import getopt
import subprocess
import shutil

root = "."
output = "output/playcanvas-latest.dev.js"
compilation_level = "WHITESPACE_ONLY"
COMP_LEVELS = ["WHITESPACE_ONLY", "WHITESPACE_ONLY", "SIMPLE_OPTIMIZATIONS", "ADVANCED_OPTIMIZATIONS"];

def get_revision():
    # Try and write the mercurial revision out to the file 'revision.py'
    try:
        import subprocess
        process = subprocess.Popen(['hg', 'id', '-in'], shell=False, stdout=subprocess.PIPE)
        output = process.communicate()
        return output[0].split()
    except Exception, e:
        print(str(e))
        return ("__MERCURIAL_REVISION__", "")

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

def build():
    global compilation_level
    formatting = None
    # Set options
    if compilation_level == COMP_LEVELS[0]:
        formatting = "pretty_print"
    
    #compilation_level = "WHITESPACE_ONLY"
    #compilation_level = "SIMPLE_OPTIMIZATIONS"
    #compilation_level = "ADVANCED_OPTIMIZATIONS"
    
    dependency_file = os.path.join(root, "dependencies.txt")
    compiler_path = os.path.join(root, "closure/compiler.jar")
    temp_path = os.path.join(root, "out.js")
    output_path = os.path.join(root, output)

    dependencies = open(dependency_file, "r");
    
    # Build and call command
    cmd = ["java", "-jar", compiler_path, "--compilation_level", compilation_level, "--js_output_file=" + temp_path, "--manage_closure_dependencies", "true"]
    if formatting: 
        cmd.append("--formatting")
        cmd.append(formatting)
        
    for file in dependencies:
        cmd.append( "--js=" + os.path.join(root, file.strip()))
    retcode = subprocess.call(cmd)
    
    # Copy output to build directory
    if not os.path.exists(os.path.dirname(output_path)):
       os.mkdir(os.path.dirname(output_path))
    shutil.move(temp_path, output_path)
    
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
            
if __name__ == "__main__":
    setup()

    retcode = build()
    sys.exit(retcode)