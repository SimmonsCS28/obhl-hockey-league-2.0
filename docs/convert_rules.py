import pypdf
import re

reader = pypdf.PdfReader(r'e:\projects\obhl-hockey-league-2.0\docs\OBHL_RULES_10-09-2025.pdf')

all_text = ''
for page in reader.pages:
    text = page.extract_text()
    if text:
        text = re.sub(r'\s+', ' ', text)
        all_text += text + ' '

# Remove page headers/footers
all_text = re.sub(r'Page \d+ of \d+ Updated \d+/\d+/\d+', '', all_text)
all_text = re.sub(r'OLD BUZZARD HOCKEY LEAGUE RULES', '', all_text)
all_text = all_text.strip()

def convert_section_body(body):
    """Convert a section body with potential sub-items into HTML."""
    html = ''
    # Split on sub-items like a) b) c) and roman numerals i. ii. iii.
    sub_pattern = r'(?=(?:^|(?<=\s))[a-z]\))|(?=(?:^|(?<=\s))(?:i{1,3}|iv|vi{0,3}|ix|x)\.)'
    sub_items = re.split(sub_pattern, body)
    
    first = True
    for sub in sub_items:
        sub = sub.strip()
        if not sub:
            continue
        sm = re.match(r'^([a-z]\)|(?:i{1,3}|iv|vi{0,3}|ix|x)\.)\s*(.*)', sub, re.DOTALL)
        if sm:
            if first:
                html += '</p>'
                first = False
            label = sm.group(1)
            content = sm.group(2).strip()
            html += f'<p class="rule-sub"><strong>{label}</strong> {content}</p>'
        else:
            if first:
                html += sub + '</p>'
                first = False
            else:
                html += f'<p>{sub}</p>'
    return html

html = '<div class="league-rules">'

# Split into major sections
section_pattern = r'(GENERAL LEAGUE INFORMATION|OBHL RULES|MEMORANDUM OF UNDERSTANDING \(MOU\) AND AGREEMENT)'
parts = re.split(section_pattern, all_text)

for part in parts:
    part = part.strip()
    if not part:
        continue

    if re.match(section_pattern, part):
        html += f'<h2>{part}</h2>'
        continue

    # Split on numbered rules like 1) 2) ... 16)
    items = re.split(r'(?=\b\d{1,2}\)\s)', part)

    for item in items:
        item = item.strip()
        if not item:
            continue

        m = re.match(r'^(\d{1,2}\))\s*(.*)', item, re.DOTALL)
        if m:
            num = m.group(1)
            content = m.group(2).strip()

            # Try to extract a title before first colon
            title_m = re.match(r'^([^:(]{3,60}):\s*(.*)', content, re.DOTALL)
            if title_m:
                title = title_m.group(1).strip()
                body = title_m.group(2).strip()
                html += f'<div class="rule-item"><p><strong>{num} {title}:</strong> '
            else:
                title = ''
                body = content
                html += f'<div class="rule-item"><p><strong>{num}</strong> '

            html += convert_section_body(body)
            html += '</div>'
        else:
            html += f'<p>{item}</p>'

html += '</div>'

# Fix encoding artifacts from PDF
replacements = {
    '\u0092': "'", '\u2019': "'", '\u0093': '"', '\u0094': '"',
    '\u2018': "'", '\u201c': '"', '\u201d': '"',
    '\u0085': '...', '\ufffd': "'", '\u0096': '-', '\u2013': '-',
}
for bad, good in replacements.items():
    html = html.replace(bad, good)

with open(r'e:\projects\obhl-hockey-league-2.0\docs\rules.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'HTML generated: {len(html)} chars')
print('\nPreview (first 2000 chars):')
print(html[:2000])
