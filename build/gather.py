import sys
import os
import fnmatch

directories = [
               'math',
               'core',
               'events',
               'scope',
               'version',
               'graph',
               'material',
               'graphics',
               'input',
               'net',
               'resources',
               'shape',
               'helpers',
               'framework',               
               'editor',
               ]

# Get a list of all javascript files in directory
def gather(base):
    for subdir in directories:
        dir = os.path.join(base, subdir)
        for (path, dirs, files) in os.walk(dir):
            files = fnmatch.filter(files, '*.js')
            for file in files:
                yield os.path.join(path, file)

f = open("dependencies.txt", "w");

for file in gather(sys.argv[1]):
    f.write(file)
    f.write("\n")
