import re
import pathlib

MAPPING = {
    # Neutral surfaces / text / borders
    'bg-white': 'bg-gray-800',
    'bg-gray-50': 'bg-gray-900',
    'bg-gray-100': 'bg-gray-700',
    'bg-gray-200': 'bg-gray-600',
    'bg-gray-300': 'bg-gray-500',
    'text-gray-900': 'text-gray-100',
    'text-gray-800': 'text-gray-100',
    'text-gray-700': 'text-gray-200',
    'text-gray-600': 'text-gray-300',
    'text-gray-500': 'text-gray-400',
    'text-gray-400': 'text-gray-500',
    'text-gray-300': 'text-gray-600',
    'border-gray-50': 'border-gray-700',
    'border-gray-100': 'border-gray-700',
    'border-gray-200': 'border-gray-600',
    'divide-gray-100': 'divide-gray-700',
    'to-white': 'to-gray-800',
    # Semantic badges / alerts (SWOT lists, error banners, category pills, etc.)
    'bg-red-50': 'bg-red-950/40',
    'bg-red-100': 'bg-red-900/40',
    'bg-amber-50': 'bg-amber-950/40',
    'bg-green-50': 'bg-green-950/40',
    'bg-emerald-50': 'bg-emerald-950/40',
    'bg-blue-50': 'bg-blue-950/40',
    'text-red-700': 'text-red-300',
    'text-red-600': 'text-red-400',
    'text-amber-700': 'text-amber-300',
    'text-amber-800': 'text-amber-300',
    'text-green-700': 'text-green-300',
    'text-emerald-700': 'text-emerald-300',
    'text-emerald-600': 'text-emerald-400',
    'text-blue-700': 'text-blue-300',
    'border-amber-100': 'border-amber-800',
    'border-red-100': 'border-red-800',
    'border-red-200': 'border-red-800',
    'border-emerald-100': 'border-emerald-800',
}

# Longest keys first so the alternation doesn't let a shorter key's pattern
# accidentally win a partial match before a longer one is tried.
_keys_sorted = sorted(MAPPING.keys(), key=len, reverse=True)
_alt = '|'.join(re.escape(k) for k in _keys_sorted)
# Optional stacked-variant prefix (hover:, sm:, group-hover:, dark:hover: etc.)
# followed by one of our known base utility tokens, on a word boundary so
# e.g. "bg-gray-50" never matches inside "bg-gray-500".
PATTERN = re.compile(r'(?P<prefix>(?:[\w-]+:)+)?\b(?P<base>' + _alt + r')\b')


def process(text: str) -> str:
    out = []
    last = 0
    for m in PATTERN.finditer(text):
        prefix = m.group('prefix') or ''
        base = m.group('base')
        dark_base = MAPPING[base]
        insertion = f' dark:{prefix}{dark_base}'
        out.append(text[last:m.end()])
        # Skip if this exact dark variant is already present right after
        # (e.g. a component where dark classes were added by hand already).
        if not text[m.end():m.end() + len(insertion)] == insertion:
            out.append(insertion)
        last = m.end()
    out.append(text[last:])
    return ''.join(out)


def main():
    root = pathlib.Path('src')
    changed = []
    for path in sorted(root.rglob('*.tsx')):
        text = path.read_text(encoding='utf-8')
        new_text = process(text)
        if new_text != text:
            path.write_text(new_text, encoding='utf-8')
            changed.append(str(path))
    print(f'Updated {len(changed)} files:')
    for c in changed:
        print(' -', c)


if __name__ == '__main__':
    main()
