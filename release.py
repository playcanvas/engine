"""
Release script:

Merges changes from default into stable and increments the version number according to input argument "major", "minor", "rev"
"""

import tempfile
import shutil
import sys
import subprocess

def editversionpy(filename, version):
    f = open(filename, "w")
    f.write('%s\n' % (version))
    f.close()

def get_version_tuple(filename):
    import re
    f = open(filename)
    version = re.findall("(\d*\.\d*\.\d*)", f.read())[0]
    parts = version.split(".")

    return (int(parts[0]), int(parts[1]), int(parts[2]))

def get_new_version_number(version_tuple, release_type):
    major = version_tuple[0]
    minor = version_tuple[1]
    rev = version_tuple[2]

    if release_type == "major":
        major = major + 1
        minor = 0
        rev = 0
    if release_type == "minor":
        minor = minor + 1
        rev = 0
    if release_type == "rev":
        rev = rev + 1

    return (major, minor, rev)

def to_string(v, after=''):
    return "%s.%s.%s%s" % (v[0], v[1], v[2], after)

def run_commands(cmds, release_type):
    version_file = "VERSION"

    versions = {}
    release_version = None
    next_version = None

    for cmd in cmds:
        print("running: %s" % cmd)
        if cmd[0] == "editversionpy":
            # increment the version from the version slot, using the release_type specified
            next_version = get_new_version_number(versions[cmd[1]], cmd[2])
            editversionpy(version_file, to_string(next_version, cmd[3]))
        elif cmd[0] == "getversion":
            # Store the version from the current version file into a named slot
            versions[cmd[1]] = get_version_tuple(version_file)
        elif cmd[0] == "commit":
            note = cmd[1] % (to_string(next_version))
            retcode = subprocess.call(["git", "commit", "-a", "-m", note])
            if retcode:
                sys.exit(retcode)
        elif cmd[0] == "tag":
            tag = "v%s" % (to_string(next_version))
            retcode = subprocess.call(["git", "tag", tag])
            if retcode:
                sys.exit(retcode)
        else:
            retcode = subprocess.call(cmd)
            if retcode:
                sys.exit(retcode)

def release(release_type):
    cmds = [
        ["git", "checkout", "stable"],
        ["getversion", "stable"],
        ["git", "merge", "master"],
        ["editversionpy", "stable", release_type, ""],
        ["tag"],
        ["commit", "[RELEASE] v%s"],
        ["getversion", "stable"],
        ["git", "checkout", "master"],
        ["git", "merge", "stable"],
        ["editversionpy", "stable", "minor", "-dev"],
        ["commit", "[VERSION] v%s-dev"],
    ]

    run_commands(cmds, release_type)

if sys.argv[1] in ["major", "minor", "rev"]:
    release(sys.argv[1])
else:
    print("Argument should be 'major', 'minor' or 'rev'")
