with open('../Extension/filters/chromium/filter_21.txt', 'r') as istr:
    with open('output.txt', 'w') as ostr:
        print("! Checksum: 8f9c7526eb6395e02766b744bb422b2fdb0a52637c9b26790ebae0081b1c0843", file=ostr)
        print("! Title: CyberPurify Explicit Filter", file=ostr)
        print("! Description: Filter that enables explicit content blocking on websites.", file=ostr)
        print("! Version: 0.2.1", file=ostr)
        print("! TimeUpdated: 2020-11-09T19:33:31+03:00", file=ostr)
        print("! Expires: 12 hours (update frequency)", file=ostr)
        print("! Homepage: https://cyberpurify.com", file=ostr)
        print("! License: https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE", file=ostr)
        print("\n", file=ostr)

        for i, line in enumerate(istr):
            # Get rid of the trailing newline (if any).
            if not line.strip():
                continue

            if '#' in line.strip():
                continue

            line = line.rstrip('\n')
            line = line.replace("0.0.0.0 ", "||")

            if '||' in line.strip() and '^$document' not in line.strip():
                line += '^$document'

            print(line, file=ostr)
