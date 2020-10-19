with open('../Extension/filters/chromium/explicit.txt', 'r') as istr:
    with open('output.txt', 'w') as ostr:
        for i, line in enumerate(istr):
            # Get rid of the trailing newline (if any).
            if not line.strip():
                continue

            if '#' in line.strip():
                continue

            line = line.rstrip('\n')

            if '||' in line.strip() and '^$document' not in line.strip():
                line += '^$document'

            print(line, file=ostr)
